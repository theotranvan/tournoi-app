"""Phase 03 – Groups API integration tests (CRUD + auto-generation)."""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from tests.factories import CategoryFactory, ClubFactory, GroupFactory, TeamFactory, TournamentFactory, UserFactory

from apps.subscriptions.models import Subscription


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    from django.core.cache import cache
    cache.clear()


def _make_user(username="org1", role="organizer"):
    user = UserFactory(username=username, role=role)
    user.set_password("testpass123")
    user.save()
    return user


@pytest.mark.django_db
class TestGroupsCRUD:
    def test_create_group(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        cat = CategoryFactory(tournament=t)
        api.force_authenticate(user=user)
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/categories/{cat.id}/groups/",
            {"name": "Poule A", "display_order": 0},
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.json()["name"] == "Poule A"

    def test_list_groups_with_teams(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        cat = CategoryFactory(tournament=t)
        group = GroupFactory(category=cat, name="Poule A")
        team = TeamFactory(tournament=t, category=cat)
        group.teams.add(team)
        api.force_authenticate(user=user)
        resp = api.get(f"/api/v1/tournaments/{t.id}/categories/{cat.id}/groups/")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()["results"]
        assert len(data) == 1
        assert len(data[0]["teams"]) == 1


@pytest.mark.django_db
class TestGroupGeneration:
    def test_generate_balanced_groups(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        cat = CategoryFactory(tournament=t)
        for i in range(6):
            TeamFactory(tournament=t, category=cat, name=f"Team {chr(65 + i)}")
        api.force_authenticate(user=user)
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/categories/{cat.id}/groups/generate-balanced/",
            {"num_groups": 2, "strategy": "balanced"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert len(data) == 2
        assert data[0]["name"] == "Poule A"
        assert data[1]["name"] == "Poule B"
        # Each group should have 3 teams
        assert len(data[0]["teams"]) == 3
        assert len(data[1]["teams"]) == 3

    def test_generate_too_few_teams(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        cat = CategoryFactory(tournament=t)
        TeamFactory(tournament=t, category=cat)
        api.force_authenticate(user=user)
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/categories/{cat.id}/groups/generate-balanced/",
            {"num_groups": 3, "strategy": "balanced"},
            format="json",
        )
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_generate_replaces_existing_groups(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        cat = CategoryFactory(tournament=t)
        GroupFactory(category=cat, name="Old Group")
        for i in range(4):
            TeamFactory(tournament=t, category=cat, name=f"Team {i}")
        api.force_authenticate(user=user)
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/categories/{cat.id}/groups/generate-balanced/",
            {"num_groups": 2, "strategy": "balanced"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        # Old group should be deleted, only new ones exist
        assert len(resp.json()) == 2


# ── Happy Path E2E ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestHappyPathE2E:
    """Full flow: register → club → tournament → categories → fields → teams → groups → publish."""

    def test_full_tournament_creation_flow(self, api):
        # 1. Register user
        resp = api.post("/api/v1/auth/register/", {
            "username": "theo",
            "email": "theo@test.com",
            "password": "Secure123!",
        })
        assert resp.status_code == status.HTTP_201_CREATED
        token = resp.json()["access"]
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # Give user a CLUB subscription so free-plan limits don't block
        from apps.accounts.models import User
        user = User.objects.get(username="theo")
        Subscription.objects.update_or_create(
            user=user,
            defaults={"plan": "club_monthly", "status": "active"},
        )

        # 2. Create club
        resp = api.post("/api/v1/clubs/", {"name": "FC Kickoff"})
        assert resp.status_code == status.HTTP_201_CREATED
        club_id = resp.json()["id"]

        # 3. Create tournament
        resp = api.post("/api/v1/tournaments/", {
            "club": club_id,
            "name": "Tournoi E2E",
            "location": "Stade Test",
            "start_date": "2026-06-01",
            "end_date": "2026-06-02",
        })
        assert resp.status_code == status.HTTP_201_CREATED
        t_id = resp.json()["id"]

        # 4. Bulk create categories
        resp = api.post(
            f"/api/v1/tournaments/{t_id}/categories/bulk-create/",
            {"categories": [{"name": "U8"}, {"name": "U10"}, {"name": "U13"}]},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        cats = resp.json()
        assert len(cats) == 3
        cat_u8_id = cats[0]["id"]
        cat_u10_id = cats[1]["id"]
        cat_u13_id = cats[2]["id"]

        # 5. Add field
        resp = api.post(
            f"/api/v1/tournaments/{t_id}/fields/",
            {
                "name": "Terrain A",
                "availability": [
                    {"date": "2026-06-01", "start": "08:00", "end": "19:00"},
                    {"date": "2026-06-02", "start": "08:00", "end": "17:00"},
                ],
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED

        # 6. Add teams (2 per category minimum for publish)
        for cat_id in (cat_u8_id, cat_u10_id, cat_u13_id):
            for j in range(4):
                resp = api.post(
                    f"/api/v1/tournaments/{t_id}/teams/",
                    {"category": cat_id, "name": f"Team {cat_id}-{j}"},
                )
                assert resp.status_code == status.HTTP_201_CREATED

        # 7. Generate groups for U8
        resp = api.post(
            f"/api/v1/tournaments/{t_id}/categories/{cat_u8_id}/groups/generate-balanced/",
            {"num_groups": 2, "strategy": "balanced"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        groups = resp.json()
        assert len(groups) == 2

        # 8. Publish tournament
        resp = api.post(f"/api/v1/tournaments/{t_id}/publish/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["status"] == "published"
