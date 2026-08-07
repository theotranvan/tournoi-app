"""Custom JWT authentication that supports both User tokens and Team tokens."""

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.accounts.tokens import decode_team_token


def _team_token_current(payload: dict) -> bool:
    """Reject team tokens whose version no longer matches the team's.

    ``regenerate_code`` bumps ``Team.token_version``, so previously issued
    (still-unexpired) team JWTs become invalid — giving a way to actually revoke
    a leaked/compromised access. Costs one indexed lookup per team-token request.
    """
    from apps.teams.models import Team

    current = Team.objects.filter(id=payload.get("team_id")).values_list("token_version", flat=True).first()
    if current is None:
        return False  # team deleted
    return current == payload.get("token_version", 0)


class TeamAnonymousUser:
    """Lightweight user-like object for team token sessions."""

    is_authenticated = True
    is_anonymous = False
    is_active = True
    is_staff = False
    is_superuser = False

    def __init__(self, payload: dict) -> None:
        self.team_id: int = payload["team_id"]
        self.tournament_id: str = payload["tournament_id"]
        self.category_id: int = payload["category_id"]
        self.team_name: str = payload.get("team_name", "")
        self.role = "team"
        self.pk = None
        self.id = None

    def __str__(self) -> str:
        return f"TeamUser({self.team_name})"

    @property
    def username(self) -> str:
        return f"team_{self.team_id}"


class KickoffJWTAuthentication(BaseAuthentication):
    """Authenticate via standard JWT or team-scoped JWT."""

    def authenticate_header(self, request):
        return 'Bearer realm="api"'

    def authenticate(self, request):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer "):
            return None

        token = header[7:]

        # Try team token first (cheaper decode)
        team_payload = decode_team_token(token)
        if team_payload is not None:
            if not _team_token_current(team_payload):
                raise AuthenticationFailed("Accès équipe révoqué ou expiré.")
            return (TeamAnonymousUser(team_payload), team_payload)

        # Fall back to standard SimpleJWT user authentication. SimpleJWT raises
        # InvalidToken (a 401) for bad/expired tokens; let unexpected errors
        # (e.g. misconfiguration) surface instead of masking them as "invalid".
        jwt_auth = JWTAuthentication()
        return jwt_auth.authenticate(request)
