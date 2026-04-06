"""Match postpone assistant — find compatible replacement slots."""

from collections import defaultdict
from datetime import timedelta

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core import BusinessRuleViolation
from apps.core.permissions import IsOrganizer
from apps.matches.models import Match
from apps.matches.serializers import MatchDetailSerializer
from apps.tournaments.views import _get_tournament_for_nested


class PostponeMatchView(APIView):
    """POST /api/v1/tournaments/{tid}/matches/{mid}/postpone/

    Suggest 3 compatible reschedule slots, or apply one.
    Body: { "reason": "...", "apply_slot_index": null | 0-2 }
    """

    permission_classes = [IsAuthenticated, IsOrganizer]

    def post(self, request, tournament_id, match_id):
        tournament = _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )
        try:
            match = Match.objects.select_related(
                "field", "team_home", "team_away", "category",
            ).get(pk=match_id, tournament=tournament)
        except Match.DoesNotExist:
            return Response(
                {"error": "not_found", "message": "Match introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        reason = request.data.get("reason", "")
        apply_idx = request.data.get("apply_slot_index")

        # Find available slots
        slots = self._find_slots(tournament, match)

        if apply_idx is not None:
            # Apply the selected slot
            try:
                slot = slots[int(apply_idx)]
            except (IndexError, ValueError):
                raise BusinessRuleViolation("Créneau invalide.")

            match.field_id = slot["field_id"]
            match.start_time = slot["start_time"]
            match.status = Match.Status.SCHEDULED
            match.notes = f"{match.notes}\n[Reporté] {reason}".strip()
            match.save(update_fields=[
                "field_id", "start_time", "status", "notes", "updated_at",
            ])

            return Response({
                "match": MatchDetailSerializer(match).data,
                "applied_slot": slot,
                "reason": reason,
            })

        return Response({
            "match_id": str(match.id),
            "current_time": match.start_time.isoformat() if match.start_time else None,
            "current_field": match.field.name if match.field else None,
            "suggested_slots": slots,
        })

    def _find_slots(self, tournament, target_match):
        """Find up to 3 compatible time slots for rescheduling."""
        fields = tournament.fields.filter(is_active=True)
        all_matches = list(
            Match.objects.filter(tournament=tournament)
            .exclude(pk=target_match.pk)
            .exclude(status=Match.Status.CANCELLED)
            .select_related("field", "team_home", "team_away")
        )

        duration = target_match.duration_minutes
        transition = target_match.category.effective_transition_time if target_match.category else 5
        rest_time = target_match.category.effective_rest_time if target_match.category else 15

        # Build occupation map: field_id -> list of (start, end)
        occupied: dict[int, list[tuple]] = defaultdict(list)
        for m in all_matches:
            if m.field_id and m.start_time:
                end = m.start_time + timedelta(minutes=m.duration_minutes + transition)
                occupied[m.field_id].append((m.start_time, end))

        # Build team schedule for rest checking
        team_schedule = []
        for tid in [target_match.team_home_id, target_match.team_away_id]:
            if not tid:
                continue
            for m in all_matches:
                if m.start_time and (m.team_home_id == tid or m.team_away_id == tid):
                    team_schedule.append((m.start_time, m.start_time + timedelta(minutes=m.duration_minutes)))

        slots = []
        # Try each field, scan for gaps
        for field in fields:
            field_occ = sorted(occupied.get(field.id, []), key=lambda x: x[0])

            # Add gaps: between consecutive matches
            for i in range(len(field_occ) - 1):
                gap_start = field_occ[i][1]
                gap_end = field_occ[i + 1][0]
                needed = timedelta(minutes=duration + transition)

                if gap_end - gap_start >= needed:
                    candidate = gap_start
                    if self._check_team_rest(candidate, duration, team_schedule, rest_time):
                        slots.append({
                            "field_id": field.id,
                            "field_name": field.name,
                            "start_time": candidate.isoformat(),
                            "reason": f"Créneau libre sur {field.name}",
                        })
                        if len(slots) >= 3:
                            return slots

            # After last match on this field
            if field_occ:
                after_last = field_occ[-1][1]
                if self._check_team_rest(after_last, duration, team_schedule, rest_time):
                    slots.append({
                        "field_id": field.id,
                        "field_name": field.name,
                        "start_time": after_last.isoformat(),
                        "reason": f"Après le dernier match sur {field.name}",
                    })
                    if len(slots) >= 3:
                        return slots

        return slots

    @staticmethod
    def _check_team_rest(candidate_start, duration, team_schedule, rest_time):
        """Check that neither team has a conflict with the candidate slot."""
        candidate_end = candidate_start + timedelta(minutes=duration)
        for ts_start, ts_end in team_schedule:
            # Check overlap with rest buffer
            if candidate_start < ts_end + timedelta(minutes=rest_time) and \
               candidate_end + timedelta(minutes=rest_time) > ts_start:
                return False
        return True
