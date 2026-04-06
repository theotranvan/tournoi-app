from rest_framework.routers import DefaultRouter

from apps.matches.views import MatchViewSet

match_router = DefaultRouter()
match_router.register("", MatchViewSet, basename="matches")

urlpatterns = []

# Registered via tournament urls: /tournaments/{id}/matches/
