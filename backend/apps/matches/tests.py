import pytest
from django.core.exceptions import ValidationError

from apps.matches.models import Match
from apps.scheduling.bracket_resolver import _get_match_result
from tests.factories import (
    CategoryFactory,
    FieldFactory,
    MatchFactory,
    TeamFactory,
    TournamentFactory,
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
