"""Tests unitaires pour tous les modèles du domaine Kickoff."""

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.accounts.models import User
from apps.matches.models import Match
from apps.teams.models import generate_access_code
from apps.tournaments.models import SchedulingConstraint, Tournament
from tests.factories import (
    CategoryFactory,
    ClubFactory,
    FieldFactory,
    GoalFactory,
    GroupFactory,
    MatchFactory,
    TeamFactory,
    TournamentFactory,
    UserFactory,
)

# ─── User ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestUser:
    def test_create_user(self):
        user = UserFactory(username="alice", role=User.Role.ORGANIZER)
        assert user.pk is not None
        assert user.username == "alice"
        assert user.role == User.Role.ORGANIZER
        assert str(user) == "alice"

    def test_user_roles(self):
        assert User.Role.SUPERADMIN == "superadmin"
        assert User.Role.ORGANIZER == "organizer"
        assert User.Role.COACH == "coach"
        assert User.Role.PUBLIC == "public"

    def test_default_role_is_public(self):
        user = User.objects.create_user(username="bob", password="test123")
        assert user.role == User.Role.PUBLIC


# ─── Club ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestClub:
    def test_create_club(self):
        club = ClubFactory(name="FC Test")
        assert club.pk is not None
        assert club.name == "FC Test"
        assert club.slug == "fc-test"
        assert str(club) == "FC Test"

    def test_slug_auto_generated(self):
        club = ClubFactory(name="Mon Club", slug="")
        club.save()
        assert club.slug == "mon-club"

    def test_owner_relation(self):
        user = UserFactory()
        club = ClubFactory(owner=user)
        assert club.owner == user
        assert club in user.owned_clubs.all()


# ─── Tournament ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestTournament:
    def test_create_tournament(self):
        t = TournamentFactory(name="Tournoi Test")
        assert t.pk is not None
        assert t.name == "Tournoi Test"
        assert t.status == Tournament.Status.DRAFT

    def test_end_date_before_start_date_fails(self):
        t = TournamentFactory.build(
            start_date=timezone.now().date(),
            end_date=timezone.now().date() - timezone.timedelta(days=1),
        )
        with pytest.raises(ValidationError) as exc_info:
            t.clean()
        assert "end_date" in exc_info.value.message_dict

    def test_slug_auto_generated(self):
        t = TournamentFactory(name="Super Cup", slug="")
        t.save()
        assert "super-cup" in t.slug

    def test_str(self):
        t = TournamentFactory(name="Coupe Printemps")
        assert "Coupe Printemps" in str(t)


# ─── Category ────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCategory:
    def test_create_category(self):
        cat = CategoryFactory(name="U10")
        assert cat.pk is not None
        assert cat.name == "U10"

    def test_earliest_start_after_latest_end_fails(self):
        from datetime import time

        cat = CategoryFactory.build(
            earliest_start=time(18, 0),
            latest_end=time(10, 0),
        )
        with pytest.raises(ValidationError) as exc_info:
            cat.clean()
        assert "latest_end" in exc_info.value.message_dict

    def test_effective_match_duration_override(self):
        t = TournamentFactory(default_match_duration=15)
        cat = CategoryFactory(tournament=t, match_duration=20)
        assert cat.effective_match_duration == 20

    def test_effective_match_duration_fallback(self):
        t = TournamentFactory(default_match_duration=15)
        cat = CategoryFactory(tournament=t, match_duration=None)
        assert cat.effective_match_duration == 15

    def test_effective_transition_time(self):
        t = TournamentFactory(default_transition_time=5)
        cat = CategoryFactory(tournament=t, transition_time=None)
        assert cat.effective_transition_time == 5

    def test_effective_rest_time(self):
        t = TournamentFactory(default_rest_time=20)
        cat = CategoryFactory(tournament=t, rest_time=10)
        assert cat.effective_rest_time == 10

    def test_unique_together(self):
        cat = CategoryFactory(name="U10")
        with pytest.raises(Exception):
            CategoryFactory(tournament=cat.tournament, name="U10")


# ─── Field ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestField:
    def test_create_field(self):
        f = FieldFactory(name="Terrain A")
        assert f.pk is not None
        assert f.name == "Terrain A"

    def test_valid_availability(self):
        f = FieldFactory(
            availability=[{"date": "2026-04-11", "start": "08:00", "end": "19:00"}]
        )
        f.full_clean()  # Should not raise

    def test_invalid_availability_not_list(self):
        f = FieldFactory.build(availability="invalid")
        with pytest.raises(ValidationError):
            f.clean()

    def test_invalid_availability_missing_keys(self):
        f = FieldFactory.build(availability=[{"date": "2026-04-11"}])
        with pytest.raises(ValidationError):
            f.clean()

    def test_invalid_availability_bad_date_format(self):
        f = FieldFactory.build(
            availability=[{"date": "11/04/2026", "start": "08:00", "end": "19:00"}]
        )
        with pytest.raises(ValidationError):
            f.clean()

    def test_invalid_availability_start_after_end(self):
        f = FieldFactory.build(
            availability=[{"date": "2026-04-11", "start": "19:00", "end": "08:00"}]
        )
        with pytest.raises(ValidationError):
            f.clean()


