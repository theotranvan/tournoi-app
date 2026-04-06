from django.contrib import admin

from apps.clubs.models import Club


@admin.register(Club)
class ClubAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "owner", "created_at")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
