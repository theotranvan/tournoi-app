from django.contrib import admin

from apps.tournaments.models import Category, Field, SchedulingConstraint, Tournament


class CategoryInline(admin.TabularInline):
    model = Category
    extra = 0


class FieldInline(admin.TabularInline):
    model = Field
    extra = 0


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ("name", "club", "status", "start_date", "end_date")
    list_filter = ("status", "club")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [CategoryInline, FieldInline]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "tournament", "display_order", "players_per_team")
    list_filter = ("tournament",)


@admin.register(Field)
class FieldAdmin(admin.ModelAdmin):
    list_display = ("name", "tournament", "display_order", "is_active")
    list_filter = ("tournament", "is_active")


@admin.register(SchedulingConstraint)
class SchedulingConstraintAdmin(admin.ModelAdmin):
    list_display = ("name", "tournament", "constraint_type", "is_hard")
    list_filter = ("tournament", "constraint_type", "is_hard")
