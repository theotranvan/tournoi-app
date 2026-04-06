from rest_framework.routers import DefaultRouter

from apps.clubs.views import ClubViewSet

router = DefaultRouter()
router.register("", ClubViewSet, basename="clubs")

urlpatterns = router.urls
