from rest_framework.routers import DefaultRouter

from apps.teams.views import GroupViewSet, TeamViewSet

team_router = DefaultRouter()
team_router.register("", TeamViewSet, basename="teams")

group_router = DefaultRouter()
group_router.register("", GroupViewSet, basename="groups")

urlpatterns = []

# These are registered via tournament urls and category urls
# Tournament nested: /tournaments/{id}/teams/
# Category nested: /categories/{id}/groups/
