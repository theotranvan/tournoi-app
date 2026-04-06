"""Tests for the scoring function."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from apps.scheduling.context import SchedulingContext
from apps.scheduling.scoring import score_placement
from apps.scheduling.tests.conftest import make_tournament
from apps.scheduling.types import Placement, ProvisionalMatch
from apps.teams.models import Group, Team
from apps.tournaments.models import Category, Field, SchedulingConstraint


def _build_context(tournament):
    """Build a SchedulingContext from DB objects."""
    categories = list(Category.objects.filter(tournament=tournament))
    fields = list(Field.objects.filter(tournament=tournament, is_active=True))
    groups = list(Group.objects.filter(category__tournament=tournament))
    teams = list(Team.objects.filter(tournament=tournament))
    constraints = list(SchedulingConstraint.objects.filter(tournament=tournament))
    return SchedulingContext(
        tournament=tournament,
        categories=categories,
        fields=fields,
        groups=groups,
        teams=teams,
        constraints=constraints,
    )


@pytest.mark.django_db
class TestScoringHardConstraints:
    """Score returns None when hard constraints are violated."""

    def test_returns_none_if_field_unavailable(self, organizer):
        tournament = make_tournament(organizer, n_categories=1, teams_per_cat=2, n_fields=1, n_groups=1)
        ctx = _build_context(tournament)
        cat = Category.objects.filter(tournament=tournament).first()
        teams = list(Team.objects.filter(tournament=tournament))
        match = ProvisionalMatch(
            provisional_id="test-1",
            category_id=cat.id,
            group_id=None,
            phase="group",
            team_home_id=teams[0].id,
            team_away_id=teams[1].id,
            duration=15,
        )
        field = Field.objects.filter(tournament=tournament).first()
        # Way outside availability (3 AM)
        out_of_hours = datetime(2020, 1, 1, 3, 0, tzinfo=UTC)
        assert score_placement(match, field.id, out_of_hours, ctx) is None

    def test_returns_none_if_team_conflict(self, organizer):
        tournament = make_tournament(organizer, n_categories=1, teams_per_cat=3, n_fields=1, n_groups=1)
        ctx = _build_context(tournament)
        cat = Category.objects.filter(tournament=tournament).first()
        teams = list(Team.objects.filter(tournament=tournament))
        field = Field.objects.filter(tournament=tournament).first()
        start = ctx.get_candidate_starts(field.id)[0]

        # Place first match
        m1 = ProvisionalMatch(
            provisional_id="m1",
            category_id=cat.id,
            group_id=None,
            phase="group",
            team_home_id=teams[0].id,
            team_away_id=teams[1].id,
            duration=15,
            rest_needed=20,
        )
        p1 = Placement(match=m1, field_id=field.id, start_time=start, score=1000)
        ctx.commit_placement(p1)

        # Second match for same team, only 5 min later (< 20 rest)
        m2 = ProvisionalMatch(
            provisional_id="m2",
            category_id=cat.id,
            group_id=None,
            phase="group",
            team_home_id=teams[0].id,
            team_away_id=teams[2].id,
            duration=15,
            rest_needed=20,
        )
        conflict_start = start + timedelta(minutes=20)  # 15 match + 5 gap < 20 rest
        assert score_placement(m2, field.id, conflict_start, ctx) is None

    def test_returns_none_if_hard_constraint_violated(self, organizer):
        tournament = make_tournament(organizer, n_categories=1, teams_per_cat=2, n_fields=2, n_groups=1)
        cat = Category.objects.filter(tournament=tournament).first()
        field1, field2 = Field.objects.filter(tournament=tournament).order_by("name")

        # Hard constraint: final must be on field1
        SchedulingConstraint.objects.create(
            tournament=tournament,
            name="Final on field 1",
            constraint_type="required_field",
            payload={"category_id": cat.id, "phase": "final", "field_id": field1.id},
            is_hard=True,
        )

        ctx = _build_context(tournament)

        match = ProvisionalMatch(
            provisional_id="final-test",
            category_id=cat.id,
            group_id=None,
            phase="final",
            team_home_id=None,
            team_away_id=None,
            placeholder_home="V D1",
            placeholder_away="V D2",
            duration=15,
        )
        start = ctx.get_candidate_starts(field2.id)[0]
        # On field2 → should be None (violates required_field)
        assert score_placement(match, field2.id, start, ctx) is None
        # On field1 → should be valid
        start1 = ctx.get_candidate_starts(field1.id)[0]
        assert score_placement(match, field1.id, start1, ctx) is not None


@pytest.mark.django_db
class TestScoringSoftPenalties:
    """Score varies based on soft constraints."""

    def test_score_positive_for_ideal_rest(self, organizer):
        tournament = make_tournament(organizer, n_categories=1, teams_per_cat=2, n_fields=1, n_groups=1)
        ctx = _build_context(tournament)
        cat = Category.objects.filter(tournament=tournament).first()
        teams = list(Team.objects.filter(tournament=tournament))
        field = Field.objects.filter(tournament=tournament).first()
        start = ctx.get_candidate_starts(field.id)[0]

        match = ProvisionalMatch(
            provisional_id="ideal",
            category_id=cat.id,
            group_id=None,
            phase="group",
            team_home_id=teams[0].id,
            team_away_id=teams[1].id,
            duration=15,
            rest_needed=20,
        )
        s = score_placement(match, field.id, start, ctx)
        assert s is not None
        assert s > 900  # Near base score with no penalties

    def test_score_decreases_for_long_wait(self, organizer):
        tournament = make_tournament(organizer, n_categories=1, teams_per_cat=3, n_fields=1, n_groups=1)
        ctx = _build_context(tournament)
        cat = Category.objects.filter(tournament=tournament).first()
        teams = list(Team.objects.filter(tournament=tournament))
        field = Field.objects.filter(tournament=tournament).first()
        start = ctx.get_candidate_starts(field.id)[0]

        # Place a match early
        m1 = ProvisionalMatch(
            provisional_id="early",
            category_id=cat.id,
            group_id=None,
            phase="group",
            team_home_id=teams[0].id,
            team_away_id=teams[1].id,
            duration=15,
            rest_needed=20,
        )
        ctx.commit_placement(Placement(match=m1, field_id=field.id, start_time=start, score=1000))

        # Score a match 4 hours later for same team
        m2 = ProvisionalMatch(
            provisional_id="late",
            category_id=cat.id,
            group_id=None,
            phase="group",
            team_home_id=teams[0].id,
            team_away_id=teams[2].id,
            duration=15,
            rest_needed=20,
        )
        late_start = start + timedelta(hours=4)
        score_late = score_placement(m2, field.id, late_start, ctx)

        # Score same match at ideal rest (~30 min)
        ideal_start = start + timedelta(minutes=40)  # 15 + 25 rest
        score_ideal = score_placement(m2, field.id, ideal_start, ctx)

        assert score_late is not None
        assert score_ideal is not None
        assert score_ideal > score_late  # Long wait penalised
