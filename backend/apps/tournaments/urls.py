from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.matches.postpone import PostponeMatchView
from apps.matches.views import MatchViewSet
from apps.scheduling.views import AutoGeneratePoolsView, GenerateFinalsView
from apps.teams.views import GroupViewSet, TeamViewSet
from apps.tournaments.insights import TournamentInsightsView
from apps.tournaments.views import (
    CategoryViewSet,
    DayViewSet,
    FieldViewSet,
    SchedulingConstraintViewSet,
    TournamentViewSet,
)

router = DefaultRouter()
router.register("", TournamentViewSet, basename="tournaments")

# Nested routes for tournament sub-resources
category_router = DefaultRouter()
category_router.register("", CategoryViewSet, basename="categories")

field_router = DefaultRouter()
field_router.register("", FieldViewSet, basename="fields")

constraint_router = DefaultRouter()
constraint_router.register("", SchedulingConstraintViewSet, basename="constraints")

team_router = DefaultRouter()
team_router.register("", TeamViewSet, basename="teams")

match_router = DefaultRouter()
match_router.register("", MatchViewSet, basename="matches")

group_router = DefaultRouter()
group_router.register("", GroupViewSet, basename="groups")

day_router = DefaultRouter()
day_router.register("", DayViewSet, basename="days")

urlpatterns = [
    # Nested under tournaments/{id}/
    path(
        "<uuid:tournament_id>/categories/",
        include(category_router.urls),
    ),
    path(
        "<uuid:tournament_id>/fields/",
        include(field_router.urls),
    ),
    path(
        "<uuid:tournament_id>/constraints/",
        include(constraint_router.urls),
    ),
    path(
        "<uuid:tournament_id>/teams/",
        include(team_router.urls),
    ),
    path(
        "<uuid:tournament_id>/matches/",
        include(match_router.urls),
    ),
    path(
        "<uuid:tournament_id>/matches/<uuid:match_id>/postpone/",
        PostponeMatchView.as_view(),
        name="match-postpone",
    ),
    path(
        "<uuid:tournament_id>/schedule/",
        include("apps.scheduling.urls"),
    ),
    path(
        "<uuid:tournament_id>/insights/",
        TournamentInsightsView.as_view(),
        name="tournament-insights",
    ),
    # Nested under tournaments/{id}/categories/{id}/groups/
    path(
        "<uuid:tournament_id>/categories/<int:category_id>/groups/",
        include(group_router.urls),
    ),
    # Auto-generate pools & finals
    path(
        "<uuid:tournament_id>/categories/<int:category_id>/auto-pools/",
        AutoGeneratePoolsView.as_view(),
        name="category-auto-pools",
    ),
    path(
        "<uuid:tournament_id>/categories/<int:category_id>/finals/",
        GenerateFinalsView.as_view(),
        name="category-generate-finals",
    ),
    # Days CRUD
    path(
        "<uuid:tournament_id>/days/",
        include(day_router.urls),
    ),
    # Tournament CRUD + actions
    path("", include(router.urls)),
]
