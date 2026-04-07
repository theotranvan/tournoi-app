import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone as tz
from rest_framework import status
from rest_framework.test import APIClient

from apps.matches.models import Match
from apps.scheduling.bracket_resolver import _get_match_result
from tests.factories import (
    CategoryFactory,
    FieldFactory,
    MatchFactory,
    TeamFactory,
    TournamentFactory,
    UserFactory,
)


@pytest.mark.django_db
class TestPenaltyValidation:
    """Model-level penalty validation rules."""

    def _make_knockout_match(self, **kwargs):
        tournament = TournamentFactory()
        category = CategoryFactory(tournament=tournament)
        field = FieldFactory(tournament=tournament)
        team_home = TeamFactory(tournament=tournament, category=category)
        team_away = TeamFactory(tournament=tournament, category=category)
        defaults = dict(
            tournament=tournament,
            category=category,
            field=field,
            team_home=team_home,
            team_away=team_away,
            phase=Match.Phase.SEMI,
            status=Match.Status.LIVE,
            score_home=2,
            score_away=2,
        )
        defaults.update(kwargs)
        return Match(**defaults, start_time="2025-06-01T10:00:00Z")

    def test_penalty_in_group_phase_rejected(self):
        match = self._make_knockout_match(
            phase=Match.Phase.GROUP,
            penalty_score_home=4,
            penalty_score_away=3,
        )
        with pytest.raises(ValidationError) as exc_info:
            match.clean()
        assert "penalty_score_home" in exc_info.value.message_dict

    def test_single_penalty_score_rejected(self):
        match = self._make_knockout_match(
            penalty_score_home=4,
            penalty_score_away=None,
        )
        with pytest.raises(ValidationError) as exc_info:
            match.clean()
        assert "penalty_score_away" in exc_info.value.message_dict

    def test_penalty_with_non_draw_rejected(self):
        match = self._make_knockout_match(
            score_home=3,
            score_away=2,
            penalty_score_home=4,
            penalty_score_away=3,
        )
        with pytest.raises(ValidationError) as exc_info:
            match.clean()
        assert "penalty_score_home" in exc_info.value.message_dict

    def test_tied_penalties_rejected(self):
        match = self._make_knockout_match(
            penalty_score_home=3,
            penalty_score_away=3,
        )
        with pytest.raises(ValidationError) as exc_info:
            match.clean()
        assert "penalty_score_away" in exc_info.value.message_dict

    def test_valid_penalties_accepted(self):
        match = self._make_knockout_match(
            penalty_score_home=4,
            penalty_score_away=3,
        )
        match.clean()  # Should not raise


@pytest.mark.django_db
class TestBracketResolverPenalties:
    """bracket_resolver._get_match_result with penalty scores."""

    def _make_finished_match(self, score_home, score_away, pen_home=None, pen_away=None):
        tournament = TournamentFactory()
        category = CategoryFactory(tournament=tournament)
        team_home = TeamFactory(tournament=tournament, category=category)
        team_away = TeamFactory(tournament=tournament, category=category)
        return MatchFactory(
            tournament=tournament,
            category=category,
            team_home=team_home,
            team_away=team_away,
            phase=Match.Phase.SEMI,
            status=Match.Status.FINISHED,
            score_home=score_home,
            score_away=score_away,
            penalty_score_home=pen_home,
            penalty_score_away=pen_away,
        )

    def test_draw_without_penalties_returns_none(self):
        match = self._make_finished_match(2, 2)
        assert _get_match_result(match, "Vainqueur") is None

    def test_draw_with_home_winning_penalties(self):
        match = self._make_finished_match(2, 2, pen_home=4, pen_away=3)
        assert _get_match_result(match, "Vainqueur") == match.team_home
        assert _get_match_result(match, "Perdant") == match.team_away

    def test_draw_with_away_winning_penalties(self):
        match = self._make_finished_match(1, 1, pen_home=2, pen_away=4)
        assert _get_match_result(match, "Vainqueur") == match.team_away
        assert _get_match_result(match, "Perdant") == match.team_home

    def test_clear_winner_ignores_penalties(self):
        match = self._make_finished_match(3, 1)
        assert _get_match_result(match, "Vainqueur") == match.team_home

    def test_e2e_finale_with_penalties(self):
        """Full scenario: final 2-2, penalties 4-3 -> home wins."""
        tournament = TournamentFactory()
        category = CategoryFactory(tournament=tournament)
        team_a = TeamFactory(tournament=tournament, category=category, name="Finale A")
        team_b = TeamFactory(tournament=tournament, category=category, name="Finale B")
        final = MatchFactory(
            tournament=tournament,
            category=category,
            team_home=team_a,
            team_away=team_b,
            phase=Match.Phase.FINAL,
            status=Match.Status.FINISHED,
            score_home=2,
            score_away=2,
            penalty_score_home=4,
            penalty_score_away=3,
        )
        winner = _get_match_result(final, "Vainqueur")
        loser = _get_match_result(final, "Perdant")
        assert winner == team_a
        assert loser == team_b


# ─── Match API Tests ─────────────────────────────────────────────────────────


