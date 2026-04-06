"""Phase 03 – Teams API integration tests (CSV import, QR code, regenerate-code)."""


import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient

from tests.factories import CategoryFactory, ClubFactory, TeamFactory, TournamentFactory, UserFactory


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


def _setup(user):
    """Create club + tournament + category owned by user."""
    club = ClubFactory(owner=user)
    t = TournamentFactory(club=club)
    cat = CategoryFactory(tournament=t, name="U10")
    return club, t, cat


@pytest.mark.django_db
class TestTeamsCRUD:
    def test_create_team(self, api):
        user = _make_user()
        _, t, cat = _setup(user)
        api.force_authenticate(user=user)
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/teams/",
            {"category": cat.id, "name": "FC Soleil"},
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["name"] == "FC Soleil"
        # Admin serializer exposes access_code
        assert "access_code" in data
        assert "qr_code_url" in data

    def test_list_teams_with_filters(self, api):
        user = _make_user()
        _, t, cat = _setup(user)
        TeamFactory(tournament=t, category=cat, name="Alpha")
        TeamFactory(tournament=t, category=cat, name="Beta")
        api.force_authenticate(user=user)

        # Filter by search
        resp = api.get(f"/api/v1/tournaments/{t.id}/teams/?search=alpha")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.json()["results"]) == 1

    def test_regenerate_code(self, api):
        user = _make_user()
        _, t, cat = _setup(user)
        team = TeamFactory(tournament=t, category=cat)
        old_code = team.access_code
        api.force_authenticate(user=user)
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/teams/{team.id}/regenerate-code/"
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["access_code"] != old_code


@pytest.mark.django_db
class TestTeamQRCode:
    def test_qr_code_returns_png(self, api):
        user = _make_user()
        _, t, cat = _setup(user)
        team = TeamFactory(tournament=t, category=cat)
        api.force_authenticate(user=user)
        resp = api.get(f"/api/v1/tournaments/{t.id}/teams/{team.id}/qr-code/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp["Content-Type"] == "image/png"
        # PNG magic bytes
        assert resp.content[:4] == b"\x89PNG"


@pytest.mark.django_db
class TestTeamBulkImport:
    def test_bulk_import_csv_success(self, api):
        user = _make_user()
        _, t, cat = _setup(user)
        csv_content = "name,category,short_name,coach_name\nFC Alpha,U10,Alpha,Coach A\nFC Beta,U10,Beta,Coach B\n"
        csv_file = SimpleUploadedFile("teams.csv", csv_content.encode("utf-8"), content_type="text/csv")
        api.force_authenticate(user=user)
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/teams/bulk-import/",
            {"file": csv_file},
            format="multipart",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["count"] == 2
        assert len(data["errors"]) == 0

    def test_bulk_import_csv_partial_errors(self, api):
        user = _make_user()
        _, t, cat = _setup(user)
        csv_content = "name,category\nFC OK,U10\nFC Bad,NONEXIST\n,U10\n"
        csv_file = SimpleUploadedFile("teams.csv", csv_content.encode("utf-8"), content_type="text/csv")
        api.force_authenticate(user=user)
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/teams/bulk-import/",
            {"file": csv_file},
            format="multipart",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["count"] == 1
        assert len(data["errors"]) == 2  # bad category + missing name

    def test_bulk_import_no_file(self, api):
        user = _make_user()
        _, t, _ = _setup(user)
        api.force_authenticate(user=user)
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/teams/bulk-import/",
            {},
            format="multipart",
        )
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
