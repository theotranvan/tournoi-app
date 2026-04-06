from django.contrib import admin

from apps.matches.models import Goal, Match


class GoalInline(admin.TabularInline):
    model = Goal
    extra = 0


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = (
        "__str__",
        "category",
        "phase",
        "field",
        "start_time",
        "status",
        "score_home",
        "score_away",
    )
    list_filter = ("tournament", "category", "phase", "status", "field")
    search_fields = ("team_home__name", "team_away__name")
    inlines = [GoalInline]


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ("match", "team", "player_name", "minute")
    list_filter = ("match__tournament",)
