"""API tests for clubs CRUD."""

import pytest
from rest_framework.test import APIClient

from apps.clubs.models import Club
from tests.factories import ClubFactory, UserFactory


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
def club(organizer):
    return ClubFactory(owner=organizer)


@pytest.mark.django_db
class TestClubList:
    def test_list_own_clubs(self, api, club):
        resp = api.get("/api/v1/clubs/")
        assert resp.status_code == 200
        slugs = [c["slug"] for c in resp.data["results"]]
        assert club.slug in slugs

    def test_list_requires_auth(self, anon_api):
        resp = anon_api.get("/api/v1/clubs/")
        assert resp.status_code in (401, 403)

    def test_other_user_cannot_see_club(self, club):
        other = UserFactory()
        c = APIClient()
        c.force_authenticate(user=other)
        resp = c.get("/api/v1/clubs/")
        assert resp.status_code == 200
        slugs = [cl["slug"] for cl in resp.data["results"]]
        assert club.slug not in slugs


@pytest.mark.django_db
class TestClubCreate:
    def test_create_club(self, api, organizer):
        resp = api.post(
            "/api/v1/clubs/",
            {"name": "Mon Club", "contact_email": "club@test.com"},
            format="json",
        )
        assert resp.status_code == 201
        assert Club.objects.filter(owner=organizer, name="Mon Club").exists()


@pytest.mark.django_db
class TestClubUpdate:
    def test_update_own_club(self, api, club):
        resp = api.patch(
            f"/api/v1/clubs/{club.id}/",
            {"name": "Nouveau Nom"},
            format="json",
        )
        assert resp.status_code == 200
        club.refresh_from_db()
        assert club.name == "Nouveau Nom"

    def test_non_member_cannot_update(self, club):
        other = UserFactory()
        c = APIClient()
        c.force_authenticate(user=other)
        resp = c.patch(
            f"/api/v1/clubs/{club.id}/",
            {"name": "Hack"},
            format="json",
        )
        assert resp.status_code in (403, 404)


@pytest.mark.django_db
class TestClubDelete:
    def test_delete_own_club(self, api, club):
        resp = api.delete(f"/api/v1/clubs/{club.id}/")
        assert resp.status_code == 204
        assert not Club.objects.filter(id=club.id).exists()

    def test_non_owner_cannot_delete(self, club):
        other = UserFactory()
        c = APIClient()
        c.force_authenticate(user=other)
        resp = c.delete(f"/api/v1/clubs/{club.id}/")
        assert resp.status_code in (403, 404)
