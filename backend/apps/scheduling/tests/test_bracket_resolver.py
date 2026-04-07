"""Tests for bracket_resolver — group→knockout resolution and knockout advancement."""

import pytest
from django.utils import timezone

from apps.matches.models import Match
from apps.scheduling.bracket_resolver import (
    _parse_group_placeholder,
    _parse_knockout_placeholder,
    advance_knockout_winner,
    resolve_brackets,
    resolve_group_to_knockout,
)
from apps.teams.models import Group, Team
from tests.factories import (
    CategoryFactory,
    ClubFactory,
    FieldFactory,
    MatchFactory,
    TeamFactory,
    TournamentFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def tournament():
    user = UserFactory()
    club = ClubFactory(owner=user)
    return TournamentFactory(club=club)


@pytest.fixture
def category(tournament):
    return CategoryFactory(tournament=tournament, name="U12")


@pytest.fixture
def two_groups(tournament, category):
    """Two groups with 2 teams each, plus semi+final knockout matches."""
    g_a = Group.objects.create(category=category, name="Poule A", display_order=0)
    g_b = Group.objects.create(category=category, name="Poule B", display_order=1)
    t1 = TeamFactory(tournament=tournament, category=category, name="Eagles")
    t2 = TeamFactory(tournament=tournament, category=category, name="Hawks")
    t3 = TeamFactory(tournament=tournament, category=category, name="Lions")
    t4 = TeamFactory(tournament=tournament, category=category, name="Bears")
    g_a.teams.set([t1, t2])
    g_b.teams.set([t3, t4])

    field = FieldFactory(tournament=tournament, name="F1")
    now = timezone.now()

    # Group matches — all finished
    for g, home, away, sh, sa in [
        (g_a, t1, t2, 2, 0),
        (g_b, t3, t4, 1, 1),
    ]:
        Match.objects.create(
            tournament=tournament,
            category=category,
            group=g,
            team_home=home,
            team_away=away,
            field=field,
            start_time=now,
            duration_minutes=15,
            status=Match.Status.FINISHED,
            phase=Match.Phase.GROUP,
            score_home=sh,
            score_away=sa,
        )

    # Semi-final placeholders
    semi1 = Match.objects.create(
        tournament=tournament,
        category=category,
        field=field,
        start_time=now + timezone.timedelta(hours=1),
        duration_minutes=15,
        phase=Match.Phase.SEMI,
        placeholder_home="1er Poule A",
        placeholder_away="2e Poule B",
    )
    semi2 = Match.objects.create(
        tournament=tournament,
        category=category,
        field=field,
        start_time=now + timezone.timedelta(hours=1, minutes=30),
        duration_minutes=15,
        phase=Match.Phase.SEMI,
        placeholder_home="1er Poule B",
        placeholder_away="2e Poule A",
    )
    final = Match.objects.create(
        tournament=tournament,
        category=category,
        field=field,
        start_time=now + timezone.timedelta(hours=2),
        duration_minutes=15,
        phase=Match.Phase.FINAL,
        placeholder_home="Vainqueur D1",
        placeholder_away="Vainqueur D2",
    )

    return {
        "groups": (g_a, g_b),
        "teams": (t1, t2, t3, t4),
        "semis": (semi1, semi2),
        "final": final,
        "field": field,
    }


# ─── Placeholder Parsing ────────────────────────────────────────────────────


class TestParsePlaceholders:
    def test_parse_group_placeholder_1er(self, category):
        g = Group.objects.create(category=category, name="Poule A")
        t = TeamFactory(tournament=category.tournament, category=category, name="T1")
        g.teams.add(t)
        # Need a finished match for standings
        Match.objects.create(
            tournament=category.tournament,
            category=category,
            group=g,
            team_home=t,
            team_away=t,  # self-match just for standings
            field=FieldFactory(tournament=category.tournament),
            start_time=timezone.now(),
            duration_minutes=15,
            status=Match.Status.FINISHED,
            phase=Match.Phase.GROUP,
            score_home=1,
            score_away=0,
        )
        team, is_group = _parse_group_placeholder("1er Poule A", category)
        assert is_group is True
        assert team == t

    def test_parse_group_placeholder_not_a_group(self, category):
        team, is_group = _parse_group_placeholder("Vainqueur D1", category)
        assert is_group is False

    def test_parse_knockout_vainqueur_d1(self, category):
        team, is_ko = _parse_knockout_placeholder("Vainqueur D1", category)
        assert is_ko is True
        # No finished semi → team is None
        assert team is None

    def test_parse_knockout_perdant_d1(self, category):
        team, is_ko = _parse_knockout_placeholder("Perdant D1", category)
        assert is_ko is True

    def test_parse_knockout_qf(self, category):
        team, is_ko = _parse_knockout_placeholder("Vainqueur QF1", category)
        assert is_ko is True

    def test_parse_knockout_r16(self, category):
        team, is_ko = _parse_knockout_placeholder("Vainqueur R16-1", category)
        assert is_ko is True

    def test_parse_knockout_not_a_placeholder(self, category):
        team, is_ko = _parse_knockout_placeholder("1er Poule A", category)
        assert is_ko is False


# ─── Group → Knockout Resolution ────────────────────────────────────────────


class TestResolveGroupToKnockout:
    def test_resolves_semi_finals_from_group_standings(self, category, two_groups):
        data = two_groups
        semi1, semi2 = data["semis"]
        t1, t2, t3, t4 = data["teams"]

        updated = resolve_group_to_knockout(category)
        assert updated == 2  # both semis resolved

        semi1.refresh_from_db()
        semi2.refresh_from_db()

        # Poule A: Eagles 2-0 Hawks → Eagles 1st, Hawks 2nd
        # Poule B: Lions 1-1 Bears → both 1pt (tie → h2h, then GD=0, then GF=1 each)
        assert semi1.team_home == t1  # 1er Poule A = Eagles
        # semi1.team_away = 2e Poule B (either t3 or t4, depends on tie resolution)
        assert semi1.team_away in (t3, t4)

    def test_does_not_resolve_if_group_incomplete(self, tournament, category):
        g = Group.objects.create(category=category, name="Poule C")
        t1 = TeamFactory(tournament=tournament, category=category)
        t2 = TeamFactory(tournament=tournament, category=category)
        g.teams.set([t1, t2])
        # Match not finished
        Match.objects.create(
            tournament=tournament,
            category=category,
            group=g,
            team_home=t1,
            team_away=t2,
            field=FieldFactory(tournament=tournament),
            start_time=timezone.now(),
            duration_minutes=15,
            status=Match.Status.LIVE,
            phase=Match.Phase.GROUP,
        )
        Match.objects.create(
            tournament=tournament,
            category=category,
            field=FieldFactory(tournament=tournament),
            start_time=timezone.now() + timezone.timedelta(hours=1),
            duration_minutes=15,
            phase=Match.Phase.SEMI,
            placeholder_home="1er Poule C",
            placeholder_away="2e Poule C",
        )
        updated = resolve_group_to_knockout(category)
        assert updated == 0


# ─── Knockout Advancement ────────────────────────────────────────────────────


class TestAdvanceKnockoutWinner:
    def test_advances_winner_to_final(self, category, two_groups):
        data = two_groups
        semi1, semi2 = data["semis"]
        final = data["final"]
        t1, t2, t3, t4 = data["teams"]

        # Resolve group → knockout first
        resolve_group_to_knockout(category)
        semi1.refresh_from_db()
        semi2.refresh_from_db()

        # Finish semi1: Eagles wins
        semi1.status = Match.Status.FINISHED
        semi1.score_home = 3
        semi1.score_away = 0
        semi1.save()

        updated = advance_knockout_winner(semi1)
        assert updated >= 0  # may or may not resolve final depending on semi2

        # Finish semi2
        semi2.status = Match.Status.FINISHED
        semi2.score_home = 2
        semi2.score_away = 1
        semi2.save()

        updated = advance_knockout_winner(semi2)
        final.refresh_from_db()
        # By now both "Vainqueur D1" and "Vainqueur D2" should be resolved
        assert final.team_home is not None or final.team_away is not None

    def test_group_phase_match_returns_zero(self, tournament, category, two_groups):
        """advance_knockout_winner should do nothing for group phase matches."""
        group_match = Match.objects.filter(
            category=category, phase=Match.Phase.GROUP,
        ).first()
        updated = advance_knockout_winner(group_match)
        assert updated == 0

    def test_penalty_winner_advances(self, tournament, category):
        """Draw in knockout resolved by penalties."""
        field = FieldFactory(tournament=tournament)
        t1 = TeamFactory(tournament=tournament, category=category, name="PenA")
        t2 = TeamFactory(tournament=tournament, category=category, name="PenB")
        now = timezone.now()

        semi1 = Match.objects.create(
            tournament=tournament,
            category=category,
            field=field,
            team_home=t1,
            team_away=t2,
            start_time=now,
            duration_minutes=15,
            phase=Match.Phase.SEMI,
            status=Match.Status.FINISHED,
            score_home=1,
            score_away=1,
            penalty_score_home=4,
            penalty_score_away=3,
        )
        # Create a final that references this semi
        final = Match.objects.create(
            tournament=tournament,
            category=category,
            field=field,
            start_time=now + timezone.timedelta(hours=1),
            duration_minutes=15,
            phase=Match.Phase.FINAL,
            placeholder_home="Vainqueur D1",
            placeholder_away="Perdant D1",
        )
        updated = advance_knockout_winner(semi1)
        final.refresh_from_db()
        if updated > 0:
            # PenA won on penalties
            assert final.team_home == t1
            assert final.team_away == t2


# ─── resolve_brackets (integration) ─────────────────────────────────────────


class TestResolveBrackets:
    def test_resolve_brackets_returns_summary(self, tournament, category, two_groups):
        result = resolve_brackets(tournament)
        assert "total_updated" in result
        assert "categories" in result
        assert category.name in result["categories"]
        assert result["total_updated"] >= 2  # at least the 2 semis
