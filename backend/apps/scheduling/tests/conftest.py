"""Shared fixtures for scheduling tests."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.teams.models import Group
from apps.tournaments.models import Tournament
from tests.factories import (
    CategoryFactory,
    ClubFactory,
    FieldFactory,
    TeamFactory,
    TournamentFactory,
    UserFactory,
)


@pytest.fixture
def organizer(db):
    return UserFactory()


def make_tournament(
    user,
    *,
    n_categories: int = 1,
    teams_per_cat: int = 4,
    n_fields: int = 2,
    n_days: int = 1,
    n_groups: int = 1,
    match_duration: int = 15,
    transition_time: int = 5,
    rest_time: int = 20,
    start_hour: str = "08:00",
    end_hour: str = "19:00",
) -> Tournament:
    """Create a fully configured tournament ready for scheduling."""
    club = ClubFactory(owner=user)
    start = timezone.now().date()
    end = start + timedelta(days=n_days - 1)
    tournament = TournamentFactory(
        club=club,
        start_date=start,
        end_date=end,
        status=Tournament.Status.DRAFT,
        default_match_duration=match_duration,
        default_transition_time=transition_time,
        default_rest_time=rest_time,
    )

    availability = []
    for d in range(n_days):
        day = start + timedelta(days=d)
        availability.append({"date": str(day), "start": start_hour, "end": end_hour})

    for i in range(n_fields):
        FieldFactory(
            tournament=tournament,
            name=f"Terrain {i+1}",
            availability=availability,
        )

    for ci in range(n_categories):
        cat = CategoryFactory(
            tournament=tournament,
            name=f"U{10 + ci}",
            display_order=ci,
        )
        teams = []
        for ti in range(teams_per_cat):
            teams.append(
                TeamFactory(
                    tournament=tournament,
                    category=cat,
                    name=f"Team {ci}-{ti}",
                ),
            )
        for gi in range(n_groups):
            group = Group.objects.create(
                category=cat,
                name=chr(65 + gi),
                display_order=gi,
            )
            group_teams = [t for idx, t in enumerate(teams) if idx % n_groups == gi]
            group.teams.set(group_teams)

    return tournament


@pytest.fixture
def small_tournament(organizer):
    """1 category, 4 teams, 1 group, 2 fields, 1 day."""
    return make_tournament(organizer, n_categories=1, teams_per_cat=4, n_fields=2, n_days=1, n_groups=1)


@pytest.fixture
def small_tournament_2_groups(organizer):
    """1 category, 4 teams, 2 groups (2 per group), 2 fields, 1 day."""
    return make_tournament(organizer, n_categories=1, teams_per_cat=4, n_fields=2, n_days=1, n_groups=2)


@pytest.fixture
def medium_tournament(organizer):
    """3 categories, 24 teams (8 per cat, 2 groups each), 3 fields, 1 day."""
    return make_tournament(
        organizer, n_categories=3, teams_per_cat=8, n_fields=3, n_days=1, n_groups=2,
    )


@pytest.fixture
def large_tournament(organizer):
    """5 categories, 80 teams (16 per cat, 4 groups each), 6 fields, 2 days."""
    return make_tournament(
        organizer, n_categories=5, teams_per_cat=16, n_fields=6, n_days=2, n_groups=4,
    )
