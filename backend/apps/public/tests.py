"""Tests for public app — unauthenticated tournament access."""

import pytest
from django.utils import timezone

from rest_framework.test import APIClient

from apps.matches.models import Match
from tests.factories import (
    CategoryFactory,
    ClubFactory,
    FieldFactory,
    GoalFactory,
    GroupFactory,
    MatchFactory,
    TeamFactory,
    TournamentFactory,
    UserFactory,
)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def organizer(db):
    return UserFactory()


@pytest.fixture
def public_tournament(organizer):
    club = ClubFactory(owner=organizer)
    return TournamentFactory(
        club=club,
        slug="public-cup",
        is_public=True,
    )


@pytest.fixture
def private_tournament(organizer):
    club = ClubFactory(owner=organizer)
    return TournamentFactory(
        club=club,
        slug="private-cup",
        is_public=False,
    )


@pytest.fixture
def tournament_with_data(public_tournament):
    """Public tournament with categories, teams, groups, and matches."""
    t = public_tournament
    cat = CategoryFactory(tournament=t, name="U12")
    field = FieldFactory(tournament=t, name="Terrain A")
    group = GroupFactory(category=cat, name="A")
    t1 = TeamFactory(tournament=t, category=cat, name="Eagles")
    t2 = TeamFactory(tournament=t, category=cat, name="Hawks")
    group.teams.add(t1, t2)

    # Scheduled match
    m_scheduled = MatchFactory(
        tournament=t,
        category=cat,
        group=group,
        team_home=t1,
        team_away=t2,
        field=field,
        status=Match.Status.SCHEDULED,
        start_time=timezone.now() + timezone.timedelta(hours=1),
    )
    # Live match
    m_live = MatchFactory(
        tournament=t,
        category=cat,
        group=group,
        team_home=t2,
        team_away=t1,
        field=field,
        status=Match.Status.LIVE,
        start_time=timezone.now(),
    )
    # Finished match
    m_finished = MatchFactory(
        tournament=t,
        category=cat,
        group=group,
        team_home=t1,
        team_away=t2,
        field=field,
        status=Match.Status.FINISHED,
        start_time=timezone.now() - timezone.timedelta(hours=1),
        score_home=2,
        score_away=1,
    )

    return {
        "tournament": t,
        "category": cat,
        "field": field,
        "group": group,
        "team1": t1,
        "team2": t2,
        "match_scheduled": m_scheduled,
        "match_live": m_live,
        "match_finished": m_finished,
    }


# ─── Public Tournament View ─────────────────────────────────────────────────


