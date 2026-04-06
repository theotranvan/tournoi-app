"""Phase 02 – JWT authentication & team-access integration tests."""

import jwt
import pytest
from django.conf import settings
from rest_framework import status
from rest_framework.test import APIClient

from tests.factories import TeamFactory, UserFactory

REGISTER_URL = "/api/v1/auth/register/"
LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/refresh/"
ME_URL = "/api/v1/auth/me/"
TEAM_ACCESS_URL = "/api/v1/auth/team-access/"


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture(autouse=True)
def _no_password_validators(settings):
    settings.AUTH_PASSWORD_VALIDATORS = []


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    """Reset DRF throttle cache between tests so rate limits don't leak."""
    from django.core.cache import cache
    cache.clear()


def _make_user(username, password="testpass123", **kwargs):
    """Create user with a properly persisted password."""
    user = UserFactory(username=username, **kwargs)
    user.set_password(password)
    user.save()
    return user


# ── Register ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRegister:
    def test_register_success(self, api):
        resp = api.post(REGISTER_URL, {
            "username": "alice",
            "email": "alice@example.com",
            "password": "testpass123",
            "first_name": "Alice",
            "last_name": "Dupont",
        })
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert "access" in data
        assert "refresh" in data
        assert data["user"]["username"] == "alice"
        assert data["user"]["role"] == "organizer"

    def test_register_duplicate_username(self, api):
        UserFactory(username="bob")
        resp = api.post(REGISTER_URL, {
            "username": "bob",
            "password": "testpass123",
        })
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_short_password(self, api):
        resp = api.post(REGISTER_URL, {
            "username": "charlie",
            "password": "short",
        })
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ── Login ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLogin:
    def test_login_success(self, api):
        _make_user("dave", "pass1234")
        resp = api.post(LOGIN_URL, {
            "username": "dave",
            "password": "pass1234",
        })
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert "access" in data
        assert "refresh" in data
        assert data["user"]["username"] == "dave"

    def test_login_invalid_password(self, api):
        _make_user("eve", "correct_pass")
        resp = api.post(LOGIN_URL, {
            "username": "eve",
            "password": "wrong_pass",
        })
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED
        assert resp.json()["error"] == "auth_required"

    def test_login_nonexistent_user(self, api):
        resp = api.post(LOGIN_URL, {
            "username": "ghost",
            "password": "doesntmatter",
        })
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ── Token Refresh ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRefresh:
    def test_refresh_returns_new_access(self, api):
        _make_user("frank", "testpass123")
        login_resp = api.post(LOGIN_URL, {"username": "frank", "password": "testpass123"})
        refresh_token = login_resp.json()["refresh"]

        resp = api.post(REFRESH_URL, {"refresh": refresh_token})
        assert resp.status_code == status.HTTP_200_OK
        assert "access" in resp.json()

    def test_refresh_invalid_token(self, api):
        resp = api.post(REFRESH_URL, {"refresh": "bad.token.value"})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ── Me ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMe:
    def test_me_authenticated(self, api):
        user = UserFactory(username="grace")
        api.force_authenticate(user=user)
        resp = api.get(ME_URL)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["username"] == "grace"

    def test_me_unauthenticated(self, api):
        resp = api.get(ME_URL)
        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


# ── Team Access ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTeamAccess:
    def test_team_access_valid_code(self, api):
        team = TeamFactory()
        resp = api.post(TEAM_ACCESS_URL, {"access_code": team.access_code})
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert "access" in data
        assert data["team"]["id"] == team.id
        assert data["team"]["name"] == team.name

        # Verify the JWT payload
        payload = jwt.decode(data["access"], settings.SECRET_KEY, algorithms=["HS256"])
        assert payload["token_type"] == "team"
        assert payload["team_id"] == team.id
        assert payload["category_id"] == team.category_id

    def test_team_access_invalid_code(self, api):
        resp = api.post(TEAM_ACCESS_URL, {"access_code": "ZZZZZZZZ"})
        assert resp.status_code == status.HTTP_404_NOT_FOUND
        assert resp.json()["error"] == "not_found"

    def test_team_token_authenticates(self, api):
        """Team token can be used in Authorization header to authenticate."""
        team = TeamFactory()
        resp = api.post(TEAM_ACCESS_URL, {"access_code": team.access_code})
        token = resp.json()["access"]

        # Use team token to hit /me/ — should authenticate (not 401)
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        me_resp = api.get(ME_URL)
        assert me_resp.status_code != status.HTTP_401_UNAUTHORIZED


# ── Rate Limiting ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRateLimiting:
    def test_login_rate_limited(self, api):
        """After 5 attempts, the 6th should be throttled."""
        for _ in range(5):
            api.post(LOGIN_URL, {"username": "x", "password": "y"})

        resp = api.post(LOGIN_URL, {"username": "x", "password": "y"})
        assert resp.status_code == status.HTTP_429_TOO_MANY_REQUESTS


# ── Permissions (unit-level) ─────────────────────────────────────────────

@pytest.mark.django_db
class TestPermissions:
    def test_team_anonymous_user_properties(self):
        from apps.accounts.authentication import TeamAnonymousUser

        user = TeamAnonymousUser({
            "team_id": 42,
            "tournament_id": "abc-123",
            "category_id": 7,
            "team_name": "FC Test",
        })
        assert user.is_authenticated is True
        assert user.role == "team"
        assert user.team_id == 42
        assert user.username == "team_42"
        assert str(user) == "TeamUser(FC Test)"
        assert user.is_staff is False

    def test_is_organizer_rejects_team_user(self):
        from apps.accounts.authentication import TeamAnonymousUser
        from apps.accounts.permissions import IsOrganizer

        team_user = TeamAnonymousUser({
            "team_id": 1,
            "tournament_id": "t1",
            "category_id": 1,
        })

        class FakeRequest:
            user = team_user

        assert IsOrganizer().has_permission(FakeRequest(), None) is False

    def test_is_organizer_accepts_organizer(self):
        from apps.accounts.permissions import IsOrganizer

        user = UserFactory(role="organizer")

        class FakeRequest:
            pass

        req = FakeRequest()
        req.user = user
        assert IsOrganizer().has_permission(req, None) is True
