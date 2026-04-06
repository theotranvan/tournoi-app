from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
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


class AuthRateThrottle(AnonRateThrottle):
    rate = "5/minute"


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
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            return Response(
                {
                    "error": "auth_required",
                    "message": "Identifiants invalides.",
                    "details": {},
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )
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

    def post(self, request):
        serializer = TeamAccessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["access_code"]
        try:
            team = Team.objects.select_related(
                "category", "tournament"
            ).get(access_code=code)
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
