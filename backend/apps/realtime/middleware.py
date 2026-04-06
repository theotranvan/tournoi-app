"""JWT authentication middleware for WebSocket connections.

Parses the JWT from the query string ``?token=<jwt>`` and attaches
the authenticated user to ``scope["user"]``.  Falls back to
``AnonymousUser`` when the token is missing or invalid.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User


@database_sync_to_async
def _get_user(user_id):
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """Authenticate WebSocket connections via ``?token=`` query parameter."""

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode("utf-8")
        params = parse_qs(query_string)
        token_list = params.get("token", [])

        if token_list:
            try:
                access_token = AccessToken(token_list[0])
                scope["user"] = await _get_user(access_token["user_id"])
            except (InvalidToken, TokenError, KeyError):
                scope["user"] = AnonymousUser()
        else:
            scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)
