"""Comprehensive tests for the new slot-based scheduling engine.

Tests tournament creation → pool generation → schedule generation → 
score entry → finals generation at scales: 16, 50, 100, and 300 teams.
"""

from __future__ import annotations

import math
from datetime import date, timedelta

import pytest
from django.utils import timezone

from apps.matches.models import Match
from apps.scheduling.generate import (
    auto_generate_pools,
    calculate_feasibility,
    gen_round_robin,
    generate_finals,
    generate_schedule,
    propagate_winner,
)
from apps.standings.services import compute_group_standings
from apps.teams.models import Group, Team
from apps.tournaments.models import Category, Day, Field, Tournament
from tests.factories import (
    CategoryFactory,
    ClubFactory,
    DayFactory,
    FieldFactory,
    TeamFactory,
    TournamentFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _create_tournament_setup(
    user,
    *,
    n_teams_per_cat: dict[str, int],
    n_fields: int,
    n_days: int = 1,
    day_configs: list[dict] | None = None,
    cat_day_assignments: dict[str, int] | None = None,
    match_duration: int = 10,
    changeover: int = 5,
    min_rest_matches: int = 1,
    max_consecutive: int = 2,
    scheduling_mode: str = "CATEGORY_BLOCK",
) -> Tournament:
    """Create a fully configured tournament with categories, teams, days, fields."""
    club = ClubFactory(owner=user)
    start = date(2025, 6, 14)
    end = start + timedelta(days=max(1, n_days) - 1)

    tournament = TournamentFactory(
        club=club,
        name="Tournoi Test",
        start_date=start,
        end_date=end,
        default_match_duration=match_duration,
        default_transition_time=changeover,
        default_rest_time=20,
        default_min_rest_matches=min_rest_matches,
        max_consecutive_matches=max_consecutive,
        scheduling_mode=scheduling_mode,
    )

    # Create days
    days = []
    if day_configs:
        for i, dc in enumerate(day_configs):
            d = DayFactory(
                tournament=tournament,
                date=start + timedelta(days=i),
                label=dc.get("label", f"Jour {i + 1}"),
                start_time=dc.get("start_time", "08:30"),
                end_time=dc.get("end_time", "17:30"),
                lunch_start=dc.get("lunch_start", "12:00"),
                lunch_end=dc.get("lunch_end", "13:00"),
                order=i,
            )
            days.append(d)
    else:
        for i in range(n_days):
            d = DayFactory(
                tournament=tournament,
                date=start + timedelta(days=i),
                label=f"Jour {i + 1}",
                order=i,
            )
            days.append(d)

    # Create fields
    for i in range(n_fields):
        FieldFactory(
            tournament=tournament,
            name=f"Terrain {chr(65 + i)}",
            display_order=i,
            availability=[
                {"date": str(start + timedelta(days=d)), "start": "08:00", "end": "19:00"}
                for d in range(n_days)
            ],
        )

    # Create categories and teams
    for order, (cat_name, n_teams) in enumerate(n_teams_per_cat.items()):
        day_id = None
        if cat_day_assignments and cat_name in cat_day_assignments:
            day_idx = cat_day_assignments[cat_name]
            day_id = days[day_idx].id if day_idx < len(days) else None

        cat = CategoryFactory(
            tournament=tournament,
            name=cat_name,
            display_order=order,
            match_duration=match_duration,
            day_id=day_id,
        )
        for ti in range(n_teams):
            TeamFactory(
                tournament=tournament,
                category=cat,
                name=f"{cat_name} Eq {ti + 1}",
            )

    return tournament


def _auto_generate_all_pools(tournament):
    """Auto-generate pools for all categories in a tournament."""
    categories = Category.objects.filter(tournament=tournament).order_by("display_order")
    for cat in categories:
        result = auto_generate_pools(cat)
        assert len(result.get("pools", [])) > 0, f"No pools created for {cat.name}"


def _finish_all_pool_matches(tournament, *, home_score=2, away_score=1):
    """Simulate finishing all pool matches with given scores."""
    pool_matches = Match.objects.filter(
        tournament=tournament,
        phase=Match.Phase.GROUP,
    ).order_by("start_time")

    for match in pool_matches:
        match.status = Match.Status.LIVE
        match.save(update_fields=["status"])

        match.score_home = home_score
        match.score_away = away_score
        match.status = Match.Status.FINISHED
        match.score_validated = True
        match.save(update_fields=[
            "score_home", "score_away", "status", "score_validated", "updated_at",
        ])


# ─── Unit Tests ──────────────────────────────────────────────────────────────


class TestRoundRobin:
    """Test round-robin match generation."""

    def test_4_teams_generates_6_matches(self, db):
        """C(4,2) = 6 matches."""
        user = UserFactory()
        t = _create_tournament_setup(
            user, n_teams_per_cat={"U10": 4}, n_fields=2, n_days=1,
        )
        cat = Category.objects.get(tournament=t, name="U10")
        _auto_generate_all_pools(t)
        group = Group.objects.get(category=cat)
        team_ids = list(group.teams.values_list("id", flat=True))
        matches = gen_round_robin(team_ids, group, cat, t)
        assert len(matches) == 6

    def test_5_teams_generates_10_matches(self, db):
        """C(5,2) = 10 matches (BYE round for odd teams)."""
        user = UserFactory()
        t = _create_tournament_setup(
            user, n_teams_per_cat={"U10": 5}, n_fields=2, n_days=1,
        )
        cat = Category.objects.get(tournament=t, name="U10")
        _auto_generate_all_pools(t)
        group = Group.objects.get(category=cat)
        team_ids = list(group.teams.values_list("id", flat=True))
        matches = gen_round_robin(team_ids, group, cat, t)
        assert len(matches) == 10

    def test_3_teams_generates_3_matches(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user, n_teams_per_cat={"U10": 3}, n_fields=2, n_days=1,
        )
        cat = Category.objects.get(tournament=t, name="U10")
        _auto_generate_all_pools(t)
        group = Group.objects.get(category=cat)
        team_ids = list(group.teams.values_list("id", flat=True))
        matches = gen_round_robin(team_ids, group, cat, t)
        assert len(matches) == 3


class TestAutoGeneratePools:
    """Test automatic pool generation."""

    def test_4_teams_1_pool(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user, n_teams_per_cat={"U10": 4}, n_fields=2, n_days=1,
        )
        cat = Category.objects.get(tournament=t, name="U10")
        result = auto_generate_pools(cat)
        assert len(result["pools"]) == 1
        assert result["pools"][0].teams.count() == 4

    def test_8_teams_2_pools(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user, n_teams_per_cat={"U10": 8}, n_fields=2, n_days=1,
        )
        cat = Category.objects.get(tournament=t, name="U10")
        result = auto_generate_pools(cat)
        assert len(result["pools"]) == 2
        total_teams = sum(p.teams.count() for p in result["pools"])
        assert total_teams == 8

    def test_16_teams_4_pools(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user, n_teams_per_cat={"U10": 16}, n_fields=4, n_days=1,
        )
        cat = Category.objects.get(tournament=t, name="U10")
        result = auto_generate_pools(cat)
        assert len(result["pools"]) == 4
        total_teams = sum(p.teams.count() for p in result["pools"])
        assert total_teams == 16


class TestFeasibility:
    """Test feasibility calculation."""

    def test_feasible_small(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user, n_teams_per_cat={"U10": 8}, n_fields=2, n_days=1,
        )
        _auto_generate_all_pools(t)
        result = calculate_feasibility(t)
        assert result["total_matches"] > 0
        assert result["fields_count"] == 2

    def test_infeasible_too_many_matches(self, db):
        """50 teams with 1 field for 1 short day should be infeasible."""
        user = UserFactory()
        t = _create_tournament_setup(
            user, n_teams_per_cat={"U10": 50}, n_fields=1, n_days=1,
            day_configs=[{
                "start_time": "09:00", "end_time": "10:00",
                "lunch_start": "", "lunch_end": "",
            }],
            match_duration=15,
        )
        _auto_generate_all_pools(t)
        result = calculate_feasibility(t)
        assert not result["feasible"]


# ─── Integration Tests: Full Flow ───────────────────────────────────────────


class TestFullFlow16Teams:
    """16 teams, 1 category, 4 pools of 4 teams."""

    def test_full_flow(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user,
            n_teams_per_cat={"U10": 16},
            n_fields=4,
            n_days=1,
            day_configs=[{
                "label": "Samedi",
                "start_time": "08:30",
                "end_time": "17:30",
                "lunch_start": "12:00",
                "lunch_end": "13:00",
            }],
            match_duration=10,
            changeover=5,
        )

        # 1. Auto-generate pools
        _auto_generate_all_pools(t)
        cat = Category.objects.get(tournament=t, name="U10")
        pools = Group.objects.filter(category=cat)
        assert pools.count() == 4
        for p in pools:
            assert p.teams.count() == 4

        # 2. Check feasibility
        feas = calculate_feasibility(t)
        assert feas["total_matches"] == 24  # 4 pools × C(4,2) = 4 × 6 = 24
        assert feas["feasible"]

        # 3. Generate schedule
        result = generate_schedule(t)
        assert result["success"], f"Schedule failed: {result.get('error')}"
        assert result["stats"]["total_matches"] == 24

        # 4. Verify all matches created
        matches = Match.objects.filter(tournament=t, phase=Match.Phase.GROUP)
        assert matches.count() == 24
        assert all(m.field is not None for m in matches)
        assert all(m.start_time is not None for m in matches)

        # 5. Verify no team plays two matches at the same time
        self._check_no_time_conflicts(t)

        # 6. Score all pool matches
        _finish_all_pool_matches(t)

        # 7. Check standings
        for grp in pools:
            standings = compute_group_standings(grp.id, bypass_cache=True)
            assert len(standings) == 4
            assert all(s["played"] == 3 for s in standings)  # each team plays 3

        # 8. Generate finals
        result = generate_finals(cat)
        assert result["success"]
        assert result["match_count"] >= 2  # at least semi-finals

        finals = Match.objects.filter(tournament=t).exclude(phase=Match.Phase.GROUP)
        assert finals.count() > 0

    def _check_no_time_conflicts(self, tournament):
        """Verify no team plays two matches at the same time slot."""
        matches = Match.objects.filter(tournament=tournament).order_by("slot_index")
        team_slots: dict[int, set] = {}
        for m in matches:
            slot = m.slot_index
            if slot is None:
                continue
            for tid in [m.team_home_id, m.team_away_id]:
                if tid:
                    if tid in team_slots and slot in team_slots[tid]:
                        raise AssertionError(
                            f"Team {tid} plays twice in slot {slot}"
                        )
                    team_slots.setdefault(tid, set()).add(slot)


class TestFullFlow50Teams:
    """50 teams, 2 categories (25 each), 4 fields, 1 day."""

    def test_generation_and_constraints(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user,
            n_teams_per_cat={"U10": 25, "U12": 25},
            n_fields=4,
            n_days=1,
            day_configs=[{
                "label": "Samedi",
                "start_time": "08:00",
                "end_time": "18:00",
                "lunch_start": "12:00",
                "lunch_end": "13:00",
            }],
            match_duration=10,
            changeover=5,
        )

        # Auto-generate pools for all categories
        _auto_generate_all_pools(t)

        # Check total match count
        feas = calculate_feasibility(t)
        assert feas["total_matches"] > 0

        # Generate schedule
        result = generate_schedule(t)
        assert result["success"], f"Schedule failed: {result.get('error')}"

        # Verify matches created
        matches = Match.objects.filter(tournament=t, phase=Match.Phase.GROUP)
        assert matches.count() == result["stats"]["total_matches"]
        assert matches.count() > 0

        # All matches have times and fields
        for m in matches:
            assert m.start_time is not None
            assert m.field is not None

        # Check no field double-booking
        self._check_no_field_conflicts(t)

    def _check_no_field_conflicts(self, tournament):
        """Verify no field has two matches at the same time slot."""
        matches = Match.objects.filter(tournament=tournament)
        field_slots: dict = {}
        for m in matches:
            key = (m.field_id, m.slot_index)
            if key in field_slots:
                raise AssertionError(
                    f"Field {m.field_id} has two matches in slot {m.slot_index}: "
                    f"{field_slots[key]} and {m.id}"
                )
            field_slots[key] = m.id


class TestFullFlow100Teams:
    """100 teams, 4 categories (25 each), 6 fields, 2 days."""

    def test_multi_day_scheduling(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user,
            n_teams_per_cat={"U8": 25, "U10": 25, "U11": 25, "U13": 25},
            n_fields=6,
            n_days=2,
            day_configs=[
                {
                    "label": "Samedi — Petits",
                    "start_time": "08:30",
                    "end_time": "17:00",
                    "lunch_start": "12:00",
                    "lunch_end": "13:00",
                },
                {
                    "label": "Dimanche — Grands",
                    "start_time": "08:30",
                    "end_time": "17:00",
                    "lunch_start": "12:00",
                    "lunch_end": "13:00",
                },
            ],
            cat_day_assignments={"U8": 0, "U10": 0, "U11": 1, "U13": 1},
            match_duration=10,
            changeover=5,
        )

        _auto_generate_all_pools(t)

        feas = calculate_feasibility(t)
        assert feas["total_matches"] > 0
        assert feas["days_count"] == 2

        result = generate_schedule(t)
        assert result["success"], f"Schedule failed: {result.get('error')}"

        matches = Match.objects.filter(tournament=t, phase=Match.Phase.GROUP)
        assert matches.count() == result["stats"]["total_matches"]

        # Verify day assignments
        days = Day.objects.filter(tournament=t).order_by("order")
        day1_date = days[0].date
        day2_date = days[1].date

        cat_u8 = Category.objects.get(tournament=t, name="U8")
        cat_u13 = Category.objects.get(tournament=t, name="U13")

        u8_matches = matches.filter(category=cat_u8)
        u13_matches = matches.filter(category=cat_u13)

        # U8 should be on day 1
        for m in u8_matches:
            assert m.start_time.date() == day1_date, f"U8 match on wrong day: {m.start_time.date()}"

        # U13 should be on day 2
        for m in u13_matches:
            assert m.start_time.date() == day2_date, f"U13 match on wrong day: {m.start_time.date()}"


class TestFullFlow300Teams:
    """300 teams, 6 categories (50 each), 8 fields, 2 days.

    Matches the test-planning-300.mjs from tournoi-exemple.
    """

    def test_large_tournament(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user,
            n_teams_per_cat={
                "U8": 50, "U9": 50, "U10": 50,
                "U11": 50, "U12": 50, "U13": 50,
            },
            n_fields=8,
            n_days=2,
            day_configs=[
                {
                    "label": "Samedi — Petits (U8/U9/U10)",
                    "start_time": "08:30",
                    "end_time": "17:30",
                    "lunch_start": "12:00",
                    "lunch_end": "13:00",
                },
                {
                    "label": "Dimanche — Grands (U11/U12/U13)",
                    "start_time": "08:30",
                    "end_time": "17:30",
                    "lunch_start": "12:00",
                    "lunch_end": "13:00",
                },
            ],
            cat_day_assignments={
                "U8": 0, "U9": 0, "U10": 0,
                "U11": 1, "U12": 1, "U13": 1,
            },
            match_duration=10,
            changeover=5,
            min_rest_matches=1,
            max_consecutive=2,
        )

        # 1. Auto-generate pools for all categories
        _auto_generate_all_pools(t)

        # Verify pool structure
        for cat_name in ["U8", "U9", "U10", "U11", "U12", "U13"]:
            cat = Category.objects.get(tournament=t, name=cat_name)
            pools = Group.objects.filter(category=cat)
            total_teams = sum(p.teams.count() for p in pools)
            assert total_teams == 50, f"{cat_name}: expected 50 teams, got {total_teams}"
            for p in pools:
                assert p.teams.count() >= 2, f"{cat_name} {p.name}: fewer than 2 teams"

        # 2. Check feasibility
        feas = calculate_feasibility(t)
        assert feas["total_matches"] > 0
        assert feas["fields_count"] == 8
        assert feas["days_count"] == 2
        # With 300 teams in 6 categories, total matches should be substantial
        # Each cat has ~50 teams in ~13 pools of ~4, so ~13 × 6 = 78 matches per cat
        # Total ~ 468 matches
        assert feas["total_matches"] > 400

        # 3. Generate schedule
        result = generate_schedule(t)
        assert result["success"], f"Schedule failed: {result.get('error')}"
        assert result["stats"]["total_matches"] > 400

        # 4. Verify all matches have slots
        matches = Match.objects.filter(tournament=t, phase=Match.Phase.GROUP)
        assert matches.count() == result["stats"]["total_matches"]

        for m in matches.iterator():
            assert m.field is not None, f"Match {m.id} has no field"
            assert m.start_time is not None, f"Match {m.id} has no start_time"
            assert m.slot_index is not None, f"Match {m.id} has no slot_index"

        # 5. Verify day separation
        days = Day.objects.filter(tournament=t).order_by("order")
        day1_date = days[0].date
        day2_date = days[1].date

        for cat_name in ["U8", "U9", "U10"]:
            cat = Category.objects.get(tournament=t, name=cat_name)
            cat_matches = matches.filter(category=cat)
            for m in cat_matches:
                assert m.start_time.date() == day1_date, (
                    f"{cat_name} match on wrong day: {m.start_time.date()}"
                )

        for cat_name in ["U11", "U12", "U13"]:
            cat = Category.objects.get(tournament=t, name=cat_name)
            cat_matches = matches.filter(category=cat)
            for m in cat_matches:
                assert m.start_time.date() == day2_date, (
                    f"{cat_name} match on wrong day: {m.start_time.date()}"
                )

        # 6. Check rest constraints (sample check)
        self._check_rest_constraints(t, max_violations_pct=10)

    def _check_rest_constraints(self, tournament, max_violations_pct=10):
        """Check that most teams respect rest constraints."""
        matches = list(
            Match.objects.filter(tournament=tournament, phase=Match.Phase.GROUP)
            .order_by("slot_index", "start_time")
        )

        team_matches: dict[int, list] = {}
        for m in matches:
            for tid in [m.team_home_id, m.team_away_id]:
                if tid:
                    team_matches.setdefault(tid, []).append(m)

        violations = 0
        total_checks = 0
        for tid, tms in team_matches.items():
            sorted_ms = sorted(tms, key=lambda x: x.slot_index or 0)
            for i in range(1, len(sorted_ms)):
                prev = sorted_ms[i - 1]
                curr = sorted_ms[i]
                if prev.slot_index is not None and curr.slot_index is not None:
                    gap = curr.slot_index - prev.slot_index
                    total_checks += 1
                    if gap < 1:  # min_rest_matches=1
                        violations += 1

        if total_checks > 0:
            violation_pct = violations / total_checks * 100
            assert violation_pct <= max_violations_pct, (
                f"Too many rest violations: {violations}/{total_checks} "
                f"({violation_pct:.1f}%)"
            )


class TestScoreEntryAndFinals:
    """Test the full score entry → standings → finals flow."""

    def test_score_updates_standings(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user,
            n_teams_per_cat={"U10": 4},
            n_fields=2,
            n_days=1,
        )
        _auto_generate_all_pools(t)
        result = generate_schedule(t)
        assert result["success"]

        # Score first match: 3-0
        match = Match.objects.filter(tournament=t, phase=Match.Phase.GROUP).first()
        match.status = Match.Status.LIVE
        match.save(update_fields=["status"])
        match.score_home = 3
        match.score_away = 0
        match.status = Match.Status.FINISHED
        match.score_validated = True
        match.save(update_fields=["score_home", "score_away", "status", "score_validated"])

        # Check standings
        group = Group.objects.filter(category__tournament=t).first()
        standings = compute_group_standings(group.id, bypass_cache=True)
        scored_teams = [s for s in standings if s["played"] > 0]
        assert len(scored_teams) == 2

        winner = next(s for s in standings if s["team_id"] == match.team_home_id)
        loser = next(s for s in standings if s["team_id"] == match.team_away_id)
        assert winner["points"] == 3
        assert loser["points"] == 0
        assert winner["goals_for"] == 3
        assert loser["goals_against"] == 3

    def test_finals_generation_with_2_pools(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user,
            n_teams_per_cat={"U10": 8},
            n_fields=2,
            n_days=1,
        )
        _auto_generate_all_pools(t)
        result = generate_schedule(t)
        assert result["success"]

        _finish_all_pool_matches(t)

        cat = Category.objects.get(tournament=t, name="U10")
        result = generate_finals(cat)
        assert result["success"]
        assert result["match_count"] == 4  # 2 semis + third place + final

        semis = Match.objects.filter(category=cat, phase=Match.Phase.SEMI)
        assert semis.count() == 2

        final = Match.objects.filter(category=cat, phase=Match.Phase.FINAL)
        assert final.count() == 1

        third = Match.objects.filter(category=cat, phase=Match.Phase.THIRD_PLACE)
        assert third.count() == 1

        # Final should reference semis as sources
        final_match = final.first()
        assert final_match.source_home is not None
        assert final_match.source_away is not None
        assert final_match.source_home_type == "winner"
        assert final_match.source_away_type == "winner"

    def test_bracket_propagation(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user,
            n_teams_per_cat={"U10": 8},
            n_fields=2,
            n_days=1,
        )
        _auto_generate_all_pools(t)
        result = generate_schedule(t)
        assert result["success"]

        _finish_all_pool_matches(t)

        cat = Category.objects.get(tournament=t, name="U10")
        result = generate_finals(cat)
        assert result["success"]

        # Score semi-finals
        semis = list(Match.objects.filter(category=cat, phase=Match.Phase.SEMI).order_by("start_time"))
        for semi in semis:
            semi.status = Match.Status.LIVE
            semi.save(update_fields=["status"])
            semi.score_home = 2
            semi.score_away = 1
            semi.status = Match.Status.FINISHED
            semi.score_validated = True
            semi.save(update_fields=["score_home", "score_away", "status", "score_validated"])
            propagate_winner(semi)

        # Check final has teams assigned
        final = Match.objects.get(category=cat, phase=Match.Phase.FINAL)
        assert final.team_home_id is not None, "Final home team not set"
        assert final.team_away_id is not None, "Final away team not set"

        # Winners of semis should be in the final
        assert final.team_home_id == semis[0].team_home_id  # home won 2-1
        assert final.team_away_id == semis[1].team_home_id

        # Third place should have losers
        third = Match.objects.get(category=cat, phase=Match.Phase.THIRD_PLACE)
        assert third.team_home_id == semis[0].team_away_id
        assert third.team_away_id == semis[1].team_away_id


class TestSchedulingModes:
    """Test different scheduling modes."""

    def test_interleave_mode(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user,
            n_teams_per_cat={"U8": 8, "U10": 8},
            n_fields=2,
            n_days=1,
            scheduling_mode="INTERLEAVE",
        )
        _auto_generate_all_pools(t)
        result = generate_schedule(t)
        assert result["success"]

        # In interleave mode, categories should be mixed
        matches = list(
            Match.objects.filter(tournament=t, phase=Match.Phase.GROUP)
            .order_by("slot_index")
        )
        assert len(matches) > 0

        # Check that both categories appear in the first 10 matches
        cat_ids_in_first = set()
        for m in matches[:min(10, len(matches))]:
            cat_ids_in_first.add(m.category_id)
        assert len(cat_ids_in_first) == 2, "Interleave should mix categories"

    def test_category_block_mode(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user,
            n_teams_per_cat={"U8": 8, "U10": 8},
            n_fields=2,
            n_days=1,
            scheduling_mode="CATEGORY_BLOCK",
        )
        _auto_generate_all_pools(t)
        result = generate_schedule(t)
        assert result["success"]

        matches = list(
            Match.objects.filter(tournament=t, phase=Match.Phase.GROUP)
            .order_by("slot_index")
        )
        assert len(matches) > 0


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_no_categories_error(self, db):
        user = UserFactory()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        DayFactory(tournament=t)
        FieldFactory(tournament=t)
        result = generate_schedule(t)
        assert not result["success"]
        assert "catégorie" in result["error"].lower()

    def test_no_fields_error(self, db):
        user = UserFactory()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        DayFactory(tournament=t)
        cat = CategoryFactory(tournament=t)
        result = generate_schedule(t)
        assert not result["success"]
        assert "terrain" in result["error"].lower()

    def test_no_days_error(self, db):
        user = UserFactory()
        club = ClubFactory(owner=user)
        t = TournamentFactory(club=club)
        FieldFactory(tournament=t)
        cat = CategoryFactory(tournament=t)
        result = generate_schedule(t)
        assert not result["success"]
        assert "journée" in result["error"].lower()

    def test_no_pools_error(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user, n_teams_per_cat={"U10": 4}, n_fields=2, n_days=1,
        )
        # Don't create pools
        result = generate_schedule(t)
        assert not result["success"]
        assert "poule" in result["error"].lower()

    def test_finals_before_all_matches_finished_error(self, db):
        user = UserFactory()
        t = _create_tournament_setup(
            user, n_teams_per_cat={"U10": 4}, n_fields=2, n_days=1,
        )
        _auto_generate_all_pools(t)
        result = generate_schedule(t)
        assert result["success"]

        cat = Category.objects.get(tournament=t, name="U10")
        result = generate_finals(cat)
        assert not result["success"]
        assert "non terminé" in result["error"]