@pytest.mark.django_db
class TestPublicTournamentView:
    def test_get_public_tournament_without_auth(self, api, public_tournament):
        resp = api.get(f"/api/v1/public/tournaments/{public_tournament.slug}/")
        assert resp.status_code == 200
        assert resp.data["slug"] == public_tournament.slug
        assert resp.data["name"] == public_tournament.name

    def test_private_tournament_returns_404(self, api, private_tournament):
        resp = api.get(f"/api/v1/public/tournaments/{private_tournament.slug}/")
        assert resp.status_code == 404

    def test_nonexistent_slug_returns_404(self, api):
        resp = api.get("/api/v1/public/tournaments/no-such-tournament/")
        assert resp.status_code == 404

    def test_response_includes_categories(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        resp = api.get(f"/api/v1/public/tournaments/{slug}/")
        assert resp.status_code == 200
        cats = resp.data["categories"]
        assert len(cats) >= 1
        assert cats[0]["name"] == "U12"


# ─── Public Categories View ─────────────────────────────────────────────────


@pytest.mark.django_db
class TestPublicCategoriesView:
    def test_list_categories(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        resp = api.get(f"/api/v1/public/tournaments/{slug}/categories/")
        assert resp.status_code == 200
        assert isinstance(resp.data, list)
        names = [c["name"] for c in resp.data]
        assert "U12" in names

    def test_private_tournament_returns_404(self, api, private_tournament):
        resp = api.get(f"/api/v1/public/tournaments/{private_tournament.slug}/categories/")
        assert resp.status_code == 404


# ─── Public Matches View ────────────────────────────────────────────────────


@pytest.mark.django_db
class TestPublicMatchesView:
    def test_list_matches(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        resp = api.get(f"/api/v1/public/tournaments/{slug}/matches/")
        assert resp.status_code == 200
        assert len(resp.data) == 3

    def test_filter_by_status(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        resp = api.get(f"/api/v1/public/tournaments/{slug}/matches/?status=live")
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["status"] == "live"

    def test_filter_by_category(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        cat_id = tournament_with_data["category"].id
        resp = api.get(f"/api/v1/public/tournaments/{slug}/matches/?category={cat_id}")
        assert resp.status_code == 200
        assert len(resp.data) == 3

    def test_response_does_not_contain_access_code(self, api, tournament_with_data):
        """Public match responses should not leak team access codes."""
        slug = tournament_with_data["tournament"].slug
        resp = api.get(f"/api/v1/public/tournaments/{slug}/matches/")
        assert resp.status_code == 200
        raw = str(resp.data)
        assert "access_code" not in raw

    def test_private_tournament_returns_404(self, api, private_tournament):
        resp = api.get(f"/api/v1/public/tournaments/{private_tournament.slug}/matches/")
        assert resp.status_code == 404


# ─── Public Standings View ───────────────────────────────────────────────────


@pytest.mark.django_db
class TestPublicStandingsView:
    def test_get_standings(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        resp = api.get(f"/api/v1/public/tournaments/{slug}/standings/")
        assert resp.status_code == 200
        assert isinstance(resp.data, list)
        assert len(resp.data) >= 1
        assert "category" in resp.data[0]
        assert "groups" in resp.data[0]

    def test_standings_contain_group_data(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        resp = api.get(f"/api/v1/public/tournaments/{slug}/standings/")
        groups = resp.data[0]["groups"]
        assert len(groups) >= 1
        assert "group" in groups[0]
        assert "standings" in groups[0]

    def test_private_tournament_returns_404(self, api, private_tournament):
        resp = api.get(f"/api/v1/public/tournaments/{private_tournament.slug}/standings/")
        assert resp.status_code == 404


# ─── Public Live View ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestPublicLiveView:
    def test_live_view_returns_categorized_matches(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        resp = api.get(f"/api/v1/public/tournaments/{slug}/live/")
        assert resp.status_code == 200
        assert "live_matches" in resp.data
        assert "upcoming_matches" in resp.data
        assert "recent_results" in resp.data

    def test_live_matches_contain_live(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        resp = api.get(f"/api/v1/public/tournaments/{slug}/live/")
        live = resp.data["live_matches"]
        assert len(live) == 1
        assert live[0]["status"] == "live"

    def test_upcoming_matches(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        resp = api.get(f"/api/v1/public/tournaments/{slug}/live/")
        upcoming = resp.data["upcoming_matches"]
        assert len(upcoming) == 1
        assert upcoming[0]["status"] == "scheduled"

    def test_recent_results(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        resp = api.get(f"/api/v1/public/tournaments/{slug}/live/")
        recent = resp.data["recent_results"]
        assert len(recent) == 1
        assert recent[0]["status"] == "finished"

    def test_private_tournament_returns_404(self, api, private_tournament):
        resp = api.get(f"/api/v1/public/tournaments/{private_tournament.slug}/live/")
        assert resp.status_code == 404


# ─── Public Team View ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestPublicTeamView:
    def test_get_team_with_matches(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        team_id = tournament_with_data["team1"].id
        resp = api.get(f"/api/v1/public/tournaments/{slug}/teams/{team_id}/")
        assert resp.status_code == 200
        assert "team" in resp.data
        assert "matches" in resp.data
        assert resp.data["team"]["name"] == "Eagles"
        assert len(resp.data["matches"]) >= 1

    def test_team_response_does_not_contain_access_code(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        team_id = tournament_with_data["team1"].id
        resp = api.get(f"/api/v1/public/tournaments/{slug}/teams/{team_id}/")
        assert resp.status_code == 200
        raw = str(resp.data)
        assert "access_code" not in raw

    def test_nonexistent_team_returns_404(self, api, public_tournament):
        resp = api.get(f"/api/v1/public/tournaments/{public_tournament.slug}/teams/999999/")
        assert resp.status_code == 404

    def test_private_tournament_returns_404(self, api, private_tournament):
        resp = api.get(f"/api/v1/public/tournaments/{private_tournament.slug}/teams/1/")
        assert resp.status_code == 404


# ─── Public Match Detail View ────────────────────────────────────────────────


@pytest.mark.django_db
class TestPublicMatchDetailView:
    def test_get_match_detail(self, api, tournament_with_data):
        slug = tournament_with_data["tournament"].slug
        match_id = tournament_with_data["match_finished"].id
        resp = api.get(f"/api/v1/public/tournaments/{slug}/matches/{match_id}/")
        assert resp.status_code == 200
        assert resp.data["id"] == str(match_id)
        assert resp.data["score_home"] == 2
        assert resp.data["score_away"] == 1

    def test_match_with_goals(self, api, tournament_with_data):
        match = tournament_with_data["match_finished"]
        slug = tournament_with_data["tournament"].slug
        GoalFactory(
            match=match,
            team=tournament_with_data["team1"],
            player_name="Théo",
            minute=10,
        )

        resp = api.get(f"/api/v1/public/tournaments/{slug}/matches/{match.id}/")
        assert resp.status_code == 200
        assert len(resp.data["goals"]) == 1
        assert resp.data["goals"][0]["player_name"] == "Théo"

    def test_nonexistent_match_returns_404(self, api, public_tournament):
        resp = api.get(
            f"/api/v1/public/tournaments/{public_tournament.slug}/matches/00000000-0000-0000-0000-000000000000/"
        )
        assert resp.status_code == 404


# ─── Health Check ────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestHealthCheck:
    def test_health_check(self, api):
        resp = api.get("/api/v1/public/health/")
        assert resp.status_code == 200
        assert resp.data["status"] == "ok"


# ─── By-Code Tests ───────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestPublicByCode:
    def test_by_code_returns_tournament(self, api, public_tournament):
        public_tournament.public_code = "TEST01"
        public_tournament.save()
        resp = api.get("/api/v1/public/tournaments/by-code/TEST01/")
        assert resp.status_code == 200
        assert resp.data["slug"] == public_tournament.slug

    def test_by_code_works_even_if_not_public(self, api, organizer):
        club = ClubFactory(owner=organizer)
        t = TournamentFactory(club=club, is_public=False, public_code="PRIV01")
        resp = api.get("/api/v1/public/tournaments/by-code/PRIV01/")
        assert resp.status_code == 200
        assert resp.data["slug"] == t.slug

    def test_by_code_case_insensitive(self, api, public_tournament):
        public_tournament.public_code = "ABC123"
        public_tournament.save()
        resp = api.get("/api/v1/public/tournaments/by-code/abc123/")
        assert resp.status_code == 200

    def test_by_code_invalid_returns_404(self, api):
        resp = api.get("/api/v1/public/tournaments/by-code/ZZZZZZ/")
        assert resp.status_code == 404
