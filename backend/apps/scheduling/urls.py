"""URL configuration for scheduling endpoints."""

from django.urls import path

from apps.scheduling.views import (
    GenerateScheduleView,
    RecalculateScheduleView,
    ResolveBracketsView,
    ScheduleConflictsView,
    ScheduleFeasibilityView,
    ScheduleListView,
    ScheduleTaskStatusView,
)

urlpatterns = [
    path("generate/", GenerateScheduleView.as_view(), name="schedule-generate"),
    path(
        "task/<str:task_id>/",
        ScheduleTaskStatusView.as_view(),
        name="schedule-task-status",
    ),
    path("", ScheduleListView.as_view(), name="schedule-list"),
    path(
        "recalculate/",
        RecalculateScheduleView.as_view(),
        name="schedule-recalculate",
    ),
    path(
        "conflicts/",
        ScheduleConflictsView.as_view(),
        name="schedule-conflicts",
    ),
    path(
        "feasibility/",
        ScheduleFeasibilityView.as_view(),
        name="schedule-feasibility",
    ),
    path(
        "resolve-brackets/",
        ResolveBracketsView.as_view(),
        name="schedule-resolve-brackets",
    ),
]
