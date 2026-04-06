"""Custom JWT token for team access (QR code flow)."""

from datetime import timedelta

import jwt
from django.conf import settings
from django.utils import timezone


def generate_team_token(team) -> str:
    """Generate a 24h JWT scoped to a specific team."""
    now = timezone.now()
    payload = {
        "token_type": "team",
        "team_id": team.id,
        "tournament_id": str(team.tournament_id),
        "category_id": team.category_id,
        "team_name": team.name,
        "iat": now,
        "exp": now + timedelta(hours=24),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_team_token(token: str) -> dict | None:
    """Decode and validate a team JWT. Returns payload or None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("token_type") != "team":
            return None
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
