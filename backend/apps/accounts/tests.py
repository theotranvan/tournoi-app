"""Tests for accounts app — models, tokens, authentication, permissions, serializers."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory

from apps.accounts.authentication import KickoffJWTAuthentication, TeamAnonymousUser
from apps.accounts.permissions import (
    IsClubOwnerOrMember,
    IsOrganizer,
    IsTeamMember,
    IsTournamentOwner,
)
from apps.accounts.serializers import RegisterSerializer, UserSerializer
from apps.accounts.tokens import decode_team_token, generate_team_token
from tests.factories import ClubFactory, TeamFactory, TournamentFactory, UserFactory

User = get_user_model()
pytestmark = pytest.mark.django_db


# ── Model ────────────────────────────────────────────────────────────────────


class TestUserModel:
    def test_default_role_is_public(self):
        user = User.objects.create_user(username="def_role", password="pass12345678")
        assert user.role == User.Role.PUBLIC

    def test_str_returns_username(self):
        user = UserFactory(username="teststr")
        assert str(user) == "teststr"

    def test_roles_exist(self):
        assert set(User.Role.values) == {"superadmin", "organizer", "coach", "public"}


# ── Tokens ───────────────────────────────────────────────────────────────────


class TestTeamTokens:
    def test_generate_and_decode_round_trip(self):
        team = TeamFactory()
        token = generate_team_token(team)
        payload = decode_team_token(token)
        assert payload is not None
        assert payload["team_id"] == team.id
        assert payload["team_name"] == team.name
        assert payload["token_type"] == "team"

    def test_decode_invalid_token_returns_none(self):
        assert decode_team_token("not.a.valid.jwt") is None

    def test_decode_wrong_type_returns_none(self):
        import jwt
        from django.conf import settings

        bad = jwt.encode({"token_type": "user"}, settings.SECRET_KEY, algorithm="HS256")
        assert decode_team_token(bad) is None


# ── TeamAnonymousUser ────────────────────────────────────────────────────────


class TestTeamAnonymousUser:
    def test_properties(self):
        team = TeamFactory()
        token = generate_team_token(team)
        payload = decode_team_token(token)
        tau = TeamAnonymousUser(payload)
        assert tau.is_authenticated is True
        assert tau.is_anonymous is False
        assert tau.is_staff is False
        assert tau.role == "team"
        assert tau.team_id == team.id
        assert tau.username == f"team_{team.id}"
        assert "TeamUser" in str(tau)


# ── KickoffJWTAuthentication ────────────────────────────────────────────────


class TestKickoffJWTAuthentication:
    def test_no_header_returns_none(self):
        factory = APIRequestFactory()
        request = factory.get("/api/v1/auth/me/")
        auth = KickoffJWTAuthentication()
        result = auth.authenticate(request)
        assert result is None

    def test_team_token_returns_team_anonymous_user(self):
        team = TeamFactory()
        token = generate_team_token(team)
        factory = APIRequestFactory()
        request = factory.get("/", HTTP_AUTHORIZATION=f"Bearer {token}")
        auth = KickoffJWTAuthentication()
        user, payload = auth.authenticate(request)
        assert isinstance(user, TeamAnonymousUser)
        assert user.team_id == team.id

    def test_invalid_token_raises(self):
        from rest_framework.exceptions import AuthenticationFailed

        factory = APIRequestFactory()
        request = factory.get("/", HTTP_AUTHORIZATION="Bearer bad.token.value")
        auth = KickoffJWTAuthentication()
        with pytest.raises(AuthenticationFailed):
            auth.authenticate(request)


# ── Permissions ──────────────────────────────────────────────────────────────


class TestPermissions:
    def test_is_organizer_accepts_organizer(self):
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = UserFactory(role="organizer")
        assert IsOrganizer().has_permission(request, None) is True

    def test_is_organizer_rejects_public(self):
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = User.objects.create_user(username="pub", password="pass12345678", role="public")
        assert IsOrganizer().has_permission(request, None) is False

    def test_is_organizer_rejects_team_user(self):
        team = TeamFactory()
        payload = decode_team_token(generate_team_token(team))
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = TeamAnonymousUser(payload)
        assert IsOrganizer().has_permission(request, None) is False

    def test_is_club_owner_or_member(self):
        owner = UserFactory()
        club = ClubFactory(owner=owner)
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = owner
        assert IsClubOwnerOrMember().has_object_permission(request, None, club) is True

    def test_is_club_owner_rejects_stranger(self):
        club = ClubFactory()
        stranger = UserFactory()
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = stranger
        assert IsClubOwnerOrMember().has_object_permission(request, None, club) is False

    def test_is_tournament_owner(self):
        owner = UserFactory()
        club = ClubFactory(owner=owner)
        tournament = TournamentFactory(club=club)
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = owner
        assert IsTournamentOwner().has_object_permission(request, None, tournament) is True

    def test_is_team_member_with_matching_team(self):
        team = TeamFactory()
        payload = decode_team_token(generate_team_token(team))
        tau = TeamAnonymousUser(payload)
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = tau
        assert IsTeamMember().has_object_permission(request, None, team) is True

    def test_is_team_member_rejects_wrong_team(self):
        team1 = TeamFactory()
        team2 = TeamFactory()
        payload = decode_team_token(generate_team_token(team1))
        tau = TeamAnonymousUser(payload)
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = tau
        assert IsTeamMember().has_object_permission(request, None, team2) is False


# ── Serializers ──────────────────────────────────────────────────────────────


class TestRegisterSerializer:
    def test_valid_registration(self):
        data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "StrongPass123!",
            "first_name": "New",
            "last_name": "User",
        }
        s = RegisterSerializer(data=data)
        assert s.is_valid(), s.errors
        user = s.save()
        assert user.role == User.Role.ORGANIZER
        assert user.email == "new@example.com"

    def test_duplicate_email_case_insensitive(self):
        UserFactory(email="dup@example.com")
        data = {
            "username": "unique",
            "email": "DUP@example.com",
            "password": "StrongPass123!",
        }
        s = RegisterSerializer(data=data)
        assert not s.is_valid()
        assert "email" in s.errors

    def test_short_password_rejected(self):
        data = {"username": "valid", "email": "v@e.com", "password": "short"}
        s = RegisterSerializer(data=data)
        assert not s.is_valid()
        assert "password" in s.errors


class TestUserSerializer:
    def test_serializes_user_fields(self):
        user = UserFactory(first_name="Jean", last_name="Dupont")
        data = UserSerializer(user).data
        assert data["username"] == user.username
        assert data["first_name"] == "Jean"
        assert "password" not in data
