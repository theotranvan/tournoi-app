from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.health import HealthDBView, HealthView

urlpatterns = [
    path("admin/", admin.site.urls),
    # OpenAPI schema & docs
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/v1/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    # Health
    path("api/v1/health/", HealthView.as_view(), name="health"),
    path("api/v1/health/db/", HealthDBView.as_view(), name="health-db"),
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
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
