from django.contrib import admin

from .models import StripeEvent, Subscription, TournamentLicense


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "plan", "status", "is_premium", "is_club", "current_period_end")
    list_filter = ("plan", "status")
    search_fields = ("user__username", "user__email", "stripe_customer_id")
    readonly_fields = ("created_at", "updated_at")


@admin.register(TournamentLicense)
class TournamentLicenseAdmin(admin.ModelAdmin):
    list_display = ("tournament", "user", "is_active", "valid_from", "valid_until")
    list_filter = ("is_active",)
    search_fields = ("user__username", "tournament__name", "stripe_payment_intent_id")
    readonly_fields = ("created_at", "updated_at")


@admin.register(StripeEvent)
class StripeEventAdmin(admin.ModelAdmin):
    list_display = ("event_id", "event_type", "processed_at")
    search_fields = ("event_id", "event_type")
    readonly_fields = ("event_id", "event_type", "processed_at")
