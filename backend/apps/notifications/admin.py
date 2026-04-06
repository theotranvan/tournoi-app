from django.contrib import admin
from .models import Notification, PushSubscription


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["title", "type", "target", "is_read", "created_at"]
    list_filter = ["type", "target", "is_read"]
    search_fields = ["title", "body"]
    readonly_fields = ["id", "created_at"]


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ["user", "team", "endpoint_short", "created_at"]
    list_filter = ["created_at"]
    readonly_fields = ["id", "created_at"]

    @admin.display(description="Endpoint")
    def endpoint_short(self, obj):
        return obj.endpoint[:60] + "…" if len(obj.endpoint) > 60 else obj.endpoint
