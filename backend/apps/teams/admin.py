from django.contrib import admin

from apps.teams.models import Group, Team


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "tournament", "coach_name", "access_code")
    list_filter = ("tournament", "category")
    search_fields = ("name", "coach_name", "access_code")
    readonly_fields = ("access_code",)


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "display_order")
    list_filter = ("category__tournament", "category")
    filter_horizontal = ("teams",)
