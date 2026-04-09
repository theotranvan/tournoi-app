"""API tests for scheduling endpoints."""

import pytest
from rest_framework.test import APIClient

from apps.tournaments.models import Tournament
from tests.factories import (
    CategoryFactory,
    ClubFactory,
    FieldFactory,
    MatchFactory,
    TeamFactory,
    TournamentFactory,
    UserFactory,
)
from apps.scheduling.tests.conftest import make_tournament


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    """Reset DRF throttle cache between tests so rate limits don't leak."""
    from django.core.cache import cache
    cache.clear()


@pytest.fixture
def organizer(db):
    return UserFactory()


@pytest.fixture
def api(organizer):
    c = APIClient()
    c.force_authenticate(user=organizer)
    return c


@pytest.fixture
def anon_api():
    return APIClient()


@pytest.fixture
def ready_tournament(organizer):
    """Tournament with categories, teams, groups, and fields — ready for scheduling."""
    return make_tournament(organizer, n_categories=1, teams_per_cat=4, n_fields=2)


# ── Generate endpoint ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestGenerateSchedule:
    def test_generate_sync(self, api, ready_tournament):
        url = f"/api/v1/tournaments/{ready_tournament.id}/schedule/generate/"
        resp = api.post(url, {"strategy": "balanced", "async_mode": False}, format="json")
        assert resp.status_code == 200
        assert resp.data["success"] is True
        assert resp.data["stats"]["total_matches"] > 0

    def test_generate_requires_auth(self, anon_api, ready_tournament):
        url = f"/api/v1/tournaments/{ready_tournament.id}/schedule/generate/"
        resp = anon_api.post(url, {"strategy": "balanced", "async_mode": False}, format="json")
        assert resp.status_code in (401, 403)

    def test_generate_invalid_strategy(self, api, ready_tournament):
        """Strategy parameter is now ignored by the new engine — any value succeeds."""
        url = f"/api/v1/tournaments/{ready_tournament.id}/schedule/generate/"
        resp = api.post(url, {"strategy": "invalid_xyz", "async_mode": False}, format="json")
        # New engine ignores strategy field; generation succeeds if tournament is valid
        assert resp.status_code == 200


# ── Schedule list endpoint ───────────────────────────────────────────────────


@pytest.mark.django_db
class TestScheduleList:
    def test_list_empty_schedule(self, api, ready_tournament):
        url = f"/api/v1/tournaments/{ready_tournament.id}/schedule/"
        resp = api.get(url)
        assert resp.status_code == 200
        # ScheduleListView now returns a list of ScheduleDay dicts
        assert isinstance(resp.data, list)
        assert len(resp.data) == 0

    def test_list_after_generate(self, api, ready_tournament):
        gen_url = f"/api/v1/tournaments/{ready_tournament.id}/schedule/generate/"
        gen_resp = api.post(gen_url, {"strategy": "balanced", "async_mode": False}, format="json")
        assert gen_resp.status_code == 200
        url = f"/api/v1/tournaments/{ready_tournament.id}/schedule/"
        resp = api.get(url)
        assert resp.status_code == 200
        assert isinstance(resp.data, list)
        total_matches = sum(
            len(f["matches"]) for day in resp.data for f in day["fields"]
        )
        assert total_matches > 0

    def test_list_requires_auth(self, anon_api, ready_tournament):
        url = f"/api/v1/tournaments/{ready_tournament.id}/schedule/"
        resp = anon_api.get(url)
        assert resp.status_code in (401, 403)


# ── Conflicts endpoint ──────────────────────────────────────────────────────


@pytest.mark.django_db
class TestScheduleConflicts:
    def test_no_conflicts_empty_schedule(self, api, ready_tournament):
        url = f"/api/v1/tournaments/{ready_tournament.id}/schedule/conflicts/"
        resp = api.get(url)
        assert resp.status_code == 200
        assert resp.data["count"] == 0


# ── Feasibility endpoint ────────────────────────────────────────────────────


@pytest.mark.django_db
class TestScheduleFeasibility:
    def test_feasibility_check(self, api, ready_tournament):
        url = f"/api/v1/tournaments/{ready_tournament.id}/schedule/feasibility/"
        resp = api.get(url)
        assert resp.status_code == 200
        assert "feasible" in resp.data or "total_matches" in resp.data


# ── Diagnostics endpoint ────────────────────────────────────────────────────


@pytest.mark.django_db
class TestScheduleDiagnostics:
    def test_diagnostics_after_generate(self, api, ready_tournament):
        gen_url = f"/api/v1/tournaments/{ready_tournament.id}/schedule/generate/"
        api.post(gen_url, {"strategy": "balanced", "async_mode": False}, format="json")
        url = f"/api/v1/tournaments/{ready_tournament.id}/schedule/diagnostics/"
        resp = api.get(url)
        assert resp.status_code == 200
