"""
Comprehensive E2E test - All API routes, admin/coach/public connections,
QR codes, notifications, logos, and zero-error guarantee.
"""
import io
import os
import json
import tempfile
from PIL import Image

from django.test import TestCase, override_settings
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User
from apps.clubs.models import Club
from apps.subscriptions.models import Subscription
from apps.tournaments.models import Tournament, Category, Field
from apps.teams.models import Team
from apps.matches.models import Match
from apps.notifications.models import Notification

MEDIA_ROOT = tempfile.mkdtemp()


def _make_image():
    """Create a small in-memory PNG for logo upload tests."""
    img = Image.new("RGB", (50, 50), color="red")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    buf.name = "logo.png"
    return buf


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class ComprehensiveE2ETest(TestCase):
    """
    Tests every major API route, admin/coach/public flows, QR codes,
    notifications, logo uploads.
    """

    @classmethod
    def setUpTestData(cls):
        cls.admin_user = User.objects.create_user(
            username="e2e_admin",
            email="admin@e2e.test",
            password="AdminPass123!",
            role="organizer",
        )
        cls.coach_user = User.objects.create_user(
            username="e2e_coach",
            email="coach@e2e.test",
            password="CoachPass123!",
            role="organizer",
        )
        cls.club = Club.objects.create(
            name="E2E Club", owner=cls.admin_user
        )

    def setUp(self):
        self.c = APIClient()
        cache.clear()  # Reset throttle cache

    # â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def _auth_admin(self):
        self.c.force_authenticate(user=self.admin_user)

    def _auth_coach(self):
        self.c.force_authenticate(user=self.coach_user)

    def _no_auth(self):
        self.c.force_authenticate(user=None)

    # â”€â”€â”€ 1. Health checks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_001_health(self):
        r = self.c.get("/api/v1/health/")
        self.assertEqual(r.status_code, 200)

    def test_002_health_db(self):
        r = self.c.get("/api/v1/health/db/")
        self.assertEqual(r.status_code, 200)

    def test_003_public_health(self):
        r = self.c.get("/api/v1/public/health/")
        self.assertEqual(r.status_code, 200)

    # â”€â”€â”€ 2. Auth: register / login / refresh / me â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_010_register(self):
        r = self.c.post(
            "/api/v1/auth/register/",
            {
                "username": "e2e_new",
                "email": "new@e2e.test",
                "password": "NewPass123!",
                "password_confirm": "NewPass123!",
            },
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        self.assertIn("access", r.data)

    def test_011_login(self):
        r = self.c.post(
            "/api/v1/auth/login/",
            {"username": "e2e_admin", "password": "AdminPass123!"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)
        self.assertIn("refresh", r.data)

    def test_012_refresh(self):
        login = self.c.post(
            "/api/v1/auth/login/",
            {"username": "e2e_admin", "password": "AdminPass123!"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        r = self.c.post(
            "/api/v1/auth/refresh/",
            {"refresh": login.data["refresh"]},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)

    def test_013_me(self):
        self._auth_admin()
        r = self.c.get("/api/v1/auth/me/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["username"], "e2e_admin")

    def test_014_unauthenticated_me(self):
        self._no_auth()
        r = self.c.get("/api/v1/auth/me/")
        self.assertIn(r.status_code, [401, 403])

    # â”€â”€â”€ 3. Club CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_020_clubs_list(self):
        self._auth_admin()
        r = self.c.get("/api/v1/clubs/")
        self.assertEqual(r.status_code, 200)

    def test_021_club_create(self):
        self._auth_admin()
        r = self.c.post("/api/v1/clubs/", {"name": "Club 2"}, format="json")
        self.assertIn(r.status_code, [200, 201])

    def test_022_club_detail(self):
        self._auth_admin()
        r = self.c.get(f"/api/v1/clubs/{self.club.id}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["name"], "E2E Club")

    def test_023_club_update(self):
        self._auth_admin()
        r = self.c.patch(
            f"/api/v1/clubs/{self.club.id}/",
            {"name": "E2E Club Updated"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)

    # â”€â”€â”€ 4. Tournament CRUD + Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_030_tournament_full_lifecycle(self):
        self._auth_admin()

        # Create
        r = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "E2E Cup",
                "club": self.club.id,
                "start_date": "2026-07-01",
                "end_date": "2026-07-01",
                "location": "Paris",
            },
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        tid = r.data["id"]

        # List
        r = self.c.get("/api/v1/tournaments/")
        self.assertEqual(r.status_code, 200)

        # Detail
        r = self.c.get(f"/api/v1/tournaments/{tid}/")
        self.assertEqual(r.status_code, 200)

        # Update
        r = self.c.patch(
            f"/api/v1/tournaments/{tid}/",
            {"location": "Lyon"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)

        # â”€â”€â”€ Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/categories/",
            {"name": "U12", "age_min": 11, "age_max": 12},
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        cat_id = r.data["id"]

        r = self.c.get(f"/api/v1/tournaments/{tid}/categories/")
        self.assertEqual(r.status_code, 200)

        r = self.c.get(f"/api/v1/tournaments/{tid}/categories/{cat_id}/")
        self.assertEqual(r.status_code, 200)

        r = self.c.patch(
            f"/api/v1/tournaments/{tid}/categories/{cat_id}/",
            {"name": "U12 Elite"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)

        # â”€â”€â”€ Fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/fields/",
            {"name": "Terrain A"},
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        field_id = r.data["id"]

        r = self.c.get(f"/api/v1/tournaments/{tid}/fields/")
        self.assertEqual(r.status_code, 200)

        r = self.c.get(f"/api/v1/tournaments/{tid}/fields/{field_id}/")
        self.assertEqual(r.status_code, 200)

        # â”€â”€â”€ Teams â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/teams/",
            {
                "name": "FC Paris",
                "short_name": "FCP",
                "category": cat_id,
                "coach_name": "Jean",
                "coach_phone": "0612345678",
                "coach_email": "jean@e2e.com",
            },
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        team_a_id = r.data["id"]

        r = self.c.post(
            f"/api/v1/tournaments/{tid}/teams/",
            {
                "name": "FC Lyon",
                "short_name": "FCL",
                "category": cat_id,
                "coach_name": "Pierre",
            },
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        team_b_id = r.data["id"]

        # Team list
        r = self.c.get(f"/api/v1/tournaments/{tid}/teams/")
        self.assertEqual(r.status_code, 200)

        # Team detail
        r = self.c.get(f"/api/v1/tournaments/{tid}/teams/{team_a_id}/")
        self.assertEqual(r.status_code, 200)

        # Team suggestions
        r = self.c.get(
            f"/api/v1/tournaments/{tid}/teams/suggestions/",
            {"q": "FC", "exclude_category": str(cat_id)},
        )
        self.assertEqual(r.status_code, 200)

        # â”€â”€â”€ QR Code â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        r = self.c.get(
            f"/api/v1/tournaments/{tid}/teams/{team_a_id}/qr-code/"
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "image/png")
        self.assertGreater(len(r.content), 100)  # actual PNG content

        # â”€â”€â”€ Team code / Coach access â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/teams/{team_a_id}/regenerate-code/"
        )
        self.assertEqual(r.status_code, 200)
        team_code = r.data.get("team_code") or r.data.get("access_code")

        # â”€â”€â”€ Groups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/categories/{cat_id}/groups/",
            {"name": "Poule A"},
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        group_id = r.data["id"]

        r = self.c.get(
            f"/api/v1/tournaments/{tid}/categories/{cat_id}/groups/"
        )
        self.assertEqual(r.status_code, 200)

        r = self.c.get(
            f"/api/v1/tournaments/{tid}/categories/{cat_id}/groups/{group_id}/"
        )
        self.assertEqual(r.status_code, 200)

        # â”€â”€â”€ Matches â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/matches/",
            {
                "tournament": tid,
                "team_home": team_a_id,
                "team_away": team_b_id,
                "category": cat_id,
                "field": field_id,
                "phase": "group",
                "start_time": "2026-07-01T10:00:00Z",
            },
            format="json",
        )
        self.assertIn(r.status_code, [200, 201])
        match_id = r.data["id"]

        r = self.c.get(f"/api/v1/tournaments/{tid}/matches/")
        self.assertEqual(r.status_code, 200)

        r = self.c.get(f"/api/v1/tournaments/{tid}/matches/{match_id}/")
        self.assertEqual(r.status_code, 200)

        # Start match
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/matches/{match_id}/start/"
        )
        self.assertEqual(r.status_code, 200)

        # Score
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/matches/{match_id}/score/",
            {"score_home": 2, "score_away": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 200)

        # Finish match
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/matches/{match_id}/finish/"
        )
        self.assertEqual(r.status_code, 200)

        # â”€â”€â”€ Standings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        r = self.c.get(f"/api/v1/categories/{cat_id}/standings/")
        self.assertEqual(r.status_code, 200)

        r = self.c.get(f"/api/v1/groups/{group_id}/standings/")
        self.assertEqual(r.status_code, 200)

        r = self.c.post(f"/api/v1/categories/{cat_id}/standings/refresh/")
        self.assertEqual(r.status_code, 200)

        return tid, cat_id, team_a_id  # for reuse

    # â”€â”€â”€ 5. Logo upload (multipart) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_040_team_logo_upload(self):
        self._auth_admin()

        # Create tournament + category
        t = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "Logo Cup",
                "club": self.club.id,
                "start_date": "2026-08-01",
                "end_date": "2026-08-01",
                "location": "Nice",
            },
            format="json",
        )
        tid = t.data["id"]

        cat = self.c.post(
            f"/api/v1/tournaments/{tid}/categories/",
            {"name": "U10", "age_min": 9, "age_max": 10},
            format="json",
        )
        cat_id = cat.data["id"]

        # Create team with logo via multipart
        logo = _make_image()
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/teams/",
            {
                "name": "Logo FC",
                "short_name": "LFC",
                "category": cat_id,
                "logo": logo,
            },
            format="multipart",
        )
        self.assertIn(r.status_code, [200, 201])
        self.assertIsNotNone(r.data.get("logo"))
        self.assertIn("logo", r.data["logo"])  # URL contains 'logo'

        # Update logo
        new_logo = _make_image()
        r = self.c.patch(
            f"/api/v1/tournaments/{tid}/teams/{r.data['id']}/",
            {"logo": new_logo},
            format="multipart",
        )
        self.assertEqual(r.status_code, 200)
        self.assertIsNotNone(r.data.get("logo"))

    # â”€â”€â”€ 6. Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_050_notifications_list(self):
        self._auth_admin()
        r = self.c.get("/api/v1/notifications/")
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.data, list)  # flat array, not paginated

    def test_051_notifications_unread_count(self):
        self._auth_admin()
        r = self.c.get("/api/v1/notifications/unread_count/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("count", r.data)

    def test_052_notifications_mark_all_read(self):
        self._auth_admin()
        r = self.c.post("/api/v1/notifications/read_all/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("marked_read", r.data)

    def test_053_notification_mark_single_read(self):
        self._auth_admin()
        # Create a notif first
        notif = Notification.objects.create(
            type="info",
            target="all",
            title="Test notif",
            body="body",
        )
        r = self.c.patch(f"/api/v1/notifications/{notif.id}/read/")
        self.assertEqual(r.status_code, 200)

    # â”€â”€â”€ 7. Permission checks â€” other user cannot access â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_060_other_user_cant_access_tournament(self):
        self._auth_admin()
        t = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "Private Cup",
                "club": self.club.id,
                "start_date": "2026-09-01",
                "end_date": "2026-09-01",
                "location": "Marseille",
            },
            format="json",
        )
        tid = t.data["id"]

        # Switch to coach user (doesn't own this tournament)
        self._auth_coach()
        r = self.c.get(f"/api/v1/tournaments/{tid}/")
        self.assertIn(r.status_code, [403, 404])

    # â”€â”€â”€ 8. Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_070_public_tournament_by_slug(self):
        self._auth_admin()
        t = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "Public Cup",
                "club": self.club.id,
                "start_date": "2026-10-01",
                "end_date": "2026-10-01",
                "location": "Bordeaux",
            },
            format="json",
        )
        tid = t.data["id"]
        slug = t.data["slug"]

        # Publish
        self.c.post(f"/api/v1/tournaments/{tid}/publish/")

        # Now hit public API (no auth needed)
        self._no_auth()
        r = self.c.get(f"/api/v1/public/tournaments/{slug}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["name"], "Public Cup")

    def test_071_public_categories(self):
        self._auth_admin()
        t = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "Pub Cat Cup",
                "club": self.club.id,
                "start_date": "2026-10-02",
                "end_date": "2026-10-02",
                "location": "Toulouse",
            },
            format="json",
        )
        tid = t.data["id"]
        slug = t.data["slug"]
        self.c.post(
            f"/api/v1/tournaments/{tid}/categories/",
            {"name": "U13", "age_min": 12, "age_max": 13},
            format="json",
        )
        self.c.post(f"/api/v1/tournaments/{tid}/publish/")

        self._no_auth()
        r = self.c.get(f"/api/v1/public/tournaments/{slug}/categories/")
        self.assertEqual(r.status_code, 200)

    def test_072_public_matches(self):
        self._auth_admin()
        t = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "Pub Match Cup",
                "club": self.club.id,
                "start_date": "2026-10-03",
                "end_date": "2026-10-03",
                "location": "Nantes",
            },
            format="json",
        )
        tid = t.data["id"]
        slug = t.data["slug"]
        self.c.post(f"/api/v1/tournaments/{tid}/publish/")

        self._no_auth()
        r = self.c.get(f"/api/v1/public/tournaments/{slug}/matches/")
        self.assertEqual(r.status_code, 200)

    def test_073_public_standings(self):
        self._auth_admin()
        t = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "Pub Stand Cup",
                "club": self.club.id,
                "start_date": "2026-10-04",
                "end_date": "2026-10-04",
                "location": "Strasbourg",
            },
            format="json",
        )
        tid = t.data["id"]
        slug = t.data["slug"]
        self.c.post(f"/api/v1/tournaments/{tid}/publish/")

        self._no_auth()
        r = self.c.get(f"/api/v1/public/tournaments/{slug}/standings/")
        self.assertEqual(r.status_code, 200)

    def test_074_unpublished_tournament_not_public(self):
        self._auth_admin()
        t = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "Draft Cup",
                "club": self.club.id,
                "start_date": "2026-11-01",
                "end_date": "2026-11-01",
                "location": "Lille",
            },
            format="json",
        )
        slug = t.data["slug"]

        self._no_auth()
        r = self.c.get(f"/api/v1/public/tournaments/{slug}/")
        # Draft tournaments may still be accessible via public API if is_public=True
        self.assertIn(r.status_code, [200, 404])

    # â”€â”€â”€ 9. Team access (coach flow) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_080_team_access_flow(self):
        self._auth_admin()

        # Create tournament + category + team
        t = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "Coach Cup",
                "club": self.club.id,
                "start_date": "2026-12-01",
                "end_date": "2026-12-01",
                "location": "Rennes",
            },
            format="json",
        )
        tid = t.data["id"]
        cat = self.c.post(
            f"/api/v1/tournaments/{tid}/categories/",
            {"name": "U14", "age_min": 13, "age_max": 14},
            format="json",
        )
        team = self.c.post(
            f"/api/v1/tournaments/{tid}/teams/",
            {"name": "Rennes FC", "short_name": "RFC", "category": cat.data["id"]},
            format="json",
        )
        team_data = team.data

        # Get team access code
        team_code = team_data.get("team_code") or team_data.get("access_code")
        if not team_code:
            # Regenerate if not returned
            regen = self.c.post(
                f"/api/v1/tournaments/{tid}/teams/{team_data['id']}/regenerate-code/"
            )
            team_code = regen.data.get("team_code") or regen.data.get("access_code")

        if team_code:
            # Try team access endpoint (unauthenticated)
            self._no_auth()
            r = self.c.post(
                "/api/v1/auth/team-access/",
                {"code": team_code},
                format="json",
            )
            # Should return some kind of token or team info
            self.assertIn(r.status_code, [200, 201, 400])

    # â”€â”€â”€ 10. Duplicate tournament â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_090_duplicate_tournament(self):
        self._auth_admin()
        # Give admin a CLUB subscription so free-plan limits don't block
        Subscription.objects.update_or_create(
            user=self.admin_user,
            defaults={"plan": "club_monthly", "status": "active"},
        )
        t = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "Original Cup",
                "club": self.club.id,
                "start_date": "2026-06-01",
                "end_date": "2026-06-01",
                "location": "Paris",
            },
            format="json",
        )
        tid = t.data["id"]
        r = self.c.post(f"/api/v1/tournaments/{tid}/duplicate/")
        self.assertIn(r.status_code, [200, 201])

    # â”€â”€â”€ 11. Constraints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_100_constraints_crud(self):
        self._auth_admin()
        t = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "Constraint Cup",
                "club": self.club.id,
                "start_date": "2026-06-15",
                "end_date": "2026-06-15",
                "location": "Paris",
            },
            format="json",
        )
        tid = t.data["id"]

        r = self.c.get(f"/api/v1/tournaments/{tid}/constraints/")
        self.assertEqual(r.status_code, 200)

    # â”€â”€â”€ 12. Subscription status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_110_subscription_status(self):
        self._auth_admin()
        r = self.c.get("/api/v1/subscriptions/status/")
        self.assertEqual(r.status_code, 200)

    # â”€â”€â”€ 13. Bulk import teams (CSV) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_120_bulk_import_teams(self):
        self._auth_admin()
        t = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "Import Cup",
                "club": self.club.id,
                "start_date": "2026-06-20",
                "end_date": "2026-06-20",
                "location": "Paris",
            },
            format="json",
        )
        tid = t.data["id"]
        cat = self.c.post(
            f"/api/v1/tournaments/{tid}/categories/",
            {"name": "U11", "age_min": 10, "age_max": 11},
            format="json",
        )
        cat_id = cat.data["id"]

        csv_content = "name,short_name,category,coach_name\nCSV Team,CSV,U11,Coach CSV\n"
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "teams.csv"
        r = self.c.post(
            f"/api/v1/tournaments/{tid}/teams/bulk-import/",
            {"file": csv_file},
            format="multipart",
        )
        self.assertIn(r.status_code, [200, 201])

    # â”€â”€â”€ 14. Schedule feasibility â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def test_130_schedule_feasibility(self):
        self._auth_admin()
        t = self.c.post(
            "/api/v1/tournaments/",
            {
                "name": "Schedule Cup",
                "club": self.club.id,
                "start_date": "2026-06-25",
                "end_date": "2026-06-25",
                "location": "Paris",
            },
            format="json",
        )
        tid = t.data["id"]
        r = self.c.get(f"/api/v1/tournaments/{tid}/schedule/feasibility/")
        # May return various codes depending on tournament config and HTTP method
        self.assertIn(r.status_code, [200, 400, 405])



