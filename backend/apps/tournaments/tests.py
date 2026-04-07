"""Tests for tournaments app — models, lifecycle, validation, categories, fields."""

import datetime

import pytest
from django.core.exceptions import ValidationError
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient

from apps.subscriptions.models import Subscription
from apps.tournaments.models import Category, Field, Tournament, validate_availability
from tests.factories import (
    CategoryFactory,
    ClubFactory,
    FieldFactory,
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
def org():
    return UserFactory()


@pytest.fixture
def tournament(org):
    club = ClubFactory(owner=org)
    return TournamentFactory(club=club)


# ── Tournament Model ────────────────────────────────────────────────────────


class TestTournamentModel:
    def test_slug_auto_generated(self, org):
        club = ClubFactory(owner=org)
        t = Tournament.objects.create(
            club=club,
            name="Mon Tournoi Spécial",
            location="Paris",
            start_date=datetime.date(2026, 7, 1),
            end_date=datetime.date(2026, 7, 2),
        )
        assert t.slug
        assert len(t.slug) > 0

    def test_public_code_auto_generated(self, tournament):
        assert tournament.public_code is not None
        assert len(tournament.public_code) == 6

    def test_clean_rejects_end_before_start(self, org):
        club = ClubFactory(owner=org)
        t = Tournament(
            club=club,
            name="Bad dates",
            location="Paris",
            start_date="2026-07-10",
            end_date="2026-07-09",
        )
        with pytest.raises(ValidationError):
            t.clean()

    def test_default_status_is_draft(self, tournament):
        assert tournament.status == Tournament.Status.DRAFT

    def test_str(self, tournament):
        assert tournament.name in str(tournament)


# ── Category Model ───────────────────────────────────────────────────────────


class TestCategoryModel:
    def test_effective_durations_fallback_to_tournament(self, tournament):
        cat = Category.objects.create(
            tournament=tournament, name="U8", match_duration=None
        )
        assert cat.effective_match_duration == tournament.default_match_duration
        assert cat.effective_transition_time == tournament.default_transition_time
        assert cat.effective_rest_time == tournament.default_rest_time

    def test_effective_durations_override(self, tournament):
        cat = Category.objects.create(
            tournament=tournament,
            name="U18",
            match_duration=25,
            transition_time=10,
            rest_time=30,
        )
        assert cat.effective_match_duration == 25
        assert cat.effective_transition_time == 10
        assert cat.effective_rest_time == 30

    def test_clean_rejects_start_after_end(self, tournament):
        from datetime import time

        cat = Category(
            tournament=tournament,
            name="Bad",
            earliest_start=time(18, 0),
            latest_end=time(8, 0),
        )
        with pytest.raises(ValidationError):
            cat.clean()


# ── Field Model / Availability Validator ─────────────────────────────────────


class TestFieldModel:
    def test_validate_availability_valid(self):
        validate_availability([{"date": "2026-07-01", "start": "08:00", "end": "19:00"}])

    def test_validate_availability_start_after_end(self):
        with pytest.raises(ValidationError):
            validate_availability([{"date": "2026-07-01", "start": "19:00", "end": "08:00"}])

    def test_validate_availability_bad_format(self):
        with pytest.raises(ValidationError):
            validate_availability([{"date": "bad-date", "start": "08:00", "end": "19:00"}])

    def test_validate_availability_not_a_list(self):
        with pytest.raises(ValidationError):
            validate_availability("not a list")


# ── Tournament Lifecycle API ─────────────────────────────────────────────────


class TestTournamentLifecycle:
    def test_publish_requires_category_field_and_teams(self, api, org, tournament):
        api.force_authenticate(user=org)
        # No categories → should fail
        resp = api.post(f"/api/v1/tournaments/{tournament.id}/publish/")
        assert resp.status_code in (400, 409, 422)

    def test_publish_success(self, api, org, tournament):
        cat = CategoryFactory(tournament=tournament)
        FieldFactory(tournament=tournament)
        TeamFactory(tournament=tournament, category=cat, name="T1")
        TeamFactory(tournament=tournament, category=cat, name="T2")
        api.force_authenticate(user=org)
        resp = api.post(f"/api/v1/tournaments/{tournament.id}/publish/")
        assert resp.status_code == 200
        tournament.refresh_from_db()
        assert tournament.status == Tournament.Status.PUBLISHED

    def test_start_requires_published(self, api, org, tournament):
        api.force_authenticate(user=org)
        resp = api.post(f"/api/v1/tournaments/{tournament.id}/start/")
        assert resp.status_code in (400, 409, 422)

    def test_finish_requires_live(self, api, org, tournament):
        api.force_authenticate(user=org)
        resp = api.post(f"/api/v1/tournaments/{tournament.id}/finish/")
        assert resp.status_code in (400, 409, 422)

    def test_full_lifecycle_draft_to_finished(self, api, org, tournament):
        cat = CategoryFactory(tournament=tournament)
        FieldFactory(tournament=tournament)
        TeamFactory(tournament=tournament, category=cat, name="A")
        TeamFactory(tournament=tournament, category=cat, name="B")
        api.force_authenticate(user=org)

        resp = api.post(f"/api/v1/tournaments/{tournament.id}/publish/")
        assert resp.status_code == 200

        resp = api.post(f"/api/v1/tournaments/{tournament.id}/start/")
        assert resp.status_code == 200

        resp = api.post(f"/api/v1/tournaments/{tournament.id}/finish/")
        assert resp.status_code == 200
        tournament.refresh_from_db()
        assert tournament.status == Tournament.Status.FINISHED

    def test_duplicate_tournament(self, api, org, tournament):
        Subscription.objects.update_or_create(
            user=org, defaults={"plan": "club_monthly", "status": "active"}
        )
        CategoryFactory(tournament=tournament, name="U10")
        FieldFactory(tournament=tournament)
        api.force_authenticate(user=org)
        resp = api.post(f"/api/v1/tournaments/{tournament.id}/duplicate/")
        assert resp.status_code in (200, 201)
        assert "(copie)" in resp.data["name"]

    def test_delete_soft_deletes(self, api, org, tournament):
        api.force_authenticate(user=org)
        resp = api.delete(f"/api/v1/tournaments/{tournament.id}/")
        assert resp.status_code == 204
        tournament.refresh_from_db()
        assert tournament.status == Tournament.Status.ARCHIVED

    def test_update_rejected_when_live(self, api, org, tournament):
        tournament.status = Tournament.Status.LIVE
        tournament.save()
        api.force_authenticate(user=org)
        resp = api.patch(
            f"/api/v1/tournaments/{tournament.id}/",
            {"name": "Changed"},
            format="json",
        )
        assert resp.status_code in (400, 403, 409, 422)


# ── Category API ─────────────────────────────────────────────────────────────


class TestCategoryAPI:
    def test_bulk_create_categories(self, api, org, tournament):
        api.force_authenticate(user=org)
        resp = api.post(
            f"/api/v1/tournaments/{tournament.id}/categories/bulk-create/",
            {
                "categories": [
                    {"name": "U8", "display_order": 0},
                    {"name": "U10", "display_order": 1},
                ]
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert Category.objects.filter(tournament=tournament).count() == 2

    def test_delete_category_with_teams_rejected(self, api, org, tournament):
        cat = CategoryFactory(tournament=tournament, name="HasTeams")
        TeamFactory(tournament=tournament, category=cat)
        api.force_authenticate(user=org)
        resp = api.delete(f"/api/v1/tournaments/{tournament.id}/categories/{cat.id}/")
        assert resp.status_code == 422
