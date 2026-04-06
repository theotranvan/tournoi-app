from django.db import IntegrityError
from django.db import models as db_models
from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.clubs.models import Club
from apps.core import BusinessRuleViolation, InvalidStateTransition
from apps.core.permissions import IsOrganizer
from apps.subscriptions.plans import (
    FREE_LIMITS,
    check_can_create_tournament,
    get_effective_plan,
)
from apps.tournaments.models import Category, Field, SchedulingConstraint, Tournament
from apps.tournaments.serializers import (
    BulkCategorySerializer,
    CategorySerializer,
    FieldSerializer,
    SchedulingConstraintSerializer,
    TournamentCreateSerializer,
    TournamentDetailSerializer,
    TournamentListSerializer,
)


def _check_tournament_access(user, tournament):
    """Raise PermissionDenied unless user is owner or member of the tournament's club."""
    club = tournament.club
    if club.owner_id != user.id and not club.members.filter(id=user.id).exists():
        raise PermissionDenied("Vous n'avez pas accès à ce tournoi.")


def _get_tournament_for_nested(kwargs, user):
    """Retrieve and permission-check a tournament from nested URL kwargs."""
    tournament = get_object_or_404(Tournament, pk=kwargs["tournament_id"])
    _check_tournament_access(user, tournament)
    return tournament


def _annotate_tournament_qs(qs):
    return qs.annotate(
        nb_categories=Count("categories", distinct=True),
        nb_teams=Count("teams", distinct=True),
        nb_matches=Count("matches", distinct=True),
        nb_fields=Count("fields", distinct=True),
    )


class TournamentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOrganizer]
    lookup_field = "id"

    def get_serializer_class(self):
        if self.action == "create":
            return TournamentCreateSerializer
        if self.action == "list":
            return TournamentListSerializer
        return TournamentDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Tournament.objects.filter(
            db_models.Q(club__owner=user) | db_models.Q(club__members=user)
        ).distinct()
        qs = _annotate_tournament_qs(qs).order_by("-start_date")
        # Filtres optionnels
        club = self.request.query_params.get("club")
        if club:
            qs = qs.filter(club_id=club)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        # Plan gate: limit active tournaments for FREE users
        error = check_can_create_tournament(self.request.user)
        if error:
            raise PermissionDenied(error)

        club = serializer.validated_data.get("club")
        if not club:
            club, _ = Club.objects.get_or_create(
                owner=self.request.user,
                defaults={"name": f"Club de {self.request.user.get_full_name() or self.request.user.username}"},
            )
        else:
            _check_tournament_access(self.request.user, type("T", (), {"club": club})())
        serializer.save(club=club)

    def perform_update(self, serializer):
        tournament = self.get_object()
        if tournament.status in (
            Tournament.Status.LIVE,
            Tournament.Status.FINISHED,
            Tournament.Status.ARCHIVED,
        ):
            raise InvalidStateTransition(
                "Impossible de modifier un tournoi en cours, terminé ou archivé."
            )
        serializer.save()

    def perform_destroy(self, instance):
        if instance.matches.filter(status="finished").exists():
            raise BusinessRuleViolation(
                "Impossible de supprimer un tournoi avec des matchs joués."
            )
        instance.status = Tournament.Status.ARCHIVED
        instance.save(update_fields=["status", "updated_at"])

    @action(detail=True, methods=["post"])
    def publish(self, request, id=None):
        tournament = self.get_object()
        if tournament.status != Tournament.Status.DRAFT:
            raise InvalidStateTransition(
                "Seul un tournoi en brouillon peut être publié."
            )
        errors = []
        if tournament.categories.count() == 0:
            errors.append("Au moins une catégorie est requise.")
        if tournament.fields.filter(is_active=True).count() == 0:
            errors.append("Au moins un terrain actif est requis.")
        for cat in tournament.categories.all():
            if cat.teams.count() < 2:
                errors.append(f"La catégorie {cat.name} doit avoir au moins 2 équipes.")
        if errors:
            raise InvalidStateTransition(" ".join(errors))
        tournament.status = Tournament.Status.PUBLISHED
        tournament.save(update_fields=["status", "updated_at"])
        return Response(self._detail(tournament))

    @action(detail=True, methods=["post"])
    def start(self, request, id=None):
        tournament = self.get_object()
        if tournament.status != Tournament.Status.PUBLISHED:
            raise InvalidStateTransition(
                "Seul un tournoi publié peut être démarré."
            )
        tournament.status = Tournament.Status.LIVE
        tournament.save(update_fields=["status", "updated_at"])
        return Response(self._detail(tournament))

    @action(detail=True, methods=["post"])
    def finish(self, request, id=None):
        tournament = self.get_object()
        if tournament.status != Tournament.Status.LIVE:
            raise InvalidStateTransition(
                "Seul un tournoi en cours peut être terminé."
            )
        tournament.status = Tournament.Status.FINISHED
        tournament.save(update_fields=["status", "updated_at"])
        return Response(self._detail(tournament))

    @action(detail=True, methods=["post"])
    def duplicate(self, request, id=None):
        error = check_can_create_tournament(request.user)
        if error:
            raise PermissionDenied(error)
        original = self.get_object()
        clone = Tournament.objects.create(
            club=original.club,
            name=f"{original.name} (copie)",
            location=original.location,
            start_date=original.start_date,
            end_date=original.end_date,
            description=original.description,
            rules=original.rules,
            default_match_duration=original.default_match_duration,
            default_transition_time=original.default_transition_time,
            default_rest_time=original.default_rest_time,
        )
        for cat in original.categories.all():
            Category.objects.create(
                tournament=clone,
                name=cat.name,
                display_order=cat.display_order,
                color=cat.color,
                match_duration=cat.match_duration,
                transition_time=cat.transition_time,
                rest_time=cat.rest_time,
                players_per_team=cat.players_per_team,
                points_win=cat.points_win,
                points_draw=cat.points_draw,
                points_loss=cat.points_loss,
            )
        for field in original.fields.all():
            Field.objects.create(
                tournament=clone,
                name=field.name,
                display_order=field.display_order,
                is_active=field.is_active,
                availability=field.availability,
            )
        return Response(self._detail(clone), status=status.HTTP_201_CREATED)

    def _detail(self, tournament):
        """Re-annotate a single tournament for serialization."""
        qs = _annotate_tournament_qs(Tournament.objects.filter(pk=tournament.pk))
        return TournamentDetailSerializer(qs.first()).data


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, IsOrganizer]

    def get_queryset(self):
        tournament_id = self.kwargs.get("tournament_id")
        if tournament_id:
            return Category.objects.filter(tournament_id=tournament_id)
        return Category.objects.none()

    def perform_create(self, serializer):
        tournament = _get_tournament_for_nested(self.kwargs, self.request.user)
        # Plan gate: limit categories for FREE users
        if get_effective_plan(self.request.user, tournament) == "FREE":
            if tournament.categories.count() >= FREE_LIMITS.max_categories_per_tournament:
                raise PermissionDenied(
                    f"Le plan gratuit est limité à {FREE_LIMITS.max_categories_per_tournament} catégories par tournoi."
                )
        try:
            serializer.save(tournament=tournament)
        except IntegrityError:
            raise ValidationError(
                {"name": "Une catégorie avec ce nom existe déjà dans ce tournoi."}
            )

    def perform_destroy(self, instance):
        if instance.teams.exists():
            raise BusinessRuleViolation(
                "Impossible de supprimer une catégorie qui contient des équipes."
            )
        if instance.matches.exists():
            raise BusinessRuleViolation(
                "Impossible de supprimer une catégorie qui contient des matchs."
            )
        instance.delete()

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request, tournament_id=None):
        serializer = BulkCategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tournament = _get_tournament_for_nested(self.kwargs, request.user)
        # Plan gate: limit categories for FREE users
        if get_effective_plan(request.user, tournament) == "FREE":
            incoming = len(serializer.validated_data["categories"])
            existing = tournament.categories.count()
            if existing + incoming > FREE_LIMITS.max_categories_per_tournament:
                raise PermissionDenied(
                    f"Le plan gratuit est limité à {FREE_LIMITS.max_categories_per_tournament} catégories par tournoi."
                )
        created = []
        for i, cat_data in enumerate(serializer.validated_data["categories"]):
            cat = Category.objects.create(
                tournament=tournament,
                name=cat_data.get("name", f"Cat {i+1}"),
                display_order=cat_data.get("display_order", i),
                color=cat_data.get("color", "#3b82f6"),
                players_per_team=cat_data.get("players_per_team", 7),
            )
            created.append(cat)
        return Response(
            CategorySerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class FieldViewSet(viewsets.ModelViewSet):
    serializer_class = FieldSerializer
    permission_classes = [IsAuthenticated, IsOrganizer]

    def get_queryset(self):
        tournament_id = self.kwargs.get("tournament_id")
        if tournament_id:
            return Field.objects.filter(tournament_id=tournament_id)
        return Field.objects.none()

    def perform_create(self, serializer):
        tournament = _get_tournament_for_nested(self.kwargs, self.request.user)
        # Plan gate: limit fields for FREE users
        if get_effective_plan(self.request.user, tournament) == "FREE":
            if tournament.fields.count() >= FREE_LIMITS.max_fields_per_tournament:
                raise PermissionDenied(
                    f"Le plan gratuit est limité à {FREE_LIMITS.max_fields_per_tournament} terrains par tournoi."
                )
        self._validate_availability(serializer.validated_data, tournament)
        serializer.save(tournament=tournament)

    def perform_update(self, serializer):
        tournament = serializer.instance.tournament
        self._validate_availability(serializer.validated_data, tournament)
        serializer.save()

    def _validate_availability(self, data, tournament):
        availability = data.get("availability", [])
        for slot in availability:
            date_str = slot.get("date", "")
            if date_str:
                from datetime import date as dt_date

                try:
                    slot_date = dt_date.fromisoformat(date_str)
                except ValueError:
                    continue
                if slot_date < tournament.start_date or slot_date > tournament.end_date:
                    raise ValidationError(
                        {"availability": f"La date {date_str} est hors de la période du tournoi."}
                    )


class SchedulingConstraintViewSet(viewsets.ModelViewSet):
    serializer_class = SchedulingConstraintSerializer
    permission_classes = [IsAuthenticated, IsOrganizer]

    def get_queryset(self):
        tournament_id = self.kwargs.get("tournament_id")
        if tournament_id:
            return SchedulingConstraint.objects.filter(tournament_id=tournament_id)
        return SchedulingConstraint.objects.none()

    def perform_create(self, serializer):
        tournament = _get_tournament_for_nested(self.kwargs, self.request.user)
        serializer.save(tournament=tournament)
