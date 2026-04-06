import pytest
from rest_framework.test import APIClient

from tests.factories import ClubFactory, TournamentFactory, UserFactory


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def authenticated_client(api_client, user) -> APIClient:
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def club(db):
    return ClubFactory()


@pytest.fixture
def tournament(club):
    return TournamentFactory(club=club)
