from django.contrib import admin

from .models import Subscription


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "plan", "status", "is_premium", "current_period_end")
    list_filter = ("plan", "status")
    search_fields = ("user__username", "user__email", "stripe_customer_id")
    readonly_fields = ("created_at", "updated_at")
