import factory
from django.utils import timezone

from apps.accounts.models import User
from apps.clubs.models import Club
from apps.matches.models import Goal, Match
from apps.teams.models import Group, Team
from apps.tournaments.models import Category, Day, Field, Tournament


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.LazyAttribute(lambda o: f"{o.username}@example.com")
    password = factory.PostGenerationMethodCall("set_password", "testpass123")
    role = User.Role.ORGANIZER


class ClubFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Club

    name = factory.Sequence(lambda n: f"Club {n}")
    slug = factory.LazyAttribute(lambda o: o.name.lower().replace(" ", "-"))
    owner = factory.SubFactory(UserFactory)
    contact_email = factory.LazyAttribute(lambda o: f"contact@{o.slug}.com")


class TournamentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Tournament

    club = factory.SubFactory(ClubFactory)
    name = factory.Sequence(lambda n: f"Tournoi {n}")
    slug = factory.LazyAttribute(lambda o: o.name.lower().replace(" ", "-"))
    location = "Stade Municipal"
    start_date = factory.LazyFunction(lambda: timezone.now().date())
    end_date = factory.LazyFunction(
        lambda: (timezone.now() + timezone.timedelta(days=1)).date()
    )
    status = Tournament.Status.DRAFT


class CategoryFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Category

    tournament = factory.SubFactory(TournamentFactory)
    name = factory.Sequence(lambda n: f"U{10 + n}")
    display_order = factory.Sequence(lambda n: n)
    points_win = 3
    points_draw = 1
    points_loss = 0


class FieldFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Field

    tournament = factory.SubFactory(TournamentFactory)
    name = factory.Sequence(lambda n: f"Terrain {n}")
    display_order = factory.Sequence(lambda n: n)
    is_active = True
    availability = factory.LazyAttribute(
        lambda o: [
            {
                "date": str(o.tournament.start_date),
                "start": "08:00",
                "end": "19:00",
            }
        ]
    )


class TeamFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Team

    tournament = factory.SubFactory(TournamentFactory)
    category = factory.SubFactory(
        CategoryFactory, tournament=factory.SelfAttribute("..tournament")
    )
    name = factory.Sequence(lambda n: f"Equipe {n}")
    coach_name = factory.Faker("name")
    coach_email = factory.Faker("email")


class GroupFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Group

    category = factory.SubFactory(CategoryFactory)
    name = factory.Sequence(lambda n: f"Poule {chr(65 + n % 26)}")
    display_order = factory.Sequence(lambda n: n)


class DayFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Day

    tournament = factory.SubFactory(TournamentFactory)
    date = factory.LazyAttribute(lambda o: o.tournament.start_date)
    label = factory.Sequence(lambda n: f"Jour {n + 1}")
    start_time = "08:30"
    end_time = "17:30"
    lunch_start = "12:00"
    lunch_end = "13:00"
    order = factory.Sequence(lambda n: n)


class MatchFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Match

    tournament = factory.SubFactory(TournamentFactory)
    category = factory.SubFactory(
        CategoryFactory, tournament=factory.SelfAttribute("..tournament")
    )
    phase = Match.Phase.GROUP
    start_time = factory.LazyFunction(timezone.now)
    duration_minutes = 15
    status = Match.Status.SCHEDULED
    placeholder_home = "1er Poule A"
    placeholder_away = "2ème Poule B"


class GoalFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Goal

    match = factory.SubFactory(MatchFactory)
    team = factory.SubFactory(TeamFactory)
    player_name = factory.Faker("name")
    minute = factory.Faker("random_int", min=1, max=90)
