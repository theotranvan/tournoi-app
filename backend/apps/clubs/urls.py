from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.clubs.fff_search import ClubSearchFFFView
from apps.clubs.history import ClubHistoryView
from apps.clubs.views import ClubViewSet

router = DefaultRouter()
router.register("", ClubViewSet, basename="clubs")

urlpatterns = [
    path("fff-search/", ClubSearchFFFView.as_view(), name="club-fff-search"),
    path("<int:club_id>/history/", ClubHistoryView.as_view(), name="club-history"),
] + router.urls
