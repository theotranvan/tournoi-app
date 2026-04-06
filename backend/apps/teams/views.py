import csv
import io

import qrcode
from django.conf import settings
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core import BusinessRuleViolation
from apps.core.permissions import IsOrganizer
from apps.teams.models import Group, Team, generate_access_code
from apps.teams.serializers import (
    GenerateGroupsSerializer,
    GroupDetailSerializer,
    GroupSerializer,
    TeamAdminSerializer,
)
from apps.tournaments.models import Category
from apps.tournaments.views import _get_tournament_for_nested


class TeamViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOrganizer]
    parser_classes = [JSONParser, MultiPartParser]

    def get_serializer_class(self):
        if self.action in ("list", "retrieve", "create", "update", "partial_update"):
            return TeamAdminSerializer
        return TeamAdminSerializer

    def get_queryset(self):
        tournament_id = self.kwargs.get("tournament_id")
        qs = Team.objects.select_related("category", "tournament")
        if tournament_id:
            qs = qs.filter(tournament_id=tournament_id)
        # Filtres
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        return qs

    def perform_create(self, serializer):
        tournament = _get_tournament_for_nested(self.kwargs, self.request.user)
        serializer.save(tournament=tournament)

    @action(detail=True, methods=["post"], url_path="regenerate-code")
    def regenerate_code(self, request, tournament_id=None, pk=None):
        team = self.get_object()
        team.access_code = generate_access_code()
        team.save(update_fields=["access_code", "updated_at"])
        return Response(TeamAdminSerializer(team, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="qr-code")
    def qr_code(self, request, tournament_id=None, pk=None):
        team = self.get_object()
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
        slug = team.tournament.slug
        url = f"{frontend_url}/t/{slug}/team/{team.access_code}"

        img = qrcode.make(url)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        return HttpResponse(buf.getvalue(), content_type="image/png")

    @action(
        detail=False,
        methods=["post"],
        url_path="bulk-import",
        parser_classes=[MultiPartParser],
    )
    def bulk_import(self, request, tournament_id=None):
        tournament = _get_tournament_for_nested(self.kwargs, request.user)
        file = request.FILES.get("file")
        if not file:
            raise BusinessRuleViolation("Un fichier CSV est requis.")

        # Limit CSV file size to 2 MB
        if file.size > 2 * 1024 * 1024:
            raise BusinessRuleViolation("Le fichier CSV ne doit pas dépasser 2 Mo.")

        decoded = file.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(decoded))
        created = []
        errors = []
        for i, row in enumerate(reader, start=2):
            cat_name = row.get("category", "").strip()
            name = row.get("name", "").strip()
            if not name:
                errors.append(f"Ligne {i}: nom manquant.")
                continue
            try:
                category = Category.objects.get(tournament=tournament, name=cat_name)
            except Category.DoesNotExist:
                errors.append(f"Ligne {i}: catégorie '{cat_name}' introuvable.")
                continue
            team = Team(
                tournament=tournament,
                category=category,
                name=name,
                short_name=row.get("short_name", "")[:20],
                coach_name=row.get("coach_name", ""),
                coach_phone=row.get("coach_phone", ""),
                coach_email=row.get("coach_email", ""),
            )
            team.save()
            created.append(team)

        return Response(
            {
                "created": TeamAdminSerializer(
                    created, many=True, context={"request": request}
                ).data,
                "errors": errors,
                "count": len(created),
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=False, methods=["get"], url_path="suggestions")
    def suggestions(self, request, tournament_id=None):
        """Return distinct team names already used in this tournament.

        Optionally filtered by ?search= and excluding teams in ?exclude_category=.
        """
        tournament = _get_tournament_for_nested(self.kwargs, request.user)
        qs = Team.objects.filter(tournament=tournament)

        exclude_cat = request.query_params.get("exclude_category")
        if exclude_cat:
            qs = qs.exclude(category_id=exclude_cat)

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(name__icontains=search)

        names = (
            qs.values_list("name", flat=True)
            .distinct()
            .order_by("name")[:30]
        )
        return Response(list(names))


class GroupViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOrganizer]

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return GroupDetailSerializer
        return GroupSerializer

    def get_queryset(self):
        category_id = self.kwargs.get("category_id")
        if category_id:
            return Group.objects.filter(category_id=category_id).prefetch_related("teams")
        return Group.objects.none()

    def perform_create(self, serializer):
        category = Category.objects.get(pk=self.kwargs["category_id"])
        serializer.save(category=category)

    @action(detail=False, methods=["post"], url_path="generate-balanced")
    def generate_balanced(self, request, tournament_id=None, category_id=None):
        serializer = GenerateGroupsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        num_groups = serializer.validated_data["num_groups"]

        category = Category.objects.get(pk=category_id)
        teams = list(category.teams.order_by("name"))
        if len(teams) < num_groups:
            raise BusinessRuleViolation(
                f"Pas assez d'équipes ({len(teams)}) pour {num_groups} poules."
            )

        # Delete existing groups for this category
        category.groups.all().delete()

        # Balanced distribution (snake draft)
        groups = []
        for i in range(min(num_groups, 26)):
            group = Group.objects.create(
                category=category,
                name=f"Poule {chr(65 + i)}",
                display_order=i,
            )
            groups.append(group)

        for i, team in enumerate(teams):
            cycle = i // num_groups
            idx = i % num_groups
            # Snake: reverse on odd cycles
            if cycle % 2 == 1:
                idx = num_groups - 1 - idx
            groups[idx].teams.add(team)

        return Response(
            GroupDetailSerializer(groups, many=True).data,
            status=status.HTTP_201_CREATED,
        )
