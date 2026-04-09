"""Integration tests for the scheduling engine — full generate + commit + API views."""

from __future__ import annotations

import pytest
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient

from apps.matches.models import Match
from apps.scheduling.engine import SchedulingEngine
from apps.scheduling.tests.conftest import make_tournament
from tests.factories import UserFactory


pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture(autouse=True)
def _clear():
    cache.clear()


@pytest.fixture
def organizer(db):
    return UserFactory()


# ── Engine Integration ───────────────────────────────────────────────────────


class TestEngineIntegration:
    """Full round-trip: generate → commit → verify DB state."""

    def test_generate_and_commit_creates_matches(self, organizer):
        tournament = make_tournament(
            organizer, n_categories=1, teams_per_cat=4,
            n_fields=2, n_days=1, n_groups=1,
        )
        engine = SchedulingEngine(tournament, strategy="balanced")
        report = engine.generate()
        assert report.placed_count == 6  # C(4,2) = 6

        engine.commit_to_db()
        db_matches = Match.objects.filter(tournament=tournament)
        assert db_matches.count() == 6
        assert all(m.status == Match.Status.SCHEDULED for m in db_matches)
        assert all(m.field is not None for m in db_matches)
        assert all(m.start_time is not None for m in db_matches)

    def test_report_dict_structure(self, organizer):
        tournament = make_tournament(organizer, n_categories=1, teams_per_cat=4, n_fields=2)
        engine = SchedulingEngine(tournament, strategy="balanced")
        report = engine.generate()
        d = report.to_dict()
        assert "total_count" in d
        assert "placed_count" in d
        assert "hard_conflicts" in d
        assert "score" in d

    def test_progress_callback_invoked(self, organizer):
        tournament = make_tournament(organizer, n_categories=1, teams_per_cat=4, n_fields=2)
        engine = SchedulingEngine(tournament, strategy="balanced")
        progress_calls = []
        engine.set_progress_callback(lambda pct, msg: progress_calls.append(pct))
        engine.generate()
        assert len(progress_calls) > 0
        assert 100 in progress_calls

    def test_two_categories_with_knockouts(self, organizer):
        tournament = make_tournament(
            organizer, n_categories=2, teams_per_cat=4,
            n_fields=3, n_days=1, n_groups=2,
        )
        engine = SchedulingEngine(tournament, strategy="balanced")
        report = engine.generate()
        # 2 groups of 2 per cat = 1 group match each = 2 group, + 4 knockout per cat
        # Total per cat: 2 group + 4 knockout = 6, × 2 cats = 12
        assert report.total_count == 12
        assert report.placed_count == 12
        assert len(report.hard_conflicts) == 0

    def test_auto_populate_field_availability(self, organizer):
        """Fields with no availability get auto-populated from tournament dates."""
        import datetime

        from apps.tournaments.models import Field
        from tests.factories import ClubFactory, TournamentFactory

        club = ClubFactory(owner=organizer)
        tournament = TournamentFactory(
            club=club,
            start_date=datetime.date(2026, 7, 1),
            end_date=datetime.date(2026, 7, 2),
        )
        # Create field with no availability
        Field.objects.create(
            tournament=tournament,
            name="Empty Field",
            availability=[],
        )
        from apps.teams.models import Group
        from tests.factories import CategoryFactory, TeamFactory

        cat = CategoryFactory(tournament=tournament)
        g = Group.objects.create(category=cat, name="A")
        for i in range(3):
            t = TeamFactory(tournament=tournament, category=cat, name=f"T{i}")
            g.teams.add(t)

        engine = SchedulingEngine(tournament, strategy="balanced")
        report = engine.generate()
        # Should have placed matches despite empty availability
        assert report.placed_count == 3  # C(3,2) = 3
        # Verify warning was emitted
        warnings = [w for w in report.soft_warnings if "auto" in w.message.lower()
                     or w.type == "auto_availability"]
        assert len(warnings) >= 1


# ── Schedule API Views ───────────────────────────────────────────────────────


class TestScheduleAPI:
    def test_generate_schedule_via_api(self, api, organizer):
        tournament = make_tournament(
            organizer, n_categories=1, teams_per_cat=4,
            n_fields=2, n_days=1, n_groups=1,
        )
        api.force_authenticate(user=organizer)
        resp = api.post(
            f"/api/v1/tournaments/{tournament.id}/schedule/generate/",
            {"strategy": "balanced"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["total_count"] == 6
        assert resp.data["placed_count"] == 6
        assert Match.objects.filter(tournament=tournament).count() == 6

    def test_schedule_list_view(self, api, organizer):
        tournament = make_tournament(
            organizer, n_categories=1, teams_per_cat=4,
            n_fields=2, n_days=1, n_groups=1,
        )
        engine = SchedulingEngine(tournament, strategy="balanced")
        engine.generate()
        engine.commit_to_db()

        api.force_authenticate(user=organizer)
        resp = api.get(f"/api/v1/tournaments/{tournament.id}/schedule/")
        assert resp.status_code == 200
        # Response is ScheduleDay[] — a list of {date, fields: [{field, matches}]}
        assert isinstance(resp.data, list)
        assert len(resp.data) >= 1
        total_matches = sum(
            len(field_data["matches"])
            for day in resp.data
            for field_data in day["fields"]
        )
        assert total_matches >= 1

    def test_conflicts_view_empty_on_valid_schedule(self, api, organizer):
        tournament = make_tournament(
            organizer, n_categories=1, teams_per_cat=4,
            n_fields=2, n_days=1, n_groups=1,
        )
        engine = SchedulingEngine(tournament, strategy="balanced")
        engine.generate()
        engine.commit_to_db()

        api.force_authenticate(user=organizer)
        resp = api.get(f"/api/v1/tournaments/{tournament.id}/schedule/conflicts/")
        assert resp.status_code == 200
        assert len(resp.data["conflicts"]) == 0

    def test_generate_requires_auth(self, api, organizer):
        tournament = make_tournament(organizer)
        resp = api.post(
            f"/api/v1/tournaments/{tournament.id}/schedule/generate/",
            {"strategy": "balanced"},
            format="json",
        )
        assert resp.status_code == 401
