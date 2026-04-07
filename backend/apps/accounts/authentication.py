"""Custom JWT authentication that supports both User tokens and Team tokens."""

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.accounts.tokens import decode_team_token


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
            return (TeamAnonymousUser(team_payload), team_payload)

        # Fall back to standard SimpleJWT user authentication
        try:
            jwt_auth = JWTAuthentication()
            return jwt_auth.authenticate(request)
        except Exception:
            raise AuthenticationFailed("Token invalide ou expiré.")
