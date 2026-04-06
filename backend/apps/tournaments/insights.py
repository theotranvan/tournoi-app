"""Tournament Insights — analytics computed from existing match data."""

from collections import Counter, defaultdict

from django.db.models import Avg, Count, F, Q, Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsOrganizer
from apps.matches.models import Goal, Match
from apps.tournaments.models import Tournament
from apps.tournaments.views import _get_tournament_for_nested


class TournamentInsightsView(APIView):
    """GET /api/v1/tournaments/{id}/insights/

    Return analytics and stats computed from finished matches.
    """

    permission_classes = [IsAuthenticated, IsOrganizer]

    def get(self, request, tournament_id):
        tournament = _get_tournament_for_nested(
            {"tournament_id": tournament_id}, request.user,
        )

        finished = Match.objects.filter(
            tournament=tournament, status=Match.Status.FINISHED,
        ).select_related("team_home", "team_away", "field", "category")

        total_finished = finished.count()
        if total_finished == 0:
            return Response({
                "total_matches_played": 0,
                "total_goals": 0,
                "insights": [],
            })

        # ── Basic aggregates ─────────────────────────
        total_goals = (
            finished.aggregate(
                t=Sum(F("score_home") + F("score_away"))
            )["t"]
            or 0
        )

        avg_goals = round(total_goals / total_finished, 2) if total_finished else 0

        # ── Best attack (most goals scored) ──────────
        team_goals_for: Counter[str] = Counter()
        team_goals_against: Counter[str] = Counter()
        team_ids_map: dict[str, int] = {}

        for m in finished:
            if m.team_home and m.score_home is not None:
                team_goals_for[m.team_home.name] += m.score_home
                team_goals_against[m.team_home.name] += m.score_away or 0
                team_ids_map[m.team_home.name] = m.team_home.id
            if m.team_away and m.score_away is not None:
                team_goals_for[m.team_away.name] += m.score_away
                team_goals_against[m.team_away.name] += m.score_home or 0
                team_ids_map[m.team_away.name] = m.team_away.id

        best_attack = team_goals_for.most_common(1)
        best_defense = (
            sorted(team_goals_against.items(), key=lambda x: x[1])[:1]
            if team_goals_against
            else []
        )

        # ── Tightest match ───────────────────────────
        tightest = None
        min_diff = float("inf")
        for m in finished:
            if m.score_home is not None and m.score_away is not None:
                diff = abs(m.score_home - m.score_away)
                total = m.score_home + m.score_away
                if diff < min_diff or (diff == min_diff and total > 0):
                    min_diff = diff
                    tightest = m

        # ── Top scorer ───────────────────────────────
        top_scorers = (
            Goal.objects.filter(match__tournament=tournament)
            .exclude(player_name="")
            .values("player_name")
            .annotate(goals=Count("id"))
            .order_by("-goals")[:5]
        )

        # ── Field utilization ────────────────────────
        all_scheduled = Match.objects.filter(tournament=tournament).exclude(
            status=Match.Status.CANCELLED
        )
        total_matches_all = all_scheduled.count()
        fields = tournament.fields.filter(is_active=True)
        field_match_count = (
            all_scheduled.values("field__name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        field_utilization = []
        for f in field_match_count:
            if f["field__name"]:
                pct = round(f["count"] / total_matches_all * 100, 1) if total_matches_all else 0
                field_utilization.append({
                    "field": f["field__name"],
                    "matches": f["count"],
                    "utilization_pct": pct,
                })

        # ── Average match duration (actual) ──────────
        avg_duration = finished.aggregate(avg=Avg("duration_minutes"))["avg"]

        # ── Build insights list ──────────────────────
        insights = []

        if best_attack:
            name, goals = best_attack[0]
            insights.append({
                "type": "best_attack",
                "icon": "⚽",
                "label": "Meilleure attaque",
                "value": f"{name} ({goals} buts)",
                "team_id": team_ids_map.get(name),
            })

        if best_defense:
            name, conceded = best_defense[0]
            insights.append({
                "type": "best_defense",
                "icon": "🛡️",
                "label": "Meilleure défense",
                "value": f"{name} ({conceded} buts encaissés)",
                "team_id": team_ids_map.get(name),
            })

        if tightest:
            insights.append({
                "type": "tightest_match",
                "icon": "🔥",
                "label": "Match le plus serré",
                "value": (
                    f"{tightest.team_home.name if tightest.team_home else '?'} "
                    f"{tightest.score_home}-{tightest.score_away} "
                    f"{tightest.team_away.name if tightest.team_away else '?'}"
                ),
                "match_id": str(tightest.id),
            })

        if top_scorers:
            top = top_scorers[0]
            insights.append({
                "type": "top_scorer",
                "icon": "👟",
                "label": "Meilleur buteur",
                "value": f"{top['player_name']} ({top['goals']} buts)",
            })

        insights.append({
            "type": "avg_goals",
            "icon": "📊",
            "label": "Moyenne de buts par match",
            "value": str(avg_goals),
        })

        if avg_duration:
            insights.append({
                "type": "avg_duration",
                "icon": "⏱️",
                "label": "Durée moyenne par match",
                "value": f"{round(avg_duration)} min",
            })

        return Response({
            "total_matches_played": total_finished,
            "total_goals": total_goals,
            "avg_goals_per_match": avg_goals,
            "insights": insights,
            "top_scorers": list(top_scorers),
            "field_utilization": field_utilization,
        })
