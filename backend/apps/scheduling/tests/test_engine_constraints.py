"""Tests for constraint handling and conflict reporting."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.matches.models import Match
from apps.scheduling.engine import SchedulingEngine
from apps.scheduling.tests.conftest import make_tournament
from apps.scheduling.types import Strategy
from apps.teams.models import Group
from apps.tournaments.models import Category, Field, SchedulingConstraint
from tests.factories import (
    CategoryFactory,
    ClubFactory,
    FieldFactory,
    TeamFactory,
    TournamentFactory,
)


@pytest.mark.django_db
class TestHardConstraintFinalPlacement:
    """Finale U13 imposed after 16h on Terrain 1 → verify exact placement."""

    def test_final_on_required_field_after_time(self, organizer):
        tournament = make_tournament(
            organizer, n_categories=1, teams_per_cat=4, n_fields=2, n_days=1, n_groups=2,
        )

        field1 = Field.objects.filter(tournament=tournament, name="Terrain 1").first()
        cat = Category.objects.filter(tournament=tournament).first()

        SchedulingConstraint.objects.create(
            tournament=tournament,
            name="Finale sur Terrain 1",
            constraint_type="required_field",
            payload={"category_id": cat.id, "phase": "final", "field_id": field1.id},
            is_hard=True,
        )
        SchedulingConstraint.objects.create(
            tournament=tournament,
            name="Finale après 16h",
            constraint_type="earliest_time",
            payload={"category_id": cat.id, "phase": "final", "time": "16:00"},
            is_hard=True,
        )

        engine = SchedulingEngine(tournament, strategy="balanced")
        engine.generate()
        engine.commit_to_db()

        final = Match.objects.filter(tournament=tournament, phase="final").first()
        assert final is not None
        assert final.field_id == field1.id
        assert final.start_time.hour >= 16


@pytest.mark.django_db
class TestCategoryDayConstraint:
    """Category U10 morning only on day 1 → no U10 match after 12h or on day 2."""

    def test_category_morning_only(self, organizer):
        tournament = make_tournament(
            organizer,
            n_categories=2,
            teams_per_cat=4,
            n_fields=2,
            n_days=2,
            n_groups=1,
        )

        # Get the first category (U10)
        cat_u10 = Category.objects.filter(tournament=tournament, name="U10").first()
        assert cat_u10 is not None

        # Set U10 to latest_end 12:00 and allowed_days to day 1 only
        from datetime import time as dt_time

        day1 = tournament.start_date.isoformat()
        cat_u10.latest_end = dt_time(12, 0)
        cat_u10.allowed_days = [day1]
        cat_u10.save()

        engine = SchedulingEngine(tournament, strategy="balanced")
        engine.generate()
        engine.commit_to_db()

        # Check all U10 matches
        u10_matches = Match.objects.filter(tournament=tournament, category=cat_u10)
        for m in u10_matches:
            assert m.start_time.date().isoformat() == day1, (
                f"U10 match on wrong day: {m.start_time.date()}"
            )
            end_time = m.start_time + timedelta(minutes=m.duration_minutes)
            assert end_time.hour <= 12 or (end_time.hour == 12 and end_time.minute == 0), (
                f"U10 match ends after 12:00: {end_time.time()}"
            )


@pytest.mark.django_db
class TestImpossibleConstraintConflict:
    """Impossible constraint → conflict returned, no crash."""

    def test_conflict_when_not_enough_slots(self, organizer):
        club = ClubFactory(owner=organizer)
        start = timezone.now().date()
        tournament = TournamentFactory(
            club=club,
            start_date=start,
            end_date=start,
            default_match_duration=15,
            default_transition_time=5,
            default_rest_time=20,
        )

        # Only 1 field with 1 hour availability → max ~3 matches
        FieldFactory(
            tournament=tournament,
            name="Petit terrain",
            availability=[{"date": str(start), "start": "08:00", "end": "09:00"}],
        )

        # 6 teams → C(6,2) = 15 matches needed
        cat = CategoryFactory(tournament=tournament, name="U12")
        teams = [
            TeamFactory(tournament=tournament, category=cat, name=f"T{i}")
            for i in range(6)
        ]
        group = Group.objects.create(category=cat, name="A", display_order=0)
        group.teams.set(teams)

        engine = SchedulingEngine(tournament, strategy="balanced")
        report = engine.generate()

        assert report.total_count == 15
        assert report.placed_count < report.total_count
        assert len(report.hard_conflicts) > 0
        assert report.score < 50


@pytest.mark.django_db
class TestDeterminism:
    """Two runs with same seed → identical output."""

    def test_deterministic_output(self, small_tournament):
        engine1 = SchedulingEngine(small_tournament, strategy="balanced", seed=42)
        report1 = engine1.generate()

        engine2 = SchedulingEngine(small_tournament, strategy="balanced", seed=42)
        report2 = engine2.generate()

        assert report1.total_count == report2.total_count
        assert report1.placed_count == report2.placed_count
        assert report1.score == report2.score

        starts1 = sorted(
            (p.field_id, p.start_time) for p in engine1._context.placements
        )
        starts2 = sorted(
            (p.field_id, p.start_time) for p in engine2._context.placements
        )
        assert starts1 == starts2


@pytest.mark.django_db
class TestReporting:
    """Report structure and score coherence."""

    def test_report_structure(self, small_tournament):
        engine = SchedulingEngine(small_tournament, strategy="balanced")
        report = engine.generate()

        assert 0 <= report.score <= 105
        assert report.strategy_used == Strategy.BALANCED
        assert report.execution_time_ms >= 0

        d = report.to_dict()
        assert "placed_count" in d
        assert "total_count" in d
        assert "hard_conflicts" in d
        assert "soft_warnings" in d
        assert "score" in d
        assert "strategy_used" in d


@pytest.mark.django_db
class TestEmptyTournament:
    """Tournament with no teams → 0 matches, clean report."""

    def test_empty_tournament(self, organizer):
        club = ClubFactory(owner=organizer)
        start = timezone.now().date()
        tournament = TournamentFactory(club=club, start_date=start, end_date=start)
        FieldFactory(
            tournament=tournament,
            availability=[{"date": str(start), "start": "08:00", "end": "19:00"}],
        )
        CategoryFactory(tournament=tournament, name="U10")

        engine = SchedulingEngine(tournament, strategy="balanced")
        report = engine.generate()

        assert report.total_count == 0
        assert report.placed_count == 0
        assert len(report.hard_conflicts) == 0


@pytest.mark.django_db
class TestPhaseSeparation:
    """Phase separation modes — same_day_rest and next_day."""

    def test_same_day_rest_triples_rest_before_knockout(self, organizer):
        """With same_day_rest mode, knockout rest_needed should be multiplied."""
        tournament = make_tournament(
            organizer,
            n_categories=1,
            teams_per_cat=4,
            n_fields=2,
            n_days=1,
            n_groups=2,
            rest_time=20,
        )
        tournament.phase_separation_mode = "same_day_rest"
        tournament.knockout_rest_multiplier = 3
        tournament.save()

        engine = SchedulingEngine(tournament, strategy="balanced")
        report = engine.generate()
        engine.commit_to_db()

        # All matches should be placed
        assert report.placed_count == report.total_count
        assert report.total_count > 0

        # Check that knockout matches have tripled rest in practice:
        # verify no knockout starts sooner than 60min after groups end
        from apps.matches.models import Match

        group_matches = Match.objects.filter(
            tournament=tournament, phase="group",
        )
        knockout_matches = Match.objects.filter(
            tournament=tournament,
        ).exclude(phase="group")

        if group_matches.exists() and knockout_matches.exists():
            last_group_end = max(
                m.start_time + timedelta(minutes=m.duration_minutes)
                for m in group_matches
            )
            first_knockout_start = min(m.start_time for m in knockout_matches)
            gap_minutes = (first_knockout_start - last_group_end).total_seconds() / 60
            # Gap should be at least 3x rest (60min) - allow 5min tolerance
            assert gap_minutes >= 55, (
                f"Knockout starts only {gap_minutes:.0f}min after groups "
                f"(expected >= 60min with multiplier 3)"
            )

    def test_next_day_mode_forces_knockout_on_day_2(self, organizer):
        """With next_day mode, all knockout matches should be on the last day."""
        tournament = make_tournament(
            organizer,
            n_categories=1,
            teams_per_cat=4,
            n_fields=2,
            n_days=2,
            n_groups=2,
        )
        tournament.phase_separation_mode = "next_day"
        tournament.save()

        engine = SchedulingEngine(tournament, strategy="balanced")
        report = engine.generate()
        engine.commit_to_db()

        assert report.placed_count == report.total_count
        assert report.total_count > 0

        from apps.matches.models import Match

        knockout_matches = Match.objects.filter(
            tournament=tournament,
        ).exclude(phase="group")

        last_day = tournament.end_date
        for m in knockout_matches:
            assert m.start_time.date() == last_day, (
                f"Knockout match {m.phase} on {m.start_time.date()}, "
                f"expected on {last_day}"
            )

    def test_next_day_single_day_warning(self, organizer):
        """next_day mode on single-day tournament → warning, not crash."""
        tournament = make_tournament(
            organizer,
            n_categories=1,
            teams_per_cat=4,
            n_fields=2,
            n_days=1,
            n_groups=2,
        )
        tournament.phase_separation_mode = "next_day"
        tournament.save()

        engine = SchedulingEngine(tournament, strategy="balanced")
        report = engine.generate()

        # Should still work (no crash), with a warning
        assert report.placed_count == report.total_count
        warning_types = [w.type for w in report.soft_warnings]
        assert "phase_separation_impossible" in warning_types

    def test_feasibility_next_day_single_day_bottleneck(self, organizer):
        """Feasibility check should flag next_day mode on single-day tournament."""
        tournament = make_tournament(
            organizer,
            n_categories=1,
            teams_per_cat=4,
            n_fields=2,
            n_days=1,
            n_groups=2,
        )
        tournament.phase_separation_mode = "next_day"
        tournament.save()

        result = SchedulingEngine.check_feasibility(tournament)
        bottleneck_text = " ".join(result["bottlenecks"])
        assert "lendemain" in bottleneck_text.lower() or "séparation" in bottleneck_text.lower()
