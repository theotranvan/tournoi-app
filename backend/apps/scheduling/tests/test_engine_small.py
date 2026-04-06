"""Tests for small tournament scheduling (1 cat, 4 teams, 2 fields, 1 day)."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.db.models import Q

from apps.matches.models import Match
from apps.scheduling.engine import SchedulingEngine
from apps.teams.models import Team


@pytest.mark.django_db
class TestSmallTournamentGeneration:
    """1 category, 4 teams in 1 group, 2 fields, 1 day → 6 group matches."""

    def test_generates_correct_match_count(self, small_tournament):
        engine = SchedulingEngine(small_tournament, strategy="balanced")
        report = engine.generate()
        # C(4,2) = 6 group matches, 1 group → no knockout
        assert report.total_count == 6
        assert report.placed_count == 6

    def test_no_hard_conflicts(self, small_tournament):
        engine = SchedulingEngine(small_tournament, strategy="balanced")
        report = engine.generate()
        assert len(report.hard_conflicts) == 0

    def test_all_teams_play_at_least_3_matches(self, small_tournament):
        engine = SchedulingEngine(small_tournament, strategy="balanced")
        engine.generate()
        engine.commit_to_db()

        teams = Team.objects.filter(tournament=small_tournament)
        for team in teams:
            count = Match.objects.filter(
                Q(team_home=team) | Q(team_away=team),
                tournament=small_tournament,
            ).count()
            assert count >= 3, f"{team.name} played only {count} matches"

    def test_no_field_overlaps(self, small_tournament):
        engine = SchedulingEngine(small_tournament, strategy="balanced")
        engine.generate()
        engine.commit_to_db()

        matches = list(
            Match.objects.filter(tournament=small_tournament)
            .order_by("field", "start_time"),
        )
        # Check no two matches on the same field overlap
        from collections import defaultdict

        field_matches: dict[int, list[Match]] = defaultdict(list)
        for m in matches:
            field_matches[m.field_id].append(m)

        for fid, fmatches in field_matches.items():
            fmatches.sort(key=lambda m: m.start_time)
            for i in range(1, len(fmatches)):
                prev_end = fmatches[i - 1].start_time + timedelta(
                    minutes=fmatches[i - 1].duration_minutes,
                )
                assert fmatches[i].start_time >= prev_end, (
                    f"Overlap on field {fid}: match ends {prev_end},"
                    f" next starts {fmatches[i].start_time}"
                )

    def test_rest_minimum_respected(self, small_tournament):
        engine = SchedulingEngine(small_tournament, strategy="balanced")
        engine.generate()
        engine.commit_to_db()

        teams = Team.objects.filter(tournament=small_tournament)
        rest_required = small_tournament.default_rest_time
        for team in teams:
            matches = list(
                Match.objects.filter(
                    Q(team_home=team) | Q(team_away=team),
                    tournament=small_tournament,
                ).order_by("start_time"),
            )
            for i in range(1, len(matches)):
                prev_end = matches[i - 1].start_time + timedelta(
                    minutes=matches[i - 1].duration_minutes,
                )
                gap = (matches[i].start_time - prev_end).total_seconds() / 60.0
                assert gap >= rest_required - 1, (
                    f"Team {team.name}: {gap:.0f}min rest < {rest_required}min"
                )


@pytest.mark.django_db
class TestSmallTournamentWithKnockouts:
    """1 category, 4 teams in 2 groups, 2 fields → group + knockout matches."""

    def test_places_all_matches_including_knockouts(self, small_tournament_2_groups):
        engine = SchedulingEngine(small_tournament_2_groups, strategy="balanced")
        report = engine.generate()
        # 2 groups × C(2,2)=1 = 2 group + 4 knockout = 6
        assert report.total_count == 6
        assert report.placed_count == 6
        assert len(report.hard_conflicts) == 0

    def test_score_is_positive(self, small_tournament_2_groups):
        engine = SchedulingEngine(small_tournament_2_groups, strategy="balanced")
        report = engine.generate()
        assert report.score > 0