@pytest.fixture
def match_setup(db):
    """Create a full tournament setup with a scheduled match."""
    user = UserFactory()
    club = __import__("tests.factories", fromlist=["ClubFactory"]).ClubFactory(owner=user)
    tournament = TournamentFactory(club=club, status="live")
    category = CategoryFactory(tournament=tournament)
    field = FieldFactory(tournament=tournament)
    team_home = TeamFactory(tournament=tournament, category=category)
    team_away = TeamFactory(tournament=tournament, category=category)
    match = MatchFactory(
        tournament=tournament,
        category=category,
        field=field,
        team_home=team_home,
        team_away=team_away,
        phase=Match.Phase.GROUP,
        status=Match.Status.SCHEDULED,
        start_time=tz.now(),
    )
    client = APIClient()
    client.force_authenticate(user=user)
    base_url = f"/api/v1/tournaments/{tournament.id}/matches"
    return {
        "client": client,
        "match": match,
        "tournament": tournament,
        "user": user,
        "url": base_url,
    }


@pytest.mark.django_db
class TestMatchStartAPI:
    def test_start_scheduled_match(self, match_setup):
        m = match_setup["match"]
        resp = match_setup["client"].post(
            f"{match_setup['url']}/{m.id}/start/"
        )
        assert resp.status_code == 200
        m.refresh_from_db()
        assert m.status == Match.Status.LIVE

    def test_start_non_scheduled_match_rejected(self, match_setup):
        m = match_setup["match"]
        m.status = Match.Status.FINISHED
        m.save()
        resp = match_setup["client"].post(
            f"{match_setup['url']}/{m.id}/start/"
        )
        assert resp.status_code == 409


@pytest.mark.django_db
class TestMatchScoreAPI:
    def test_score_on_live_match(self, match_setup):
        m = match_setup["match"]
        m.status = Match.Status.LIVE
        m.save()
        resp = match_setup["client"].post(
            f"{match_setup['url']}/{m.id}/score/",
            {"score_home": 2, "score_away": 1},
            format="json",
        )
        assert resp.status_code == 200
        m.refresh_from_db()
        assert m.score_home == 2
        assert m.score_away == 1

    def test_score_auto_transitions_scheduled_to_live(self, match_setup):
        m = match_setup["match"]
        resp = match_setup["client"].post(
            f"{match_setup['url']}/{m.id}/score/",
            {"score_home": 0, "score_away": 0},
            format="json",
        )
        assert resp.status_code == 200
        m.refresh_from_db()
        assert m.status == Match.Status.LIVE

    def test_score_on_finished_match_rejected(self, match_setup):
        m = match_setup["match"]
        m.status = Match.Status.FINISHED
        m.save()
        resp = match_setup["client"].post(
            f"{match_setup['url']}/{m.id}/score/",
            {"score_home": 1, "score_away": 0},
            format="json",
        )
        assert resp.status_code == 422

    def test_score_with_goals(self, match_setup):
        m = match_setup["match"]
        m.status = Match.Status.LIVE
        m.save()
        resp = match_setup["client"].post(
            f"{match_setup['url']}/{m.id}/score/",
            {
                "score_home": 1,
                "score_away": 0,
                "goals": [{"team": "home", "player_name": "Dupont", "minute": 23}],
            },
            format="json",
        )
        assert resp.status_code == 200
        assert m.goals.count() == 1
        assert m.goals.first().player_name == "Dupont"


@pytest.mark.django_db
class TestMatchFinishAPI:
    def test_finish_live_match_with_score(self, match_setup):
        m = match_setup["match"]
        m.status = Match.Status.LIVE
        m.score_home = 3
        m.score_away = 1
        m.save()
        resp = match_setup["client"].post(
            f"{match_setup['url']}/{m.id}/finish/"
        )
        assert resp.status_code == 200
        m.refresh_from_db()
        assert m.status == Match.Status.FINISHED
        assert m.score_validated is True

    def test_finish_without_score_rejected(self, match_setup):
        m = match_setup["match"]
        m.status = Match.Status.LIVE
        m.save()
        resp = match_setup["client"].post(
            f"{match_setup['url']}/{m.id}/finish/"
        )
        assert resp.status_code == 422

    def test_finish_scheduled_match_rejected(self, match_setup):
        m = match_setup["match"]
        resp = match_setup["client"].post(
            f"{match_setup['url']}/{m.id}/finish/"
        )
        assert resp.status_code == 409


@pytest.mark.django_db
class TestMatchLockAPI:
    def test_lock_match(self, match_setup):
        m = match_setup["match"]
        resp = match_setup["client"].post(
            f"{match_setup['url']}/{m.id}/lock/"
        )
        assert resp.status_code == 200
        m.refresh_from_db()
        assert m.is_locked is True

    def test_unlock_match(self, match_setup):
        m = match_setup["match"]
        m.is_locked = True
        m.save()
        resp = match_setup["client"].post(
            f"{match_setup['url']}/{m.id}/unlock/"
        )
        assert resp.status_code == 200
        m.refresh_from_db()
        assert m.is_locked is False


@pytest.mark.django_db
class TestMatchPostponeAPI:
    def test_postpone_suggests_slots(self, match_setup):
        m = match_setup["match"]
        resp = match_setup["client"].post(
            f"{match_setup['url']}/{m.id}/postpone/",
            {"reason": "Pluie"},
            format="json",
        )
        assert resp.status_code == 200
        assert "suggested_slots" in resp.data

    def test_postpone_apply_invalid_slot_index(self, match_setup):
        m = match_setup["match"]
        resp = match_setup["client"].post(
            f"{match_setup['url']}/{m.id}/postpone/",
            {"reason": "Orage", "apply_slot_index": 99},
            format="json",
        )
        assert resp.status_code == 422
