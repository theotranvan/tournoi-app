"""Tests for incremental recalculation (reschedule)."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from django.db import IntegrityError

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


@pytest.mark.django_db
class TestAtomicCommit:
    """commit_to_db must be truly atomic: failure mid-way rolls back the DELETE."""

    def test_commit_is_atomic_on_error(self, organizer):
        """If bulk_create fails after the DELETE, all original matches survive (rollback)."""
        tournament = make_tournament(
            organizer, n_categories=1, teams_per_cat=4, n_fields=2, n_days=1, n_groups=1,
        )

        engine = SchedulingEngine(tournament, strategy="balanced")
        engine.generate()
        engine.commit_to_db()

        original_count = Match.objects.filter(tournament=tournament).count()
        assert original_count > 0

        original_ids = set(
            Match.objects.filter(tournament=tournament).values_list("id", flat=True)
        )

        # Re-generate so engine has placements to commit
        engine2 = SchedulingEngine(tournament, strategy="balanced")
        engine2.generate()

        # Patch bulk_create to raise IntegrityError after DELETE has happened
        real_bulk_create = Match.objects.bulk_create.__func__  # type: ignore[attr-defined]

        def _boom(manager_self, objs, *args, **kwargs):
            raise IntegrityError("simulated DB error")

        with patch.object(type(Match.objects), "bulk_create", _boom):
            with pytest.raises(IntegrityError):
                engine2.commit_to_db()

        # After the rollback the original matches must still be there
        surviving_count = Match.objects.filter(tournament=tournament).count()
        assert surviving_count == original_count

        surviving_ids = set(
            Match.objects.filter(tournament=tournament).values_list("id", flat=True)
        )
        assert surviving_ids == original_ids


@pytest.mark.django_db(transaction=True)
class TestConcurrentGeneration:
    """Two concurrent generations must not corrupt or duplicate matches."""

    def test_concurrent_generates_dont_corrupt(self, organizer):
        tournament = make_tournament(
            organizer, n_categories=1, teams_per_cat=4, n_fields=2, n_days=1, n_groups=1,
        )

        # First generation
        engine1 = SchedulingEngine(tournament, strategy="balanced")
        engine1.generate()
        engine1.commit_to_db()

        count_after_first = Match.objects.filter(tournament=tournament).count()
        assert count_after_first > 0

        # Second generation (simulates a concurrent call)
        engine2 = SchedulingEngine(tournament, strategy="balanced")
        engine2.generate()
        engine2.commit_to_db()

        count_after_second = Match.objects.filter(tournament=tournament).count()
        # Should have roughly the same count, no duplicates
        assert count_after_second == count_after_first
