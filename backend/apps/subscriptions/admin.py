from django.contrib import admin

from .models import Subscription, TournamentLicense


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "plan", "status", "is_premium", "is_club", "current_period_end")
    list_filter = ("plan", "status")
    search_fields = ("user__username", "user__email", "stripe_customer_id")
    readonly_fields = ("created_at", "updated_at")


@admin.register(TournamentLicense)
class TournamentLicenseAdmin(admin.ModelAdmin):
    list_display = ("tournament", "user", "is_active", "is_valid", "valid_from", "valid_until")
    list_filter = ("is_active",)
    search_fields = ("user__username", "tournament__name", "stripe_payment_intent_id")
    readonly_fields = ("created_at", "updated_at")
