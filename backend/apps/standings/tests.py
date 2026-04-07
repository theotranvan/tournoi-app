"""Tests for standings computation, caching, and tiebreakers."""

import pytest
from django.core.cache import cache
from django.utils import timezone

from apps.accounts.models import User
from apps.clubs.models import Club
from apps.matches.models import Match
from apps.standings.services import (
    CACHE_TTL,
    _cache_key,
    compute_group_standings,
    invalidate_category_standings,
    invalidate_standings,
)
from apps.teams.models import Group, Team
from apps.tournaments.models import Category, Tournament

pytestmark = pytest.mark.django_db


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture()
def organizer():
    return User.objects.create_user(username="org_st", password="pass", role="organizer")


@pytest.fixture()
def tournament(organizer):
    club = Club.objects.create(name="Test Club", owner=organizer)
    return Tournament.objects.create(
        club=club,
        name="Standing Cup",
        slug="standing-cup",
        location="Paris",
        start_date="2026-06-01",
        end_date="2026-06-02",
    )


@pytest.fixture()
def category(tournament):
    return Category.objects.create(
        tournament=tournament,
        name="U12",
        points_win=3,
        points_draw=1,
        points_loss=0,
    )


@pytest.fixture()
def group_with_teams(tournament, category):
    """4 teams in one group."""
    grp = Group.objects.create(category=category, name="A")
    teams = []
    for name in ["Alpha", "Beta", "Gamma", "Delta"]:
        t = Team.objects.create(name=name, tournament=tournament, category=category)
        grp.teams.add(t)
        teams.append(t)
    return grp, teams


def _make_finished_match(tournament, category, group, home, away, score_home, score_away, hour=10):
    return Match.objects.create(
        tournament=tournament,
        category=category,
        group=group,
        team_home=home,
        team_away=away,
        score_home=score_home,
        score_away=score_away,
        status=Match.Status.FINISHED,
        start_time=timezone.now().replace(hour=hour, minute=0),
        duration_minutes=15,
    )


# ─── Basic Standings ─────────────────────────────────────────────────────────


class TestBasicStandings:
    def test_empty_group_returns_all_teams_zero_stats(self, group_with_teams):
        grp, teams = group_with_teams
        standings = compute_group_standings(grp.id, bypass_cache=True)
        assert len(standings) == 4
        for s in standings:
            assert s["played"] == 0
            assert s["points"] == 0
            assert s["form"] == []

    def test_single_match_updates_stats(self, tournament, category, group_with_teams):
        grp, teams = group_with_teams
        _make_finished_match(tournament, category, grp, teams[0], teams[1], 2, 1)
        standings = compute_group_standings(grp.id, bypass_cache=True)

        alpha = next(s for s in standings if s["team_name"] == "Alpha")
        beta = next(s for s in standings if s["team_name"] == "Beta")

        assert alpha["won"] == 1
        assert alpha["points"] == 3
        assert alpha["goals_for"] == 2
        assert beta["lost"] == 1
        assert beta["points"] == 0

    def test_draw_gives_draw_points(self, tournament, category, group_with_teams):
        grp, teams = group_with_teams
        _make_finished_match(tournament, category, grp, teams[0], teams[1], 1, 1)
        standings = compute_group_standings(grp.id, bypass_cache=True)

        alpha = next(s for s in standings if s["team_name"] == "Alpha")
        beta = next(s for s in standings if s["team_name"] == "Beta")

        assert alpha["drawn"] == 1
        assert alpha["points"] == 1
        assert beta["points"] == 1

    def test_ranking_order_by_points(self, tournament, category, group_with_teams):
        grp, teams = group_with_teams
        # Alpha beats Beta, Alpha beats Gamma
        _make_finished_match(tournament, category, grp, teams[0], teams[1], 3, 0, hour=10)
        _make_finished_match(tournament, category, grp, teams[0], teams[2], 2, 0, hour=11)
        _make_finished_match(tournament, category, grp, teams[1], teams[2], 1, 0, hour=12)

        standings = compute_group_standings(grp.id, bypass_cache=True)
        assert standings[0]["team_name"] == "Alpha"
        assert standings[0]["rank"] == 1
        assert standings[1]["team_name"] == "Beta"
        assert standings[1]["rank"] == 2

    def test_goal_difference_tiebreaker(self, tournament, category, group_with_teams):
        grp, teams = group_with_teams
        # Both Alpha and Beta win one, lose one, but Alpha has better GD
        _make_finished_match(tournament, category, grp, teams[0], teams[2], 5, 0, hour=10)
        _make_finished_match(tournament, category, grp, teams[1], teams[3], 2, 0, hour=11)
        _make_finished_match(tournament, category, grp, teams[2], teams[1], 1, 0, hour=12)
        _make_finished_match(tournament, category, grp, teams[3], teams[0], 1, 0, hour=13)

        standings = compute_group_standings(grp.id, bypass_cache=True)
        # Alpha: 3pts, GD +4; Beta: 3pts, GD +1
        alpha = next(s for s in standings if s["team_name"] == "Alpha")
        beta = next(s for s in standings if s["team_name"] == "Beta")
        assert alpha["rank"] < beta["rank"]


