from django.urls import path

from apps.standings.views import CategoryStandingsView, GroupStandingsView, StandingsRefreshView

urlpatterns = [
    path(
        "categories/<int:category_id>/standings/",
        CategoryStandingsView.as_view(),
        name="category-standings",
    ),
    path(
        "categories/<int:category_id>/standings/refresh/",
        StandingsRefreshView.as_view(),
        name="standings-refresh",
    ),
    path(
        "groups/<int:group_id>/standings/",
        GroupStandingsView.as_view(),
        name="group-standings",
    ),
]
