"""Club history — aggregate stats across multiple tournament editions."""

from collections import Counter, defaultdict

from django.db.models import Count, Q, Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.clubs.models import Club
from apps.matches.models import Match
from apps.tournaments.models import Tournament


class ClubHistoryView(APIView):
    """GET /api/v1/clubs/{id}/history/

    Return historical stats for all tournaments of a club.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, club_id):
        club = Club.objects.get(pk=club_id)

        # Verify access
        user = request.user
        if club.owner_id != user.id and not club.members.filter(id=user.id).exists():
            return Response({"error": "forbidden"}, status=403)

        tournaments = (
            Tournament.objects.filter(club=club)
            .exclude(status="archived")
            .annotate(
                nb_teams=Count("teams", distinct=True),
                nb_matches=Count("matches", distinct=True),
                nb_finished=Count(
                    "matches",
                    filter=Q(matches__status="finished"),
                    distinct=True,
                ),
                total_goals=Sum(
                    "matches__score_home",
                    filter=Q(matches__status="finished"),
                )
            )
            .order_by("-start_date")
        )

        # Timeline
        timeline = []
        for t in tournaments:
            timeline.append({
                "id": str(t.id),
                "name": t.name,
                "slug": t.slug,
                "status": t.status,
                "start_date": t.start_date.isoformat(),
                "end_date": t.end_date.isoformat(),
                "nb_teams": t.nb_teams,
                "nb_matches": t.nb_matches,
                "nb_finished": t.nb_finished,
            })

        # Recurring teams across editions
        from apps.teams.models import Team

        all_teams = (
            Team.objects.filter(tournament__club=club)
            .exclude(tournament__status="archived")
            .values("name")
            .annotate(editions=Count("tournament", distinct=True))
            .order_by("-editions")[:20]
        )
        recurring_teams = [
            {"name": t["name"], "editions": t["editions"]}
            for t in all_teams
            if t["editions"] > 1
        ]

        # Aggregated stats
        total_tournaments = tournaments.count()
        total_teams = sum(t.nb_teams for t in tournaments)
        total_matches = sum(t.nb_matches for t in tournaments)

        # Year-over-year team count
        yearly_teams = defaultdict(int)
        for t in tournaments:
            year = t.start_date.year
            yearly_teams[year] += t.nb_teams

        return Response({
            "club": {"id": club.id, "name": club.name, "slug": club.slug},
            "timeline": timeline,
            "recurring_teams": recurring_teams,
            "stats": {
                "total_tournaments": total_tournaments,
                "total_teams": total_teams,
                "total_matches": total_matches,
            },
            "yearly_teams": [
                {"year": y, "teams": c}
                for y, c in sorted(yearly_teams.items())
            ],
        })
