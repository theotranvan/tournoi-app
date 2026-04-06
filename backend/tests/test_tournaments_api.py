"""Phase 03 – Tournaments & Categories API integration tests."""

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from tests.factories import CategoryFactory, ClubFactory, FieldFactory, TeamFactory, TournamentFactory, UserFactory

from apps.subscriptions.models import Subscription


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture(autouse=True)
def _no_password_validators(settings):
    settings.AUTH_PASSWORD_VALIDATORS = []


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    from django.core.cache import cache
    cache.clear()


def _make_user(username="org1", role="organizer"):
    user = UserFactory(username=username, role=role)
    user.set_password("testpass123")
    user.save()
    return user


# ── Clubs ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestClubsCRUD:
    def test_create_club(self, api):
        user = _make_user()
        api.force_authenticate(user=user)
        resp = api.post("/api/v1/clubs/", {"name": "FC Test", "contact_email": "a@b.com"})
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["name"] == "FC Test"
        assert data["owner"]["id"] == user.id
        assert data["slug"] == "fc-test"

    def test_list_clubs_filtered_by_membership(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        ClubFactory()  # another club, not owned
        api.force_authenticate(user=user)
        resp = api.get("/api/v1/clubs/")
        assert resp.status_code == status.HTTP_200_OK
        ids = [c["id"] for c in resp.json()["results"]]
        assert club.id in ids
        assert len(ids) == 1

    def test_update_club_as_owner(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        api.force_authenticate(user=user)
        resp = api.patch(f"/api/v1/clubs/{club.id}/", {"name": "Renamed"})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["name"] == "Renamed"

    def test_non_member_cannot_see_club(self, api):
        user = _make_user()
        other = _make_user("other")
        ClubFactory(owner=other)
        api.force_authenticate(user=user)
        resp = api.get("/api/v1/clubs/")
        assert len(resp.json()["results"]) == 0


# ── Tournaments ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTournamentsCRUD:
    def test_create_tournament(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        api.force_authenticate(user=user)
        resp = api.post("/api/v1/tournaments/", {
            "club": club.id,
            "name": "Tournoi Printemps",
            "location": "Stade Municipal",
            "start_date": "2026-04-11",
            "end_date": "2026-04-12",
        })
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["name"] == "Tournoi Printemps"
        assert data["status"] == "draft"

    def test_create_tournament_invalid_dates(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        api.force_authenticate(user=user)
        resp = api.post("/api/v1/tournaments/", {
            "club": club.id,
            "name": "Bad dates",
            "location": "X",
            "start_date": "2026-04-12",
            "end_date": "2026-04-11",
        })
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_list_tournaments_filtered_by_club(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t1 = TournamentFactory(club=club)
        TournamentFactory()  # other club
        api.force_authenticate(user=user)
        resp = api.get(f"/api/v1/tournaments/?club={club.id}")
        assert resp.status_code == status.HTTP_200_OK
        ids = [t["id"] for t in resp.json()["results"]]
        assert str(t1.id) in ids

    def test_tournament_has_counters(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        CategoryFactory(tournament=t)
        FieldFactory(tournament=t)
        api.force_authenticate(user=user)
        resp = api.get(f"/api/v1/tournaments/{t.id}/")
        data = resp.json()
        assert data["nb_categories"] == 1
        assert data["nb_fields"] == 1

    def test_update_forbidden_when_live(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club, status="live")
        api.force_authenticate(user=user)
        resp = api.patch(f"/api/v1/tournaments/{t.id}/", {"name": "New name"})
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_delete_soft_deletes(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        api.force_authenticate(user=user)
        resp = api.delete(f"/api/v1/tournaments/{t.id}/")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        t.refresh_from_db()
        assert t.status == "archived"

    def test_permission_other_user_cannot_access(self, api):
        user = _make_user()
        other = _make_user("other_org")
        club = ClubFactory(owner=other)
        TournamentFactory(club=club)
        api.force_authenticate(user=user)
        resp = api.get("/api/v1/tournaments/")
        assert len(resp.json()["results"]) == 0


# ── Tournament Actions ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestTournamentActions:
    def test_publish_validates_prerequisites(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club, status="draft")
        api.force_authenticate(user=user)
        resp = api.post(f"/api/v1/tournaments/{t.id}/publish/")
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_publish_success(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club, status="draft")
        cat = CategoryFactory(tournament=t)
        FieldFactory(tournament=t)
        TeamFactory(tournament=t, category=cat, name="T1")
        TeamFactory(tournament=t, category=cat, name="T2")
        api.force_authenticate(user=user)
        resp = api.post(f"/api/v1/tournaments/{t.id}/publish/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["status"] == "published"

    def test_start_requires_published(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club, status="draft")
        api.force_authenticate(user=user)
        resp = api.post(f"/api/v1/tournaments/{t.id}/start/")
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_duplicate(self, api):
        user = _make_user()
        Subscription.objects.update_or_create(
            user=user, defaults={"plan": "club_monthly", "status": "active"},
        )
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        CategoryFactory(tournament=t, name="U10")
        FieldFactory(tournament=t, name="Terrain A")
        api.force_authenticate(user=user)
        resp = api.post(f"/api/v1/tournaments/{t.id}/duplicate/")
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert "(copie)" in data["name"]
        assert data["nb_categories"] == 1
        assert data["nb_fields"] == 1


# ── Categories ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCategoriesCRUD:
    def test_create_category(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        api.force_authenticate(user=user)
        resp = api.post(f"/api/v1/tournaments/{t.id}/categories/", {
            "name": "U10",
            "display_order": 0,
        })
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.json()["name"] == "U10"

    def test_bulk_create(self, api):
        user = _make_user()
        Subscription.objects.update_or_create(
            user=user, defaults={"plan": "club_monthly", "status": "active"},
        )
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        api.force_authenticate(user=user)
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/categories/bulk-create/",
            {"categories": [{"name": "U8"}, {"name": "U10"}, {"name": "U13"}]},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert len(resp.json()) == 3

    def test_duplicate_name_fails(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        CategoryFactory(tournament=t, name="U10")
        api.force_authenticate(user=user)
        resp = api.post(f"/api/v1/tournaments/{t.id}/categories/", {
            "name": "U10",
        })
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_delete_category_with_teams_fails(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        cat = CategoryFactory(tournament=t)
        TeamFactory(tournament=t, category=cat)
        api.force_authenticate(user=user)
        resp = api.delete(f"/api/v1/tournaments/{t.id}/categories/{cat.id}/")
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_effective_durations_in_response(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club, default_match_duration=20)
        cat = CategoryFactory(tournament=t, match_duration=None)
        api.force_authenticate(user=user)
        resp = api.get(f"/api/v1/tournaments/{t.id}/categories/{cat.id}/")
        assert resp.json()["effective_match_duration"] == 20


# ── Fields ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestFieldsCRUD:
    def test_create_field(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        api.force_authenticate(user=user)
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/fields/",
            {
                "name": "Terrain 1",
                "availability": [
                    {"date": str(t.start_date), "start": "08:00", "end": "19:00"}
                ],
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED

    def test_field_date_outside_tournament_fails(self, api):
        user = _make_user()
        club = ClubFactory(owner=user)
        t = TournamentFactory(
            club=club,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
        )
        api.force_authenticate(user=user)
        resp = api.post(
            f"/api/v1/tournaments/{t.id}/fields/",
            {
                "name": "Terrain Bad",
                "availability": [
                    {"date": "2099-12-31", "start": "08:00", "end": "19:00"}
                ],
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
