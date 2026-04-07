"""
E2E business flow tests:
 1. Full tournament creation pipeline (register → club → tournament → categories → teams → publish)
 2. Public page access (by slug, by code, categories, matches, standings, live)
 3. Live score flow (start tournament → start match → score → finish → standings update)
"""

import datetime
import io
import tempfile

from PIL import Image
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.clubs.models import Club
from apps.matches.models import Match
from apps.teams.models import Group, Team
from apps.tournaments.models import Category, Field, Tournament

MEDIA_ROOT = tempfile.mkdtemp()


def _make_image():
    img = Image.new("RGB", (50, 50), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    buf.name = "logo.png"
    return buf


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class TestTournamentCreationFlow(TestCase):
    """Full creation pipeline: register → club → tournament → categories →
    fields → teams → groups → publish."""

    def setUp(self):
        self.c = APIClient()
        cache.clear()

    def test_001_register_user(self):
        """Register a new organizer account via API."""
        r = self.c.post(
            "/api/v1/auth/register/",
            {
                "username": "flow_org",
                "email": "flow@test.com",
                "password": "SecurePass123!",
                "password_confirm": "SecurePass123!",
            },
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        self.assertIn("access", r.data)
        user = User.objects.get(username="flow_org")
        self.assertEqual(user.email, "flow@test.com")

    def test_010_full_creation_pipeline(self):
        """End-to-end: user → club → tournament → category → field → 4 teams
        → groups → publish.  Everything in a single sequential flow."""
        # ── Register ─────────────────────────────────
        r = self.c.post(
            "/api/v1/auth/register/",
            {
                "username": "pipe_org",
                "email": "pipe@test.com",
                "password": "SecurePass123!",
                "password_confirm": "SecurePass123!",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        token = r.data["access"]
        self.c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # ── Create club ──────────────────────────────
        r = self.c.post(
            "/api/v1/clubs/",
            {"name": "Pipeline Club"},
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        club_id = r.data["id"]

        # ── Create tournament ────────────────────────
        r = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "Pipeline Cup",
                "club": club_id,
                "start_date": "2026-09-01",
                "end_date": "2026-09-01",
                "location": "Paris",
            },
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        tid = r.data["id"]
        slug = r.data["slug"]
        self.assertTrue(slug)

        # ── Create category ──────────────────────────
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/categories/",
            {"name": "U12"},
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        cat_id = r.data["id"]

        # ── Create field ─────────────────────────────
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/fields/",
            {"name": "Terrain A"},
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        field_id = r.data["id"]

        # ── Create 4 teams ───────────────────────────
        team_ids = []
        for i, name in enumerate(["Alpha FC", "Beta FC", "Gamma FC", "Delta FC"]):
            r = self.c.post(
                f"/api/v1/tournaments/{tid}/teams/",
                {
                    "name": name,
                    "short_name": name[:3].upper(),
                    "category": cat_id,
                    "coach_name": f"Coach {i}",
                },
                format="json",
            )
            self.assertIn(r.status_code, [200, 201])
            team_ids.append(r.data["id"])

        self.assertEqual(len(team_ids), 4)

        # ── Generate balanced groups ─────────────────
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/categories/{cat_id}/groups/generate-balanced/",
            {"num_groups": 2},
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        groups = Group.objects.filter(category_id=cat_id)
        self.assertEqual(groups.count(), 2)

        # ── Publish tournament ───────────────────────
        r = self.c.post(f"/api/v1/tournaments/{tid}/publish/")
        self.assertEqual(r.status_code, 200)
        tournament = Tournament.objects.get(pk=tid)
        self.assertEqual(tournament.status, Tournament.Status.PUBLISHED)

        # ── Verify listing ───────────────────────────
        r = self.c.get("/api/v1/tournaments/")
        self.assertEqual(r.status_code, 200)
        results = r.data.get("results", r.data)
        names = [t["name"] for t in results]
        self.assertIn("Pipeline Cup", names)


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class TestPublicPageAccess(TestCase):
    """Public endpoints: slug lookup, code lookup, categories, matches,
    standings, live feed — all without authentication."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="pub_org",
            email="pub@test.com",
            password="SecurePass123!",
            role="organizer",
        )
        cls.club = Club.objects.create(name="Public Club", owner=cls.user)

        # Published tournament with category, field, teams, match
        cls.tournament = Tournament.objects.create(
            name="Public Cup",
            club=cls.club,
            start_date=datetime.date(2026, 8, 1),
            end_date=datetime.date(2026, 8, 1),
            location="Lyon",
            is_public=True,
            status=Tournament.Status.PUBLISHED,
        )
        cls.category = Category.objects.create(
            tournament=cls.tournament,
            name="U10",
        )
        cls.field = Field.objects.create(
            tournament=cls.tournament, name="Terrain 1"
        )
        cls.team_a = Team.objects.create(
            tournament=cls.tournament,
            category=cls.category,
            name="Team A",
            short_name="TA",
        )
        cls.team_b = Team.objects.create(
            tournament=cls.tournament,
            category=cls.category,
            name="Team B",
            short_name="TB",
        )
        cls.group = Group.objects.create(
            category=cls.category, name="Poule A"
        )
        cls.group.teams.add(cls.team_a, cls.team_b)

        cls.match = Match.objects.create(
            tournament=cls.tournament,
            category=cls.category,
            group=cls.group,
            field=cls.field,
            team_home=cls.team_a,
            team_away=cls.team_b,
            phase="group",
            start_time="2026-08-01T10:00:00Z",
            status=Match.Status.FINISHED,
            score_home=3,
            score_away=1,
        )

    def setUp(self):
        self.c = APIClient()
        cache.clear()

    def test_010_public_tournament_by_slug(self):
        r = self.c.get(f"/api/v1/public/tournaments/{self.tournament.slug}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["name"], "Public Cup")
        self.assertIn("categories", r.data)

    def test_011_public_tournament_by_code(self):
        code = self.tournament.public_code
        r = self.c.get(f"/api/v1/public/tournaments/by-code/{code}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["slug"], self.tournament.slug)

    def test_012_public_categories(self):
        r = self.c.get(
            f"/api/v1/public/tournaments/{self.tournament.slug}/categories/"
        )
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["name"], "U10")

    def test_013_public_matches(self):
        r = self.c.get(
            f"/api/v1/public/tournaments/{self.tournament.slug}/matches/"
        )
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.data["count"], 1)

    def test_014_public_standings(self):
        r = self.c.get(
            f"/api/v1/public/tournaments/{self.tournament.slug}/standings/"
        )
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.data, list)

    def test_015_public_live_feed(self):
        r = self.c.get(
            f"/api/v1/public/tournaments/{self.tournament.slug}/live/"
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("live_matches", r.data)
        self.assertIn("upcoming_matches", r.data)
        self.assertIn("recent_results", r.data)
        # Our finished match should appear in recent results
        self.assertGreaterEqual(len(r.data["recent_results"]), 1)

    def test_016_public_match_detail(self):
        r = self.c.get(
            f"/api/v1/public/tournaments/{self.tournament.slug}/matches/{self.match.id}/"
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["score_home"], 3)
        self.assertEqual(r.data["score_away"], 1)

    def test_017_public_team_view(self):
        r = self.c.get(
            f"/api/v1/public/tournaments/{self.tournament.slug}/teams/{self.team_a.id}/"
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("team", r.data)
        self.assertIn("matches", r.data)

    def test_018_nonexistent_slug_returns_404(self):
        r = self.c.get("/api/v1/public/tournaments/zzz-does-not-exist/")
        self.assertEqual(r.status_code, 404)

    def test_019_invalid_code_returns_404(self):
        r = self.c.get("/api/v1/public/tournaments/by-code/ZZZZZZ/")
        self.assertEqual(r.status_code, 404)


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class TestLiveScoreFlow(TestCase):
    """Full live flow: publish → start tournament → create match → start match
    → enter score → finish match → verify standings update."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="live_org",
            email="live@test.com",
            password="SecurePass123!",
            role="organizer",
        )
        cls.club = Club.objects.create(name="Live Club", owner=cls.user)

    def setUp(self):
        self.c = APIClient()
        self.c.force_authenticate(user=self.user)
        cache.clear()

    def _setup_tournament(self):
        """Create a published tournament with 2 teams, 1 field, 1 group."""
        t = Tournament.objects.create(
            name="Live Cup",
            club=self.club,
            start_date=datetime.date(2026, 7, 15),
            end_date=datetime.date(2026, 7, 15),
            location="Marseille",
            is_public=True,
            status=Tournament.Status.DRAFT,
        )
        cat = Category.objects.create(
            tournament=t, name="U14"
        )
        field = Field.objects.create(tournament=t, name="Terrain B")
        team_home = Team.objects.create(
            tournament=t, category=cat, name="Marseille FC", short_name="MFC"
        )
        team_away = Team.objects.create(
            tournament=t, category=cat, name="Nice FC", short_name="NFC"
        )
        group = Group.objects.create(category=cat, name="Poule X")
        group.teams.add(team_home, team_away)
        return t, cat, field, team_home, team_away, group

    def test_010_full_live_score_flow(self):
        """publish → start → create match → start match → score → finish →
        standings reflect result."""
        t, cat, field, home, away, group = self._setup_tournament()

        # Publish
        r = self.c.post(f"/api/v1/tournaments/{t.id}/publish/")
        self.assertEqual(r.status_code, 200)

        # Start tournament
        r = self.c.post(f"/api/v1/tournaments/{t.id}/start/")
        self.assertEqual(r.status_code, 200)
        t.refresh_from_db()
        self.assertEqual(t.status, Tournament.Status.LIVE)

        # Create a match
        r = self.c.post(
            f"/api/v1/tournaments/{t.id}/matches/",
            {
                "tournament": str(t.id),
                "team_home": home.id,
                "team_away": away.id,
                "category": cat.id,
                "group": group.id,
                "field": field.id,
                "phase": "group",
                "start_time": "2026-07-15T10:00:00Z",
            },
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        match_id = r.data["id"]

        # Start match
        r = self.c.post(f"/api/v1/tournaments/{t.id}/matches/{match_id}/start/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "live")

        # Enter score
        r = self.c.post(
            f"/api/v1/tournaments/{t.id}/matches/{match_id}/score/",
            {"score_home": 2, "score_away": 0},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["score_home"], 2)
        self.assertEqual(r.data["score_away"], 0)

        # Finish match
        r = self.c.post(
            f"/api/v1/tournaments/{t.id}/matches/{match_id}/finish/"
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "finished")

        # Verify standings
        r = self.c.get(f"/api/v1/categories/{cat.id}/standings/")
        self.assertEqual(r.status_code, 200)
        standings = r.data["groups"][0]["standings"]
        # Home team won → should be first
        self.assertGreaterEqual(len(standings), 2)
        top_team = standings[0]
        self.assertEqual(top_team["team_id"], home.id)
        self.assertEqual(top_team["played"], 1)
        self.assertEqual(top_team["won"], 1)
        self.assertEqual(top_team["goals_for"], 2)

    def test_020_public_live_feed_during_match(self):
        """While a match is live, the public /live/ endpoint should list it."""
        t, cat, field, home, away, group = self._setup_tournament()

        # Publish + start tournament
        self.c.post(f"/api/v1/tournaments/{t.id}/publish/")
        self.c.post(f"/api/v1/tournaments/{t.id}/start/")

        # Create + start match
        r = self.c.post(
            f"/api/v1/tournaments/{t.id}/matches/",
            {
                "tournament": str(t.id),
                "team_home": home.id,
                "team_away": away.id,
                "category": cat.id,
                "field": field.id,
                "phase": "group",
                "start_time": "2026-07-15T11:00:00Z",
            },
            format="json",
        )
        match_id = r.data["id"]
        self.c.post(f"/api/v1/tournaments/{t.id}/matches/{match_id}/start/")

        # Check public live feed (no auth)
        anon = APIClient()
        r = anon.get(f"/api/v1/public/tournaments/{t.slug}/live/")
        self.assertEqual(r.status_code, 200)
        live_ids = [m["id"] for m in r.data["live_matches"]]
        self.assertIn(str(match_id), live_ids)

    def test_030_score_on_finished_match_rejected(self):
        """Cannot enter score on an already-finished match."""
        t, cat, field, home, away, group = self._setup_tournament()
        self.c.post(f"/api/v1/tournaments/{t.id}/publish/")
        self.c.post(f"/api/v1/tournaments/{t.id}/start/")

        r = self.c.post(
            f"/api/v1/tournaments/{t.id}/matches/",
            {
                "tournament": str(t.id),
                "team_home": home.id,
                "team_away": away.id,
                "category": cat.id,
                "field": field.id,
                "phase": "group",
                "start_time": "2026-07-15T12:00:00Z",
            },
            format="json",
        )
        match_id = r.data["id"]
        self.c.post(f"/api/v1/tournaments/{t.id}/matches/{match_id}/start/")
        self.c.post(
            f"/api/v1/tournaments/{t.id}/matches/{match_id}/score/",
            {"score_home": 1, "score_away": 1},
            format="json",
        )
        self.c.post(f"/api/v1/tournaments/{t.id}/matches/{match_id}/finish/")

        # Try scoring again — should be rejected
        r = self.c.post(
            f"/api/v1/tournaments/{t.id}/matches/{match_id}/score/",
            {"score_home": 5, "score_away": 0},
            format="json",
        )
        self.assertEqual(r.status_code, 422)

    def test_040_unauthenticated_cannot_score(self):
        """Anonymous user cannot call score endpoint."""
        t, cat, field, home, away, group = self._setup_tournament()
        self.c.post(f"/api/v1/tournaments/{t.id}/publish/")
        self.c.post(f"/api/v1/tournaments/{t.id}/start/")

        r = self.c.post(
            f"/api/v1/tournaments/{t.id}/matches/",
            {
                "tournament": str(t.id),
                "team_home": home.id,
                "team_away": away.id,
                "category": cat.id,
                "field": field.id,
                "phase": "group",
                "start_time": "2026-07-15T13:00:00Z",
            },
            format="json",
        )
        match_id = r.data["id"]

        # Anonymous client
        anon = APIClient()
        r = anon.post(
            f"/api/v1/tournaments/{t.id}/matches/{match_id}/score/",
            {"score_home": 1, "score_away": 0},
            format="json",
        )
        self.assertEqual(r.status_code, 401)

    def test_050_tournament_finish_flow(self):
        """Full lifecycle: DRAFT → PUBLISHED → LIVE → FINISHED."""
        t, cat, field, home, away, group = self._setup_tournament()

        self.c.post(f"/api/v1/tournaments/{t.id}/publish/")
        self.c.post(f"/api/v1/tournaments/{t.id}/start/")
        r = self.c.post(f"/api/v1/tournaments/{t.id}/finish/")
        self.assertEqual(r.status_code, 200)
        t.refresh_from_db()
        self.assertEqual(t.status, Tournament.Status.FINISHED)
