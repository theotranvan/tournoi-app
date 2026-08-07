import logging

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import update_last_login
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.serializers import (
    LoginSerializer,
    RegisterSerializer,
    TeamAccessSerializer,
    UserSerializer,
)
from apps.accounts.tokens import generate_team_token
from apps.teams.models import Team
from apps.teams.serializers import TeamBriefSerializer

User = get_user_model()
logger = logging.getLogger(__name__)


def _client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR", "")


class AuthRateThrottle(AnonRateThrottle):
    rate = "5/minute"


class LoginUsernameThrottle(SimpleRateThrottle):
    """Throttle login attempts per username, complementing the per-IP throttle."""

    scope = "login_username"
    rate = "10/minute"

    def get_cache_key(self, request, view):
        username = (request.data.get("username") or "").strip().lower()
        if not username:
            return None
        return self.cache_format % {"scope": self.scope, "ident": username}


class TeamAccessRateThrottle(AnonRateThrottle):
    rate = "10/minute"


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle, LoginUsernameThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"]
        user = authenticate(
            username=username,
            password=serializer.validated_data["password"],
        )
        if user is None:
            logger.warning("auth.login_failed", extra={"login": username, "client_ip": _client_ip(request)})
            return Response(
                {
                    "error": "auth_required",
                    "message": "Identifiants invalides.",
                    "details": {},
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )
        update_last_login(None, user)
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            }
        )


class RefreshView(TokenRefreshView):
    """Proxy pour refresh standard SimpleJWT."""

    pass


class TeamAccessView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [TeamAccessRateThrottle]

    def post(self, request):
        serializer = TeamAccessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["access_code"].strip().upper()
        try:
            team = Team.objects.select_related("category", "tournament").get(access_code=code)
        except Team.DoesNotExist:
            return Response(
                {
                    "error": "not_found",
                    "message": "Code d'accès invalide.",
                    "details": {},
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        token = generate_team_token(team)
        return Response(
            {
                "access": token,
                "team": TeamBriefSerializer(team).data,
            }
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class LogoutView(APIView):
    """POST /api/v1/auth/logout/ — Blacklist the refresh token."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": "refresh_required", "message": "Le token refresh est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass  # Token already blacklisted or invalid — still return 200
        return Response(status=status.HTTP_200_OK)
