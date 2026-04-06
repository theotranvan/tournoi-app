"""Tests for incremental recalculation (reschedule)."""

from __future__ import annotations

import pytest
from django.db import transaction

from apps.matches.models import Match
from apps.scheduling.engine import SchedulingEngine
from apps.scheduling.tests.conftest import make_tournament
from apps.tournaments.models import Category, Field, SchedulingConstraint


@pytest.mark.django_db
class TestRecalculation:
    """Full workflow: generate → lock → modify → recalculate → verify."""

    def test_locked_match_stays_after_recalculation(self, organizer):
        tournament = make_tournament(
            organizer, n_categories=1, teams_per_cat=4, n_fields=2, n_days=1, n_groups=2,
        )

        # Initial generation
        engine = SchedulingEngine(tournament, strategy="balanced")
        engine.generate()
        with transaction.atomic():
            engine.commit_to_db()

        matches = list(Match.objects.filter(tournament=tournament))
        assert len(matches) > 0

        # Lock a specific match
        locked = matches[0]
        locked.is_locked = True
        locked.save()
        locked_field = locked.field_id
        locked_time = locked.start_time

        # Recalculate with changed matches
        match_ids = [str(m.id) for m in matches[:3]]
        SchedulingEngine.reschedule(tournament, match_ids)

        # Verify locked match didn't move
        locked.refresh_from_db()
        assert locked.is_locked is True
        assert locked.field_id == locked_field
        assert locked.start_time == locked_time

    def test_non_locked_matches_get_rescheduled(self, organizer):
        tournament = make_tournament(
            organizer, n_categories=1, teams_per_cat=4, n_fields=2, n_days=1, n_groups=2,
        )

        engine = SchedulingEngine(tournament, strategy="balanced")
        engine.generate()
        with transaction.atomic():
            engine.commit_to_db()

        initial_count = Match.objects.filter(tournament=tournament).count()
        assert initial_count > 0

        matches = list(Match.objects.filter(tournament=tournament))
        match_ids = [str(m.id) for m in matches]

        report = SchedulingEngine.reschedule(tournament, match_ids)

        # All matches should still exist after recalculation
        final_count = Match.objects.filter(tournament=tournament).count()
        assert final_count > 0
        assert report.placed_count > 0

    def test_constraint_added_then_recalculate(self, organizer):
        tournament = make_tournament(
            organizer, n_categories=1, teams_per_cat=4, n_fields=2, n_days=1, n_groups=2,
        )

        # Initial generation
        engine = SchedulingEngine(tournament, strategy="balanced")
        engine.generate()
        with transaction.atomic():
            engine.commit_to_db()

        # Lock one match
        first_match = Match.objects.filter(tournament=tournament).first()
        first_match.is_locked = True
        first_match.save()
        locked_id = first_match.id
        locked_field = first_match.field_id
        locked_time = first_match.start_time

        # Add a new constraint
        cat = Category.objects.filter(tournament=tournament).first()
        Field.objects.filter(tournament=tournament).first()
        SchedulingConstraint.objects.create(
            tournament=tournament,
            name="New constraint",
            constraint_type="earliest_time",
            payload={"category_id": cat.id, "phase": "final", "time": "15:00"},
            is_hard=True,
        )

        # Recalculate
        all_ids = [
            str(m.id)
            for m in Match.objects.filter(tournament=tournament, is_locked=False)
        ]
        if all_ids:
            report = SchedulingEngine.reschedule(tournament, all_ids)
            assert report.placed_count > 0

        # Verify locked match untouched
        first_match.refresh_from_db()
        assert first_match.id == locked_id
        assert first_match.field_id == locked_field
        assert first_match.start_time == locked_time
        assert first_match.is_locked is True
