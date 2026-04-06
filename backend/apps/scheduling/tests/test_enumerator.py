"""Tests for the match enumerator module."""

from __future__ import annotations

import pytest

from apps.scheduling.enumerator import (
    enumerate_bracket_matches,
    enumerate_group_matches,
    enumerate_tournament_matches,
)
from apps.scheduling.tests.conftest import make_tournament
from apps.teams.models import Group
from tests.factories import CategoryFactory, TeamFactory


@pytest.mark.django_db
class TestRoundRobin:
    """Round-robin generation correctness for various group sizes."""

    def _make_group(self, tournament, n_teams):
        cat = CategoryFactory(tournament=tournament, name=f"U{n_teams + 10}")
        teams = [
            TeamFactory(tournament=tournament, category=cat, name=f"T{i}")
            for i in range(n_teams)
        ]
        group = Group.objects.create(category=cat, name="A", display_order=0)
        group.teams.set(teams)
        return group

    def test_round_robin_3_teams(self, organizer):
        t = make_tournament(organizer, n_categories=0, n_fields=1, n_groups=0)
        group = self._make_group(t, 3)
        matches = enumerate_group_matches(group)
        # C(3,2) = 3
        assert len(matches) == 3
        assert all(m.phase == "group" for m in matches)

    def test_round_robin_4_teams(self, organizer):
        t = make_tournament(organizer, n_categories=0, n_fields=1, n_groups=0)
        group = self._make_group(t, 4)
        matches = enumerate_group_matches(group)
        # C(4,2) = 6
        assert len(matches) == 6

    def test_round_robin_5_teams(self, organizer):
        t = make_tournament(organizer, n_categories=0, n_fields=1, n_groups=0)
        group = self._make_group(t, 5)
        matches = enumerate_group_matches(group)
        # C(5,2) = 10
        assert len(matches) == 10

    def test_round_robin_6_teams(self, organizer):
        t = make_tournament(organizer, n_categories=0, n_fields=1, n_groups=0)
        group = self._make_group(t, 6)
        matches = enumerate_group_matches(group)
        # C(6,2) = 15
        assert len(matches) == 15

    def test_round_robin_no_duplicates(self, organizer):
        t = make_tournament(organizer, n_categories=0, n_fields=1, n_groups=0)
        group = self._make_group(t, 5)
        matches = enumerate_group_matches(group)
        pairs = [(m.team_home_id, m.team_away_id) for m in matches]
        # No duplicate pair (order matters)
        assert len(pairs) == len(set(pairs))
        # Also no duplicates ignoring order
        unordered = [frozenset((m.team_home_id, m.team_away_id)) for m in matches]
        assert len(unordered) == len(set(unordered))

    def test_single_team_group_produces_no_matches(self, organizer):
        t = make_tournament(organizer, n_categories=0, n_fields=1, n_groups=0)
        cat = CategoryFactory(tournament=t, name="U11")
        team = TeamFactory(tournament=t, category=cat)
        group = Group.objects.create(category=cat, name="A", display_order=0)
        group.teams.set([team])
        matches = enumerate_group_matches(group)
        assert len(matches) == 0


@pytest.mark.django_db
class TestBrackets:
    """Bracket generation for 2, 4, and 8 groups."""

    def test_brackets_2_groups(self, organizer):
        t = make_tournament(organizer, n_categories=0, n_fields=1, n_groups=0)
        cat = CategoryFactory(tournament=t, name="U12")
        matches = enumerate_bracket_matches(cat, 2, ["A", "B"])
        phases = [m.phase for m in matches]
        assert phases.count("semi") == 2
        assert phases.count("third") == 1
        assert phases.count("final") == 1
        assert len(matches) == 4

    def test_brackets_4_groups(self, organizer):
        t = make_tournament(organizer, n_categories=0, n_fields=1, n_groups=0)
        cat = CategoryFactory(tournament=t, name="U13")
        matches = enumerate_bracket_matches(cat, 4, ["A", "B", "C", "D"])
        phases = [m.phase for m in matches]
        assert phases.count("quarter") == 4
        assert phases.count("semi") == 2
        assert phases.count("third") == 1
        assert phases.count("final") == 1
        assert len(matches) == 8

    def test_brackets_8_groups(self, organizer):
        t = make_tournament(organizer, n_categories=0, n_fields=1, n_groups=0)
        cat = CategoryFactory(tournament=t, name="U14")
        names = [chr(65 + i) for i in range(8)]
        matches = enumerate_bracket_matches(cat, 8, names)
        phases = [m.phase for m in matches]
        assert phases.count("r16") > 0
        assert phases.count("quarter") == 4
        assert phases.count("semi") == 2
        assert phases.count("final") == 1

    def test_brackets_all_placeholders(self, organizer):
        t = make_tournament(organizer, n_categories=0, n_fields=1, n_groups=0)
        cat = CategoryFactory(tournament=t, name="U15")
        matches = enumerate_bracket_matches(cat, 2, ["A", "B"])
        for m in matches:
            assert m.team_home_id is None
            assert m.team_away_id is None
            assert m.placeholder_home != ""
            assert m.placeholder_away != ""


@pytest.mark.django_db
class TestTournamentEnumeration:
    """Full tournament enumeration."""

    def test_enumerate_tournament_matches_count(self, small_tournament):
        matches, warnings = enumerate_tournament_matches(small_tournament)
        # 1 group of 4 teams: C(4,2) = 6 group, no knockout (1 group < 2)
        assert len(matches) == 6

    def test_enumerate_tournament_with_knockouts(self, small_tournament_2_groups):
        matches, warnings = enumerate_tournament_matches(small_tournament_2_groups)
        # 2 groups of 2 teams each: 2×C(2,2)=2 group + 4 knockout = 6
        assert len(matches) == 6

    def test_no_duplicate_match_ids(self, medium_tournament):
        matches, _ = enumerate_tournament_matches(medium_tournament)
        ids = [m.provisional_id for m in matches]
        assert len(ids) == len(set(ids))
