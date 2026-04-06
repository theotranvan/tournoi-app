"""Tests for TournamentInsightsView — analytics computed from match data."""

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from tests.factories import (
    CategoryFactory,
    ClubFactory,
    FieldFactory,
    GoalFactory,
    MatchFactory,
    TeamFactory,
    TournamentFactory,
    UserFactory,
)


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    from django.core.cache import cache
    cache.clear()


def _make_owner():
    user = UserFactory(username="owner", role="organizer")
    user.set_password("testpass123")
    user.save()
    return user


@pytest.fixture
def finished_tournament(db):
    """Create a tournament with 4 teams, 6 finished matches, and goals."""
    owner = _make_owner()
    club = ClubFactory(owner=owner)
    t = TournamentFactory(club=club, status="live")
    cat = CategoryFactory(tournament=t, name="U12")
    field_a = FieldFactory(tournament=t, name="Terrain A")
    field_b = FieldFactory(tournament=t, name="Terrain B")

    team1 = TeamFactory(tournament=t, category=cat, name="Lions")
    team2 = TeamFactory(tournament=t, category=cat, name="Tigers")
    team3 = TeamFactory(tournament=t, category=cat, name="Bears")
    team4 = TeamFactory(tournament=t, category=cat, name="Wolves")

    now = timezone.now()

    # Match 1: Lions 3-0 Tigers (field A) — Lions best attack
    m1 = MatchFactory(
        tournament=t, category=cat, field=field_a,
        team_home=team1, team_away=team2,
        score_home=3, score_away=0,
        status="finished", start_time=now,
    )
    # Match 2: Bears 1-0 Wolves (field B) — tight
    m2 = MatchFactory(
        tournament=t, category=cat, field=field_b,
        team_home=team3, team_away=team4,
        score_home=1, score_away=0,
        status="finished", start_time=now,
    )
    # Match 3: Lions 2-1 Bears (field A)
    m3 = MatchFactory(
        tournament=t, category=cat, field=field_a,
        team_home=team1, team_away=team3,
        score_home=2, score_away=1,
        status="finished", start_time=now,
    )
    # Match 4: Tigers 1-1 Wolves (field B) — tightest (draw)
    m4 = MatchFactory(
        tournament=t, category=cat, field=field_b,
        team_home=team2, team_away=team4,
        score_home=1, score_away=1,
        status="finished", start_time=now,
    )
    # Match 5: Lions 1-0 Wolves (field A)
    m5 = MatchFactory(
        tournament=t, category=cat, field=field_a,
        team_home=team1, team_away=team4,
        score_home=1, score_away=0,
        status="finished", start_time=now,
    )
    # Match 6: Tigers 0-2 Bears (field B)
    m6 = MatchFactory(
        tournament=t, category=cat, field=field_b,
        team_home=team2, team_away=team3,
        score_home=0, score_away=2,
        status="finished", start_time=now,
    )

    # Goals for top scorer test
    GoalFactory(match=m1, team=team1, player_name="Dupont", minute=10)
    GoalFactory(match=m1, team=team1, player_name="Dupont", minute=25)
    GoalFactory(match=m1, team=team1, player_name="Dupont", minute=40)
    GoalFactory(match=m3, team=team1, player_name="Dupont", minute=15)
    GoalFactory(match=m5, team=team1, player_name="Dupont", minute=30)
    # 5 goals for Dupont

    GoalFactory(match=m3, team=team1, player_name="Martin", minute=20)
    # 1 goal for Martin

    GoalFactory(match=m2, team=team3, player_name="Durand", minute=12)
    GoalFactory(match=m6, team=team3, player_name="Durand", minute=5)
    GoalFactory(match=m6, team=team3, player_name="Durand", minute=50)
    # 3 goals for Durand

    return {
        "tournament": t,
        "owner": owner,
        "club": club,
        "teams": {"Lions": team1, "Tigers": team2, "Bears": team3, "Wolves": team4},
        "fields": {"A": field_a, "B": field_b},
        "matches": [m1, m2, m3, m4, m5, m6],
    }


def _url(tournament_id):
    return f"/api/v1/tournaments/{tournament_id}/insights/"


