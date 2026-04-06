from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.standings.services import compute_group_standings
from apps.teams.models import Group
from apps.tournaments.models import Category


class CategoryStandingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, category_id):
        category = Category.objects.select_related("tournament").get(pk=category_id)
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
        group = Group.objects.select_related("category").get(pk=group_id)
        standings = compute_group_standings(group.id)
        return Response(
            {
                "group": {"id": group.id, "name": group.name},
                "standings": standings,
            }
        )


class StandingsRefreshView(APIView):
    """Force-refresh standings for a category (clears cache)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, category_id):
        from apps.standings.services import invalidate_category_standings

        category = Category.objects.select_related("tournament").get(pk=category_id)
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
