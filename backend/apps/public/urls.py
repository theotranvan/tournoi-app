from django.urls import path

from apps.public.views import (
    PublicCategoriesView,
    PublicLiveView,
    PublicMatchDetailView,
    PublicMatchesView,
    PublicStandingsView,
    PublicTeamView,
    PublicTournamentByCodeView,
    PublicTournamentView,
    HealthCheckView,
)

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="public-health"),
    path(
        "tournaments/by-code/<str:code>/",
        PublicTournamentByCodeView.as_view(),
        name="public-tournament-by-code",
    ),
    path(
        "tournaments/<slug:slug>/",
        PublicTournamentView.as_view(),
        name="public-tournament",
    ),
    path(
        "tournaments/<slug:slug>/categories/",
        PublicCategoriesView.as_view(),
        name="public-categories",
    ),
    path(
        "tournaments/<slug:slug>/matches/",
        PublicMatchesView.as_view(),
        name="public-matches",
    ),
    path(
        "tournaments/<slug:slug>/standings/",
        PublicStandingsView.as_view(),
        name="public-standings",
    ),
    path(
        "tournaments/<slug:slug>/teams/<int:team_id>/",
        PublicTeamView.as_view(),
        name="public-team",
    ),
    path(
        "tournaments/<slug:slug>/live/",
        PublicLiveView.as_view(),
        name="public-live",
    ),
    path(
        "tournaments/<slug:slug>/matches/<uuid:match_id>/",
        PublicMatchDetailView.as_view(),
        name="public-match-detail",
    ),
]
