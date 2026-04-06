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
from rest_framework.views import APIView

from apps.core.permissions import IsOrganizer
from apps.matches.models import Match
from apps.scheduling.engine import SchedulingEngine
from apps.scheduling.serializers import GenerateScheduleSerializer, RecalculateSerializer
from apps.scheduling.tasks import generate_schedule_task
from apps.scheduling.bracket_resolver import resolve_brackets
from apps.tournaments.views import _get_tournament_for_nested

logger = logging.getLogger(__name__)


class GenerateScheduleView(APIView):
    """POST /api/v1/tournaments/{id}/schedule/generate/

    Launch schedule generation (sync or async via Celery).
    """

    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, tournament_id):
        tournament = _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )

        serializer = GenerateScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        strategy = serializer.validated_data["strategy"]
        async_mode = serializer.validated_data["async_mode"]

        if async_mode:
            result = generate_schedule_task.delay(
                str(tournament.id), strategy=strategy,
            )
            return Response(
                {"task_id": result.id, "status": "pending"},
                status=status.HTTP_202_ACCEPTED,
            )

        engine = SchedulingEngine(tournament, strategy=strategy)
        report = engine.generate()

        with transaction.atomic():
            engine.commit_to_db()

        return Response(report.to_dict(), status=status.HTTP_200_OK)


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

    Return the complete schedule grouped by day and field.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, tournament_id):
        tournament = _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )

        matches = (
            Match.objects.filter(tournament=tournament, status=Match.Status.SCHEDULED)
            .select_related("field", "category", "team_home", "team_away", "group")
            .order_by("start_time")
        )

        # Group by day → field
        schedule: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
        for m in matches:
            day = m.start_time.date().isoformat() if m.start_time else "unknown"
            field_name = m.field.name if m.field else "Aucun"
            schedule[day][field_name].append({
                "id": str(m.id),
                "phase": m.phase,
                "category": m.category.name,
                "team_home": m.team_home.name if m.team_home else m.placeholder_home,
                "team_away": m.team_away.name if m.team_away else m.placeholder_away,
                "start_time": m.start_time.isoformat() if m.start_time else None,
                "duration": m.duration_minutes,
                "is_locked": m.is_locked,
                "group": m.group.name if m.group else None,
            })

        return Response({"schedule": dict(schedule), "total_matches": matches.count()})


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
    Returns total matches, available slots, utilization %, and feasibility.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, tournament_id):
        tournament = _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )
        result = SchedulingEngine.check_feasibility(tournament)
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