@pytest.mark.django_db
class TestInsightsEndpoint:
    def test_best_attack_team(self, api, finished_tournament):
        """Team with the most goals scored is reported as best attack."""
        api.force_authenticate(user=finished_tournament["owner"])
        resp = api.get(_url(finished_tournament["tournament"].id))
        assert resp.status_code == status.HTTP_200_OK

        insights = {i["type"]: i for i in resp.data["insights"]}
        assert "best_attack" in insights
        # Lions scored 3+2+1=6 goals
        assert "Lions" in insights["best_attack"]["value"]

    def test_best_defense_team(self, api, finished_tournament):
        """Team with fewest goals conceded is reported as best defense."""
        api.force_authenticate(user=finished_tournament["owner"])
        resp = api.get(_url(finished_tournament["tournament"].id))

        insights = {i["type"]: i for i in resp.data["insights"]}
        assert "best_defense" in insights
        # Lions conceded: 0(m1)+1(m3)+0(m5)=1 goal
        assert "Lions" in insights["best_defense"]["value"]

    def test_tightest_match(self, api, finished_tournament):
        """Match with smallest goal difference is the tightest."""
        api.force_authenticate(user=finished_tournament["owner"])
        resp = api.get(_url(finished_tournament["tournament"].id))

        insights = {i["type"]: i for i in resp.data["insights"]}
        assert "tightest_match" in insights
        # m4 = Tigers 1-1 Wolves (diff=0) is tightest
        val = insights["tightest_match"]["value"]
        assert "1-1" in val

    def test_top_goalscorer_with_goals(self, api, finished_tournament):
        """Top scorer is correctly identified when Goal records exist."""
        api.force_authenticate(user=finished_tournament["owner"])
        resp = api.get(_url(finished_tournament["tournament"].id))

        insights = {i["type"]: i for i in resp.data["insights"]}
        assert "top_scorer" in insights
        assert "Dupont" in insights["top_scorer"]["value"]
        assert "5" in insights["top_scorer"]["value"]

        # Check top_scorers list
        scorers = resp.data["top_scorers"]
        assert len(scorers) >= 2
        assert scorers[0]["player_name"] == "Dupont"
        assert scorers[0]["goals"] == 5

    def test_top_goalscorer_empty_when_no_goals(self, api):
        """When no Goal objects exist, top_scorer insight is absent (no crash)."""
        owner = _make_owner()
        club = ClubFactory(owner=owner)
        t = TournamentFactory(club=club, status="live")
        cat = CategoryFactory(tournament=t)
        field = FieldFactory(tournament=t)
        team_a = TeamFactory(tournament=t, category=cat, name="Alpha")
        team_b = TeamFactory(tournament=t, category=cat, name="Beta")
        MatchFactory(
            tournament=t, category=cat, field=field,
            team_home=team_a, team_away=team_b,
            score_home=2, score_away=1, status="finished",
        )

        api.force_authenticate(user=owner)
        resp = api.get(_url(t.id))
        assert resp.status_code == status.HTTP_200_OK

        insights = {i["type"]: i for i in resp.data["insights"]}
        assert "top_scorer" not in insights
        assert resp.data["top_scorers"] == []

    def test_field_utilization(self, api, finished_tournament):
        """Field utilization percentages are computed correctly."""
        api.force_authenticate(user=finished_tournament["owner"])
        resp = api.get(_url(finished_tournament["tournament"].id))

        fields = {f["field"]: f for f in resp.data["field_utilization"]}
        assert "Terrain A" in fields
        assert "Terrain B" in fields
        # 3 matches on A, 3 on B, 6 total → 50% each
        assert fields["Terrain A"]["utilization_pct"] == 50.0
        assert fields["Terrain B"]["utilization_pct"] == 50.0

    def test_insights_empty_tournament(self, api):
        """Tournament with no finished matches returns empty insights, no crash."""
        owner = _make_owner()
        club = ClubFactory(owner=owner)
        t = TournamentFactory(club=club, status="draft")

        api.force_authenticate(user=owner)
        resp = api.get(_url(t.id))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["total_matches_played"] == 0
        assert resp.data["insights"] == []

    def test_avg_goals_per_match(self, api, finished_tournament):
        """Average goals per match is correctly computed."""
        api.force_authenticate(user=finished_tournament["owner"])
        resp = api.get(_url(finished_tournament["tournament"].id))

        # Total goals: (3+0)+(1+0)+(2+1)+(1+1)+(1+0)+(0+2) = 12
        # 6 matches → avg = 2.0
        assert resp.data["total_goals"] == 12
        assert resp.data["avg_goals_per_match"] == 2.0

    def test_unauthenticated_returns_error(self, api, finished_tournament):
        """Unauthenticated request is rejected."""
        resp = api.get(_url(finished_tournament["tournament"].id))
        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
