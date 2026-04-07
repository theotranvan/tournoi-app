from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.core.health import (
    HealthCeleryView,
    HealthDBView,
    HealthFullView,
    HealthRedisView,
    HealthView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    # Health
    path("api/v1/health/", HealthView.as_view(), name="health"),
    path("api/v1/health/db/", HealthDBView.as_view(), name="health-db"),
    path("api/v1/health/redis/", HealthRedisView.as_view(), name="health-redis"),
    path("api/v1/health/celery/", HealthCeleryView.as_view(), name="health-celery"),
    path("api/v1/health/full/", HealthFullView.as_view(), name="health-full"),
    # Auth
    path("api/v1/auth/", include("apps.accounts.urls")),
    # Clubs
    path("api/v1/clubs/", include("apps.clubs.urls")),
    # Tournaments (includes nested categories, fields, constraints, teams, matches)
    path("api/v1/tournaments/", include("apps.tournaments.urls")),
    # Standalone category/group/match endpoints (for direct access by ID)
    path("api/v1/", include("apps.standings.urls")),
    # Public API
    path("api/v1/public/", include("apps.public.urls")),
    # Notifications
    path("api/v1/", include("apps.notifications.urls")),
    # Subscriptions
    path("api/v1/subscriptions/", include("apps.subscriptions.urls")),
]

# OpenAPI schema & Swagger docs — only in DEBUG mode
if settings.DEBUG:
    from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

    urlpatterns += [
        path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
        path(
            "api/v1/docs/",
            SpectacularSwaggerView.as_view(url_name="schema"),
            name="swagger-ui",
        ),
    ]

if settings.DEBUG:
    from apps.core.debug import DebugCeleryQueueView, DebugWSGroupsView

    urlpatterns += [
        path("api/v1/debug/ws-groups/", DebugWSGroupsView.as_view(), name="debug-ws-groups"),
        path("api/v1/debug/celery-queue/", DebugCeleryQueueView.as_view(), name="debug-celery-queue"),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
