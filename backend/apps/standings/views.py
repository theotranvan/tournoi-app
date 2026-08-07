from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.accounts.authentication import TeamAnonymousUser
from apps.core.permissions import IsOrganizer
from apps.standings.services import compute_group_standings
from apps.teams.models import Group
from apps.tournaments.models import Category
from apps.tournaments.views import _check_tournament_access


def _assert_can_read_standings(user, tournament):
    """Readable by the tournament's organizer (owner/member) or a team member of
    the same tournament (coach). This scopes the endpoint to the requester's own
    tournament without locking coaches out — team tokens were allowed before."""
    if isinstance(user, TeamAnonymousUser):
        if str(user.tournament_id) != str(tournament.id):
            raise PermissionDenied("Vous n'avez pas accès à ce tournoi.")
        return
    _check_tournament_access(user, tournament)


class CategoryStandingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, category_id):
        category = get_object_or_404(Category.objects.select_related("tournament__club"), pk=category_id)
        _assert_can_read_standings(request.user, category.tournament)
        groups = Group.objects.filter(category=category).order_by("display_order")
        result = {
            "category": {"id": category.id, "name": category.name},
            "groups": [],
        }
        for group in groups:
            standings = compute_group_standings(group.id)
            result["groups"].append(
                {
                    "group": {"id": group.id, "name": group.name},
                    "standings": standings,
                }
            )
        return Response(result)


class GroupStandingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        group = get_object_or_404(Group.objects.select_related("category__tournament__club"), pk=group_id)
        _assert_can_read_standings(request.user, group.category.tournament)
        standings = compute_group_standings(group.id)
        return Response(
            {
                "group": {"id": group.id, "name": group.name},
                "standings": standings,
            }
        )


class StandingsRefreshThrottle(UserRateThrottle):
    scope = "standings_refresh"
    rate = "12/minute"


class StandingsRefreshView(APIView):
    """Force-refresh standings for a category (clears cache)."""

    permission_classes = [IsAuthenticated, IsOrganizer]
    throttle_classes = [StandingsRefreshThrottle]

    def post(self, request, category_id):
        from apps.standings.services import invalidate_category_standings

        category = get_object_or_404(Category.objects.select_related("tournament__club"), pk=category_id)
        _check_tournament_access(request.user, category.tournament)
        invalidate_category_standings(category.id)

        groups = Group.objects.filter(category=category).order_by("display_order")
        result = {
            "category": {"id": category.id, "name": category.name},
            "groups": [],
        }
        for group in groups:
            standings = compute_group_standings(group.id, bypass_cache=True)
            result["groups"].append(
                {
                    "group": {"id": group.id, "name": group.name},
                    "standings": standings,
                }
            )
        return Response(result)
