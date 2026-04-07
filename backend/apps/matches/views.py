import logging

from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core import BusinessRuleViolation, InvalidStateTransition
from apps.core.permissions import IsOrganizer
from apps.matches.models import Goal, Match

logger = logging.getLogger(__name__)
from apps.matches.serializers import (
    GoalSerializer,
    MatchDetailSerializer,
    MatchListSerializer,
    MatchUpdateSerializer,
    ScoreInputSerializer,
)


class MatchViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOrganizer]
    lookup_field = "id"

    def get_serializer_class(self):
        if self.action == "list":
            return MatchListSerializer
        if self.action in ("update", "partial_update"):
            return MatchUpdateSerializer
        return MatchDetailSerializer

    def get_queryset(self):
        tournament_id = self.kwargs.get("tournament_id")
        qs = Match.objects.select_related(
            "category", "group", "field", "team_home", "team_away"
        ).prefetch_related("goals")
        if tournament_id:
            qs = qs.filter(tournament_id=tournament_id)

        # Filtres
        params = self.request.query_params
        if params.get("category"):
            qs = qs.filter(category_id=params["category"])
        if params.get("field"):
            qs = qs.filter(field_id=params["field"])
        if params.get("date"):
            qs = qs.filter(start_time__date=params["date"])
        if params.get("team"):
            team_id = params["team"]
            from django.db.models import Q

            qs = qs.filter(Q(team_home_id=team_id) | Q(team_away_id=team_id))
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("phase"):
            qs = qs.filter(phase=params["phase"])
        return qs

    @action(detail=True, methods=["post"])
    def start(self, request, tournament_id=None, id=None):
        match = self.get_object()
        if match.status != Match.Status.SCHEDULED:
            raise InvalidStateTransition(
                "Seul un match programmé peut être démarré."
            )
        match.status = Match.Status.LIVE
        match.save(update_fields=["status", "updated_at"])
        return Response(MatchDetailSerializer(match).data)

    @action(detail=True, methods=["post"])
    def score(self, request, tournament_id=None, id=None):
        serializer = ScoreInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            match = Match.objects.select_for_update().get(pk=self.get_object().pk)
            if match.status not in (Match.Status.LIVE, Match.Status.SCHEDULED):
                raise BusinessRuleViolation(
                    "Le score ne peut être saisi que sur un match en cours ou programmé."
                )

            match.score_home = data["score_home"]
            match.score_away = data["score_away"]
            match.penalty_score_home = data.get("penalty_score_home")
            match.penalty_score_away = data.get("penalty_score_away")
            match.score_entered_by = request.user
            if match.status == Match.Status.SCHEDULED:
                match.status = Match.Status.LIVE
            match.save(update_fields=[
                "score_home", "score_away", "penalty_score_home", "penalty_score_away",
                "score_entered_by", "status", "updated_at"
            ])

            # Handle goals
            if data.get("goals"):
                match.goals.all().delete()
                for goal_data in data["goals"]:
                    team = match.team_home if goal_data["team"] == "home" else match.team_away
                    if team:
                        Goal.objects.create(
                            match=match,
                            team=team,
                            player_name=goal_data.get("player_name", ""),
                            minute=goal_data.get("minute"),
                        )

        match.refresh_from_db()
        return Response(MatchDetailSerializer(match).data)

    @action(detail=True, methods=["post"])
    def finish(self, request, tournament_id=None, id=None):
        match = self.get_object()
        if match.status != Match.Status.LIVE:
            raise InvalidStateTransition(
                "Seul un match en cours peut être terminé."
            )
        if match.score_home is None or match.score_away is None:
            raise BusinessRuleViolation(
                "Le score doit être saisi avant de terminer un match."
            )
        match.status = Match.Status.FINISHED
        match.score_validated = True
        match.save(update_fields=["status", "score_validated", "updated_at"])
        logger.info(
            "match.finished",
            extra={
                "match_id": str(match.id),
                "tournament_id": str(match.tournament_id),
                "score": f"{match.score_home}-{match.score_away}",
                "user_id": str(request.user.id),
            },
        )
        return Response(MatchDetailSerializer(match).data)

    @action(detail=True, methods=["post"])
    def lock(self, request, tournament_id=None, id=None):
        match = self.get_object()
        match.is_locked = True
        match.save(update_fields=["is_locked", "updated_at"])
        return Response(MatchDetailSerializer(match).data)

    @action(detail=True, methods=["post"])
    def unlock(self, request, tournament_id=None, id=None):
        match = self.get_object()
        match.is_locked = False
        match.save(update_fields=["is_locked", "updated_at"])
        return Response(MatchDetailSerializer(match).data)

    @action(detail=True, methods=["post", "get"], url_path="goals")
    def goals(self, request, tournament_id=None, id=None):
        match = self.get_object()
        if request.method == "GET":
            return Response(GoalSerializer(match.goals.all(), many=True).data)

        # POST — add a single goal
        serializer = GoalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(match=match)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class GoalDeleteView:
    """Handled via match action endpoint."""
    pass
