"""Tests for teams app — models, serializers, group generation, access code."""

import io

import pytest
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient

from apps.teams.models import Group, Team, generate_access_code
from apps.teams.serializers import (
    GroupSerializer,
    TeamAdminSerializer,
    TeamBriefSerializer,
    TeamSerializer,
)
from tests.factories import (
    CategoryFactory,
    ClubFactory,
    TeamFactory,
    TournamentFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture(autouse=True)
def _clear_throttle():
    cache.clear()


@pytest.fixture
def setup():
    user = UserFactory()
    club = ClubFactory(owner=user)
    tournament = TournamentFactory(club=club)
    category = CategoryFactory(tournament=tournament, name="U12")
    return {"user": user, "tournament": tournament, "category": category}


# ── Model ────────────────────────────────────────────────────────────────────


class TestTeamModel:
    def test_access_code_auto_generated(self, setup):
        team = Team.objects.create(
            tournament=setup["tournament"],
            category=setup["category"],
            name="Auto Code FC",
        )
        assert len(team.access_code) == 8
        assert team.access_code.isalnum()

    def test_access_code_excludes_ambiguous(self):
        for _ in range(50):
            code = generate_access_code()
            assert "O" not in code
            assert "0" not in code
            assert "I" not in code
            assert "1" not in code

    def test_unique_together_name(self, setup):
        from django.db import IntegrityError

        Team.objects.create(
            tournament=setup["tournament"],
            category=setup["category"],
            name="Unique FC",
        )
        with pytest.raises(IntegrityError):
            Team.objects.create(
                tournament=setup["tournament"],
                category=setup["category"],
                name="Unique FC",
            )

    def test_str(self, setup):
        team = TeamFactory(
            tournament=setup["tournament"],
            category=setup["category"],
            name="Eagles",
        )
        assert "Eagles" in str(team)
        assert "U12" in str(team)


class TestGroupModel:
    def test_unique_together_group_name(self, setup):
        from django.db import IntegrityError

        Group.objects.create(category=setup["category"], name="Poule A")
        with pytest.raises(IntegrityError):
            Group.objects.create(category=setup["category"], name="Poule A")

    def test_str(self, setup):
        g = Group.objects.create(category=setup["category"], name="Poule X")
        assert "U12" in str(g)
        assert "Poule X" in str(g)


# ── Serializers ──────────────────────────────────────────────────────────────


class TestTeamSerializers:
    def test_team_serializer_hides_access_code(self, setup):
        team = TeamFactory(tournament=setup["tournament"], category=setup["category"])
        data = TeamSerializer(team).data
        assert "access_code" not in data
        assert "name" in data

    def test_team_admin_serializer_shows_access_code(self, setup):
        team = TeamFactory(tournament=setup["tournament"], category=setup["category"])
        data = TeamAdminSerializer(team).data
        assert "access_code" in data
        assert data["access_code"] == team.access_code

    def test_team_brief_serializer(self, setup):
        team = TeamFactory(tournament=setup["tournament"], category=setup["category"])
        data = TeamBriefSerializer(team).data
        assert data["name"] == team.name
        assert "access_code" not in data
        assert data["category"]["name"] == "U12"


# ── Group Generation API ────────────────────────────────────────────────────


class TestGroupGenerationAPI:
    def test_generate_balanced_creates_groups(self, api, setup):
        t = setup["tournament"]
        cat = setup["category"]
        for i in range(4):
            TeamFactory(tournament=t, category=cat, name=f"Team {i}")
        api.force_authenticate(user=setup["user"])
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/categories/{cat.id}/groups/generate-balanced/",
            {"num_groups": 2},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert len(resp.data) == 2
        total_teams = sum(len(g["teams"]) for g in resp.data)
        assert total_teams == 4

    def test_generate_balanced_not_enough_teams(self, api, setup):
        t = setup["tournament"]
        cat = setup["category"]
        TeamFactory(tournament=t, category=cat)
        api.force_authenticate(user=setup["user"])
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/categories/{cat.id}/groups/generate-balanced/",
            {"num_groups": 3},
            format="json",
        )
        assert resp.status_code == 422  # BusinessRuleViolation

    def test_generate_balanced_replaces_old_groups(self, api, setup):
        t = setup["tournament"]
        cat = setup["category"]
        for i in range(6):
            TeamFactory(tournament=t, category=cat, name=f"T{i}")
        Group.objects.create(category=cat, name="Old Group")
        api.force_authenticate(user=setup["user"])
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/categories/{cat.id}/groups/generate-balanced/",
            {"num_groups": 3},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert not Group.objects.filter(category=cat, name="Old Group").exists()


# ── Team Actions API ─────────────────────────────────────────────────────────


class TestTeamActionsAPI:
    def test_regenerate_code_changes_code(self, api, setup):
        t = setup["tournament"]
        team = TeamFactory(tournament=t, category=setup["category"])
        old_code = team.access_code
        api.force_authenticate(user=setup["user"])
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/teams/{team.id}/regenerate-code/",
        )
        assert resp.status_code == 200
        assert resp.data["access_code"] != old_code

    def test_qr_code_returns_png(self, api, setup):
        t = setup["tournament"]
        team = TeamFactory(tournament=t, category=setup["category"])
        resp = api.get(f"/api/v1/tournaments/{t.id}/teams/{team.id}/qr-code/")
        assert resp.status_code == 200
        assert resp["content-type"] == "image/png"

    def test_suggestions_returns_names(self, api, setup):
        t = setup["tournament"]
        TeamFactory(tournament=t, category=setup["category"], name="Eagles")
        TeamFactory(tournament=t, category=setup["category"], name="Hawks")
        api.force_authenticate(user=setup["user"])
        resp = api.get(f"/api/v1/tournaments/{t.id}/teams/suggestions/")
        assert resp.status_code == 200
        assert "Eagles" in resp.data

    def test_bulk_import_csv(self, api, setup):
        t = setup["tournament"]
        cat = setup["category"]
        api.force_authenticate(user=setup["user"])
        csv_content = "category,name,short_name,coach_name,coach_phone,coach_email\n"
        csv_content += f"{cat.name},Import FC,IFC,Coach X,0600000000,coach@test.com\n"
        csv_file = io.BytesIO(csv_content.encode("utf-8"))
        csv_file.name = "teams.csv"
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/teams/bulk-import/",
            {"file": csv_file},
            format="multipart",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["count"] == 1
        assert Team.objects.filter(tournament=t, name="Import FC").exists()

    def test_bulk_import_no_file_rejected(self, api, setup):
        t = setup["tournament"]
        api.force_authenticate(user=setup["user"])
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/teams/bulk-import/",
            {},
            format="multipart",
        )
        assert resp.status_code == 422