# ─── Team ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestTeam:
    def test_create_team(self):
        team = TeamFactory(name="FC Kids")
        assert team.pk is not None
        assert team.name == "FC Kids"

    def test_access_code_auto_generated(self):
        team = TeamFactory()
        assert team.access_code
        assert len(team.access_code) == 8

    def test_access_code_unique(self):
        t1 = TeamFactory()
        t2 = TeamFactory()
        assert t1.access_code != t2.access_code

    def test_access_code_no_ambiguous_chars(self):
        for _ in range(50):
            code = generate_access_code()
            assert "0" not in code
            assert "O" not in code
            assert "1" not in code
            assert "I" not in code

    def test_str(self):
        team = TeamFactory(name="FC Kids")
        assert "FC Kids" in str(team)

    def test_unique_together(self):
        team = TeamFactory(name="Team A")
        with pytest.raises(Exception):
            TeamFactory(
                tournament=team.tournament,
                category=team.category,
                name="Team A",
            )


# ─── Group ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestGroup:
    def test_create_group(self):
        g = GroupFactory(name="Poule A")
        assert g.pk is not None
        assert g.name == "Poule A"

    def test_teams_relation(self):
        g = GroupFactory()
        t = TeamFactory(category=g.category, tournament=g.category.tournament)
        g.teams.add(t)
        assert t in g.teams.all()

    def test_str(self):
        g = GroupFactory()
        assert g.category.name in str(g)


# ─── Match ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestMatch:
    def test_create_match_with_placeholders(self):
        m = MatchFactory(placeholder_home="1er A", placeholder_away="2ème B")
        assert m.pk is not None
        assert m.display_home == "1er A"
        assert m.display_away == "2ème B"

    def test_create_match_with_teams(self):
        t = TournamentFactory()
        cat = CategoryFactory(tournament=t)
        home = TeamFactory(tournament=t, category=cat)
        away = TeamFactory(tournament=t, category=cat)
        m = MatchFactory(
            tournament=t,
            category=cat,
            team_home=home,
            team_away=away,
            placeholder_home="",
            placeholder_away="",
        )
        assert m.display_home == home.name
        assert m.display_away == away.name

    def test_match_no_teams_no_placeholders_fails(self):
        m = MatchFactory.build(
            team_home=None,
            team_away=None,
            placeholder_home="",
            placeholder_away="",
        )
        with pytest.raises(ValidationError) as exc_info:
            m.clean()
        assert "team_home" in exc_info.value.message_dict

    def test_match_category_mismatch_home(self):
        t = TournamentFactory()
        cat1 = CategoryFactory(tournament=t, name="U10")
        cat2 = CategoryFactory(tournament=t, name="U13")
        team = TeamFactory(tournament=t, category=cat2)
        m = MatchFactory.build(
            tournament=t,
            category=cat1,
            team_home=team,
            placeholder_away="placeholder",
        )
        with pytest.raises(ValidationError) as exc_info:
            m.clean()
        assert "team_home" in exc_info.value.message_dict

    def test_match_category_mismatch_away(self):
        t = TournamentFactory()
        cat1 = CategoryFactory(tournament=t, name="U10")
        cat2 = CategoryFactory(tournament=t, name="U13")
        team = TeamFactory(tournament=t, category=cat2)
        m = MatchFactory.build(
            tournament=t,
            category=cat1,
            team_away=team,
            placeholder_home="placeholder",
        )
        with pytest.raises(ValidationError) as exc_info:
            m.clean()
        assert "team_away" in exc_info.value.message_dict

    def test_match_group_wrong_category(self):
        t = TournamentFactory()
        cat1 = CategoryFactory(tournament=t, name="U10")
        cat2 = CategoryFactory(tournament=t, name="U13")
        group = GroupFactory(category=cat2)
        m = MatchFactory.build(
            tournament=t, category=cat1, group=group, placeholder_home="A", placeholder_away="B"
        )
        with pytest.raises(ValidationError) as exc_info:
            m.clean()
        assert "group" in exc_info.value.message_dict

    def test_match_field_wrong_tournament(self):
        t1 = TournamentFactory()
        t2 = TournamentFactory()
        field = FieldFactory(tournament=t2)
        cat = CategoryFactory(tournament=t1)
        m = MatchFactory.build(
            tournament=t1, category=cat, field=field,
            placeholder_home="A", placeholder_away="B",
        )
        with pytest.raises(ValidationError) as exc_info:
            m.clean()
        assert "field" in exc_info.value.message_dict

    def test_finished_match_requires_scores(self):
        m = MatchFactory.build(
            status=Match.Status.FINISHED,
            score_home=None,
            score_away=None,
            placeholder_home="A",
            placeholder_away="B",
        )
        with pytest.raises(ValidationError) as exc_info:
            m.clean()
        assert "score_home" in exc_info.value.message_dict

    def test_str(self):
        m = MatchFactory(placeholder_home="Eq A", placeholder_away="Eq B")
        assert "Eq A vs Eq B" in str(m)


# ─── Goal ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestGoal:
    def test_create_goal(self):
        g = GoalFactory(player_name="Dupont", minute=12)
        assert g.pk is not None
        assert g.player_name == "Dupont"
        assert g.minute == 12


# ─── SchedulingConstraint ────────────────────────────────────────────────────


@pytest.mark.django_db
class TestSchedulingConstraint:
    def test_create_constraint(self):
        t = TournamentFactory()
        sc = SchedulingConstraint.objects.create(
            tournament=t,
            name="Finale après 16h",
            constraint_type=SchedulingConstraint.ConstraintType.EARLIEST_TIME,
            payload={"time": "16:00", "phase": "final"},
            is_hard=True,
        )
        assert sc.pk is not None
        assert "Finale" in str(sc)