# ─── Head-to-Head Tiebreaker ────────────────────────────────────────────────


class TestHeadToHead:
    def test_h2h_breaks_tie(self, tournament, category, group_with_teams):
        grp, teams = group_with_teams
        # Alpha and Beta both beat Gamma, same GD, but Alpha beat Beta h2h
        _make_finished_match(tournament, category, grp, teams[0], teams[1], 1, 0, hour=10)
        _make_finished_match(tournament, category, grp, teams[0], teams[2], 2, 1, hour=11)
        _make_finished_match(tournament, category, grp, teams[1], teams[2], 2, 1, hour=12)

        standings = compute_group_standings(grp.id, bypass_cache=True)
        assert standings[0]["team_name"] == "Alpha"
        assert standings[1]["team_name"] == "Beta"


# ─── Form Tracking ──────────────────────────────────────────────────────────


class TestFormTracking:
    def test_form_shows_last_5_results(self, tournament, category, group_with_teams):
        grp, teams = group_with_teams
        # Play 6 matches for Alpha
        for i, (opp, sh, sa) in enumerate([
            (teams[1], 1, 0),  # W
            (teams[2], 0, 0),  # D
            (teams[3], 0, 1),  # L
            (teams[1], 2, 0),  # W
            (teams[2], 3, 0),  # W
            (teams[3], 1, 1),  # D
        ]):
            _make_finished_match(tournament, category, grp, teams[0], opp, sh, sa, hour=8 + i)

        standings = compute_group_standings(grp.id, bypass_cache=True)
        alpha = next(s for s in standings if s["team_name"] == "Alpha")
        # Last 5: D, L, W, W, D
        assert alpha["form"] == ["D", "L", "W", "W", "D"]
        assert len(alpha["form"]) == 5


# ─── Cache Behavior ─────────────────────────────────────────────────────────


class TestCache:
    def setup_method(self):
        cache.clear()

    def test_result_is_cached(self, tournament, category, group_with_teams):
        grp, teams = group_with_teams
        _make_finished_match(tournament, category, grp, teams[0], teams[1], 1, 0)

        # First call computes
        r1 = compute_group_standings(grp.id)
        # Second call should hit cache
        r2 = compute_group_standings(grp.id)
        assert r1 == r2
        assert cache.get(_cache_key(grp.id)) is not None

    def test_invalidate_clears_cache(self, tournament, category, group_with_teams):
        grp, teams = group_with_teams
        compute_group_standings(grp.id)
        assert cache.get(_cache_key(grp.id)) is not None

        invalidate_standings(grp.id)
        assert cache.get(_cache_key(grp.id)) is None

    def test_invalidate_category_clears_all_groups(self, tournament, category):
        g1 = Group.objects.create(category=category, name="X")
        g2 = Group.objects.create(category=category, name="Y")
        compute_group_standings(g1.id)
        compute_group_standings(g2.id)

        invalidate_category_standings(category.id)
        assert cache.get(_cache_key(g1.id)) is None
        assert cache.get(_cache_key(g2.id)) is None

    def test_bypass_cache_ignores_cached(self, tournament, category, group_with_teams):
        grp, teams = group_with_teams
        compute_group_standings(grp.id)

        # Add a match — cache still has old data
        _make_finished_match(tournament, category, grp, teams[0], teams[1], 5, 0)

        cached = compute_group_standings(grp.id)  # from cache, no new match
        fresh = compute_group_standings(grp.id, bypass_cache=True)  # recomputed

        alpha_cached = next(s for s in cached if s["team_name"] == "Alpha")
        alpha_fresh = next(s for s in fresh if s["team_name"] == "Alpha")
        assert alpha_cached["played"] == 0  # old cache
        assert alpha_fresh["played"] == 1  # fresh


