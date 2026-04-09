"""Scheduling REST API views."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import timedelta

from celery.result import AsyncResult
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.core.permissions import IsOrganizer


class ScheduleGenerateThrottle(UserRateThrottle):
    rate = "5/hour"
from apps.matches.models import Match
from apps.scheduling.engine import SchedulingEngine
from apps.scheduling.generate import (
    auto_generate_pools,
    calculate_feasibility,
    generate_finals,
    generate_schedule,
    propagate_winner,
)
from apps.scheduling.serializers import GenerateScheduleSerializer, RecalculateSerializer
from apps.scheduling.tasks import generate_schedule_task
from apps.scheduling.bracket_resolver import resolve_brackets
from apps.tournaments.views import _get_tournament_for_nested

logger = logging.getLogger(__name__)


class GenerateScheduleView(APIView):
    """POST /api/v1/tournaments/{id}/schedule/generate/

    Launch schedule generation using the new slot-based algorithm.
    """

    permission_classes = [IsAuthenticated, IsOrganizer]
    throttle_classes = [ScheduleGenerateThrottle]

    def post(self, request, tournament_id):
        tournament = _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )

        result = generate_schedule(tournament)

        if result.get("success"):
            logger.info(
                "schedule.generated",
                extra={
                    "tournament_id": str(tournament.id),
                    "user_id": str(request.user.id),
                    "total_matches": result.get("stats", {}).get("total_matches", 0),
                },
            )
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)


class ScheduleTaskStatusView(APIView):
    """GET /api/v1/tournaments/{id}/schedule/task/{task_id}/

    Poll the status and progress of an async schedule generation task.
    """

    permission_classes = [IsAuthenticated, IsOrganizer]

    def get(self, request, tournament_id, task_id):
        _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )

        result = AsyncResult(task_id)
        data = {"task_id": task_id, "status": result.state}

        if result.state == "PROGRESS":
            data.update(result.info or {})
        elif result.state == "SUCCESS":
            data["result"] = result.result
        elif result.state == "FAILURE":
            data["error"] = str(result.result)

        return Response(data)


class ScheduleListView(APIView):
    """GET /api/v1/tournaments/{id}/schedule/

    Return the complete schedule as ScheduleDay[] (grouped by date -> field).
    Each match includes all fields expected by the frontend MatchList type.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, tournament_id):
        tournament = _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )

        matches = (
            Match.objects.filter(tournament=tournament)
            .select_related("field", "category", "team_home", "team_away", "group")
            .order_by("start_time")
        )

        days_dict: dict = {}
        for m in matches:
            day = m.start_time.date().isoformat() if m.start_time else "unknown"
            field_id = m.field_id or 0
            field_name = m.field.name if m.field else "Aucun terrain"

            if day not in days_dict:
                days_dict[day] = {}
            if field_id not in days_dict[day]:
                days_dict[day][field_id] = {
                    "field": {"id": field_id, "name": field_name},
                    "matches": [],
                }

            days_dict[day][field_id]["matches"].append({
                "id": str(m.id),
                "tournament": str(m.tournament_id),
                "category": m.category_id,
                "category_name": m.category.name if m.category else "",
                "group": m.group_id,
                "phase": m.phase,
                "team_home": m.team_home_id,
                "team_away": m.team_away_id,
                "display_home": m.display_home,
                "display_away": m.display_away,
                "placeholder_home": m.placeholder_home or "",
                "placeholder_away": m.placeholder_away or "",
                "field": field_id or None,
                "field_name": field_name,
                "start_time": m.start_time.isoformat() if m.start_time else None,
                "duration_minutes": m.duration_minutes,
                "status": m.status,
                "score_home": m.score_home,
                "score_away": m.score_away,
                "penalty_score_home": m.penalty_score_home,
                "penalty_score_away": m.penalty_score_away,
                "is_locked": m.is_locked,
                "slot_index": m.slot_index,
            })

        result = [
            {"date": day, "fields": list(fields.values())}
            for day, fields in sorted(days_dict.items())
        ]
        return Response(result)


class RecalculateScheduleView(APIView):
    """POST /api/v1/tournaments/{id}/schedule/recalculate/

    Incremental recalculation for specific matches.
    """

    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, tournament_id):
        tournament = _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )

        serializer = RecalculateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        match_ids = [str(uid) for uid in serializer.validated_data["match_ids"]]

        report = SchedulingEngine.reschedule(tournament, match_ids)
        return Response(report.to_dict(), status=status.HTTP_200_OK)


