from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import NotificationViewSet, PushSubscribeView, PushUnsubscribeView, VapidPublicKeyView

router = DefaultRouter()
router.register(r"notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("", include(router.urls)),
    path("notifications/subscribe/", PushSubscribeView.as_view(), name="push-subscribe"),
    path("notifications/unsubscribe/", PushUnsubscribeView.as_view(), name="push-unsubscribe"),
    path("notifications/vapid-public-key/", VapidPublicKeyView.as_view(), name="vapid-public-key"),
]
