from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["title", "type", "target", "is_read", "created_at"]
    list_filter = ["type", "target", "is_read"]
    search_fields = ["title", "body"]
    readonly_fields = ["id", "created_at"]
