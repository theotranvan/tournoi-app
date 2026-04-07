import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Subscription(models.Model):
    """Tracks user CLUB subscriptions managed via Stripe."""

    class Plan(models.TextChoices):
        FREE = "free", "Gratuit"
        MONTHLY = "monthly", "Mensuel"          # kept for legacy rows
        YEARLY = "yearly", "Annuel"             # kept for legacy rows
        CLUB_MONTHLY = "club_monthly", "Club Mensuel"
        CLUB_YEARLY = "club_yearly", "Club Annuel"

    class Status(models.TextChoices):
        ACTIVE = "active", "Actif"
        PAST_DUE = "past_due", "En retard"
        CANCELED = "canceled", "Annulé"
        INCOMPLETE = "incomplete", "Incomplet"
        TRIALING = "trialing", "Essai"

    PREMIUM_PLANS = {Plan.MONTHLY, Plan.YEARLY, Plan.CLUB_MONTHLY, Plan.CLUB_YEARLY}
    CLUB_PLANS = {Plan.CLUB_MONTHLY, Plan.CLUB_YEARLY}

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    plan = models.CharField(max_length=20, choices=Plan.choices, default=Plan.FREE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    # Stripe references
    stripe_customer_id = models.CharField(max_length=255, blank=True, db_index=True)
    stripe_subscription_id = models.CharField(max_length=255, blank=True, db_index=True)

    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "subscriptions_subscription"

    def __str__(self) -> str:
        return f"{self.user.username} — {self.get_plan_display()} ({self.get_status_display()})"

    @property
    def is_premium(self) -> bool:
        return self.plan in self.PREMIUM_PLANS and self.status in (
            self.Status.ACTIVE,
            self.Status.TRIALING,
        )

    @property
    def is_club(self) -> bool:
        return self.plan in self.CLUB_PLANS and self.status in (
            self.Status.ACTIVE,
            self.Status.TRIALING,
        )


class TournamentLicense(models.Model):
    """ONE_SHOT license — paid per-tournament, 30 days before/after."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tournament_licenses",
    )
    tournament = models.OneToOneField(
        "tournaments.Tournament",
        on_delete=models.CASCADE,
        related_name="license",
    )

    # Stripe
    stripe_customer_id = models.CharField(max_length=255, blank=True, db_index=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, db_index=True)
    stripe_checkout_session_id = models.CharField(max_length=255, blank=True, db_index=True)

    # Validity window
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "subscriptions_tournamentlicense"

    def __str__(self) -> str:
        return f"License {self.tournament} — {'active' if self.is_active else 'inactive'}"

    @property
    def is_valid(self) -> bool:
        if not self.is_active:
            return False
        now = timezone.now()
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        return True