# ─── Custom Points Config ───────────────────────────────────────────────────


class TestCustomPoints:
    def test_custom_win_draw_loss_points(self, tournament):
        cat = Category.objects.create(
            tournament=tournament,
            name="Custom",
            points_win=5,
            points_draw=2,
            points_loss=1,
        )
        grp = Group.objects.create(category=cat, name="Z")
        t1 = Team.objects.create(name="T1", tournament=tournament, category=cat)
        t2 = Team.objects.create(name="T2", tournament=tournament, category=cat)
        grp.teams.add(t1, t2)

        _make_finished_match(tournament, cat, grp, t1, t2, 0, 0)

        standings = compute_group_standings(grp.id, bypass_cache=True)
        assert standings[0]["points"] == 2  # draw = 2
        assert standings[1]["points"] == 2


# ─── Edge Cases ──────────────────────────────────────────────────────────────


class TestEdgeCases:
    def test_non_finished_matches_ignored(self, tournament, category, group_with_teams):
        grp, teams = group_with_teams
        Match.objects.create(
            tournament=tournament,
            category=category,
            group=grp,
            team_home=teams[0],
            team_away=teams[1],
            status=Match.Status.LIVE,
            score_home=3,
            score_away=0,
            start_time=timezone.now(),
            duration_minutes=15,
        )
        standings = compute_group_standings(grp.id, bypass_cache=True)
        alpha = next(s for s in standings if s["team_name"] == "Alpha")
        assert alpha["played"] == 0  # LIVE match not counted

    def test_team_not_in_group_match_ignored(self, tournament, category, group_with_teams):
        """A match referencing a team not in the group's M2M is skipped."""
        grp, teams = group_with_teams
        outsider = Team.objects.create(name="Outsider", tournament=tournament, category=category)
        # Don't add outsider to group
        _make_finished_match(tournament, category, grp, teams[0], outsider, 1, 0)
        standings = compute_group_standings(grp.id, bypass_cache=True)
        alpha = next(s for s in standings if s["team_name"] == "Alpha")
        assert alpha["played"] == 0  # match with outsider ignored


# ─── Standings Views API ─────────────────────────────────────────────────────


class TestStandingsViewsAPI:
    def setup_method(self):
        cache.clear()

    def test_category_standings_view_requires_auth(self, category):
        from rest_framework.test import APIClient
        api = APIClient()
        resp = api.get(f"/api/v1/categories/{category.id}/standings/")
        assert resp.status_code == 401

    def test_category_standings_view_returns_groups(self, organizer, tournament, category, group_with_teams):
        from rest_framework.test import APIClient
        grp, teams = group_with_teams
        api = APIClient()
        api.force_authenticate(user=organizer)
        resp = api.get(f"/api/v1/categories/{category.id}/standings/")
        assert resp.status_code == 200
        assert resp.data["category"]["name"] == "U12"
        assert len(resp.data["groups"]) == 1
        assert resp.data["groups"][0]["group"]["name"] == "A"

    def test_group_standings_view_returns_standings(self, organizer, tournament, category, group_with_teams):
        from rest_framework.test import APIClient
        grp, teams = group_with_teams
        _make_finished_match(tournament, category, grp, teams[0], teams[1], 2, 0)
        api = APIClient()
        api.force_authenticate(user=organizer)
        resp = api.get(f"/api/v1/groups/{grp.id}/standings/")
        assert resp.status_code == 200
        assert resp.data["group"]["name"] == "A"
        standings = resp.data["standings"]
        assert len(standings) == 4
        alpha = next(s for s in standings if s["team_name"] == "Alpha")
        assert alpha["points"] == 3

    def test_standings_refresh_view_recalculates(self, organizer, tournament, category, group_with_teams):
        from rest_framework.test import APIClient
        grp, teams = group_with_teams
        _make_finished_match(tournament, category, grp, teams[0], teams[1], 1, 0)
        # Warm cache
        compute_group_standings(grp.id)

        api = APIClient()
        api.force_authenticate(user=organizer)
        resp = api.post(f"/api/v1/categories/{category.id}/standings/refresh/")
        assert resp.status_code == 200
        assert resp.data["category"]["name"] == "U12"
        standings = resp.data["groups"][0]["standings"]
        alpha = next(s for s in standings if s["team_name"] == "Alpha")
        assert alpha["won"] == 1
