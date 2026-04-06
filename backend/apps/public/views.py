from django.db.models import Q
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.matches.models import Match
from apps.matches.serializers import MatchDetailSerializer, MatchListSerializer
from apps.standings.services import compute_group_standings
from apps.teams.models import Team
from apps.teams.serializers import TeamBriefSerializer
from apps.tournaments.models import Tournament


class PublicTournamentView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        tournament = get_object_or_404(
            Tournament.objects.filter(is_public=True), slug=slug
        )
        categories = tournament.categories.all()
        return Response(
            {
                "id": str(tournament.id),
                "name": tournament.name,
                "slug": tournament.slug,
                "location": tournament.location,
                "start_date": tournament.start_date.isoformat(),
                "end_date": tournament.end_date.isoformat(),
                "description": tournament.description,
                "status": tournament.status,
                "cover_image": tournament.cover_image.url if tournament.cover_image else None,
                "categories": [
                    {"id": c.id, "name": c.name, "color": c.color}
                    for c in categories
                ],
            }
        )


class PublicCategoriesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        tournament = get_object_or_404(
            Tournament.objects.filter(is_public=True), slug=slug
        )
        categories = tournament.categories.all()
        return Response(
            [
                {
                    "id": c.id,
                    "name": c.name,
                    "color": c.color,
                    "players_per_team": c.players_per_team,
                }
                for c in categories
            ]
        )


class PublicMatchesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        tournament = get_object_or_404(
            Tournament.objects.filter(is_public=True), slug=slug
        )
        qs = Match.objects.filter(tournament=tournament).select_related(
            "category", "group", "field", "team_home", "team_away"
        )
        # Filters
        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        date = request.query_params.get("date")
        if date:
            qs = qs.filter(start_time__date=date)
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(MatchListSerializer(qs[:200], many=True).data)


class PublicStandingsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        tournament = get_object_or_404(
            Tournament.objects.filter(is_public=True), slug=slug
        )
        result = []
        for category in tournament.categories.order_by("display_order"):
            groups_data = []
            for group in category.groups.order_by("display_order"):
                standings = compute_group_standings(group.id)
                groups_data.append(
                    {
                        "group": {"id": group.id, "name": group.name},
                        "standings": standings,
                    }
                )
            result.append(
                {
                    "category": {"id": category.id, "name": category.name},
                    "groups": groups_data,
                }
            )
        return Response(result)


class PublicTeamView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug, team_id):
        tournament = get_object_or_404(
            Tournament.objects.filter(is_public=True), slug=slug
        )
        team = get_object_or_404(Team, pk=team_id, tournament=tournament)
        matches = Match.objects.filter(
            Q(team_home=team) | Q(team_away=team)
        ).select_related("category", "field", "team_home", "team_away").order_by("start_time")

        return Response(
            {
                "team": TeamBriefSerializer(team).data,
                "matches": MatchListSerializer(matches, many=True).data,
            }
        )


class PublicLiveView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        tournament = get_object_or_404(
            Tournament.objects.filter(is_public=True), slug=slug
        )
        base_qs = Match.objects.filter(tournament=tournament).select_related(
            "category", "group", "field", "team_home", "team_away"
        )

        live = base_qs.filter(status=Match.Status.LIVE)
        upcoming = base_qs.filter(status=Match.Status.SCHEDULED).order_by("start_time")[:10]
        recent = base_qs.filter(status=Match.Status.FINISHED).order_by("-start_time")[:10]

        return Response(
            {
                "live_matches": MatchListSerializer(live, many=True).data,
                "upcoming_matches": MatchListSerializer(upcoming, many=True).data,
                "recent_results": MatchListSerializer(recent, many=True).data,
            }
        )


class PublicMatchDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug, match_id):
        tournament = get_object_or_404(
            Tournament.objects.filter(is_public=True), slug=slug
        )
        match = get_object_or_404(
            Match.objects.filter(tournament=tournament).select_related(
                "category", "group", "field", "team_home", "team_away"
            ).prefetch_related("goals"),
            pk=match_id,
        )
        return Response(MatchDetailSerializer(match).data)


class HealthCheckView(APIView):
    """Lightweight health check for Docker / load balancer probes."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        from django.db import connection

        connection.ensure_connection()
        return Response({"status": "ok"})