class ScheduleConflictsView(APIView):
    """GET /api/v1/tournaments/{id}/schedule/conflicts/

    Detect scheduling conflicts in the current schedule.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, tournament_id):
        tournament = _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )

        matches = list(
            Match.objects.filter(tournament=tournament, status=Match.Status.SCHEDULED)
            .select_related("field", "category")
            .order_by("start_time")
        )

        conflicts = []

        # Check field overlaps
        field_matches: dict[int, list[Match]] = defaultdict(list)
        for m in matches:
            if m.field_id:
                field_matches[m.field_id].append(m)

        for fid, fmatches in field_matches.items():
            fmatches.sort(key=lambda m: m.start_time)
            for i in range(1, len(fmatches)):
                prev = fmatches[i - 1]
                curr = fmatches[i]
                prev_end = prev.start_time + timedelta(minutes=prev.duration_minutes)
                if curr.start_time < prev_end:
                    conflicts.append({
                        "type": "field_overlap",
                        "field_id": fid,
                        "match_a": str(prev.id),
                        "match_b": str(curr.id),
                    })

        # Check team overlaps
        team_matches: dict[int, list[Match]] = defaultdict(list)
        for m in matches:
            for tid in [m.team_home_id, m.team_away_id]:
                if tid:
                    team_matches[tid].append(m)

        for tid, tmatches in team_matches.items():
            tmatches.sort(key=lambda m: m.start_time)
            for i in range(1, len(tmatches)):
                prev = tmatches[i - 1]
                curr = tmatches[i]
                prev_end = prev.start_time + timedelta(minutes=prev.duration_minutes)
                gap = (curr.start_time - prev_end).total_seconds() / 60.0
                rest_min = curr.category.effective_rest_time if curr.category else tournament.default_rest_time
                if gap < rest_min:
                    conflicts.append({
                        "type": "team_rest_violation",
                        "team_id": tid,
                        "match_a": str(prev.id),
                        "match_b": str(curr.id),
                        "rest_minutes": round(gap, 1),
                        "required_minutes": rest_min,
                    })

        return Response({"conflicts": conflicts, "count": len(conflicts)})


class ScheduleFeasibilityView(APIView):
    """GET /api/v1/tournaments/{id}/schedule/feasibility/

    Quick feasibility check before scheduling (ported from tournoi-exemple).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, tournament_id):
        tournament = _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )
        result = calculate_feasibility(tournament)
        return Response(result)


class ResolveBracketsView(APIView):
    """POST /api/v1/tournaments/{id}/schedule/resolve-brackets/

    Manually trigger bracket resolution: assign teams to knockout matches
    based on group standings and advance winners from finished knockout matches.
    """

    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, tournament_id):
        tournament = _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )
        results = resolve_brackets(tournament)
        return Response(results, status=status.HTTP_200_OK)


class ScheduleDiagnosticsView(APIView):
    """GET /api/v1/tournaments/{id}/schedule/diagnostics/

    Re-score the current schedule in explain mode and return per-match
    diagnostics with penalty breakdowns.
    """

    permission_classes = [IsAuthenticated, IsOrganizer]

    def get(self, request, tournament_id):
        tournament = _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )
        result = SchedulingEngine.diagnose_current_schedule(tournament)
        return Response(result)


class SuggestSwapView(APIView):
    """POST /api/v1/tournaments/{id}/schedule/suggest-swap/{match_id}/

    Find and optionally apply the best 2-opt swap for a specific match.
    Query param ?apply=true will execute the swap in DB.
    """

    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, tournament_id, match_id):
        tournament = _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )
        suggestion = SchedulingEngine.suggest_swap(tournament, match_id)
        if not suggestion:
            return Response(
                {"detail": "Aucun échange améliorant trouvé."},
                status=status.HTTP_404_NOT_FOUND,
            )

        apply = request.query_params.get("apply", "").lower() == "true"
        if apply:
            swap_id = suggestion["swap_with_match_id"]
            with transaction.atomic():
                m1 = Match.objects.select_for_update().get(pk=match_id)
                m2 = Match.objects.select_for_update().get(pk=swap_id)
                m1.field_id, m2.field_id = m2.field_id, m1.field_id
                m1.start_time, m2.start_time = m2.start_time, m1.start_time
                m1.save(update_fields=["field_id", "start_time"])
                m2.save(update_fields=["field_id", "start_time"])
            suggestion["applied"] = True
        else:
            suggestion["applied"] = False

        return Response(suggestion)


class AutoGeneratePoolsView(APIView):
    """POST /api/v1/tournaments/{id}/categories/{cat_id}/auto-pools/

    Auto-generate balanced pools for a category.
    """

    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, tournament_id, category_id):
        from apps.tournaments.models import Category

        _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )
        try:
            category = Category.objects.get(pk=category_id, tournament_id=tournament_id)
        except Category.DoesNotExist:
            return Response(
                {"error": "Catégorie introuvable"},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = auto_generate_pools(category)
        pool_data = [
            {"id": p.id, "name": p.name, "team_count": p.teams.count()}
            for p in result.get("pools", [])
        ]
        return Response({
            "warnings": result.get("warnings", []),
            "pools": pool_data,
        })


class GenerateFinalsView(APIView):
    """POST /api/v1/tournaments/{id}/categories/{cat_id}/finals/

    Generate knockout/finals matches after pool phase.
    """

    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, tournament_id, category_id):
        from apps.tournaments.models import Category

        _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )
        try:
            category = Category.objects.get(pk=category_id, tournament_id=tournament_id)
        except Category.DoesNotExist:
            return Response(
                {"error": "Catégorie introuvable"},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = generate_finals(category)
        if result.get("success"):
            return Response(result)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
