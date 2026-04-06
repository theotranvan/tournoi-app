from django.conf import settings
from django.db import models


class Subscription(models.Model):
    """Tracks user subscriptions managed via Stripe."""

    class Plan(models.TextChoices):
        FREE = "free", "Gratuit"
        MONTHLY = "monthly", "Mensuel"
        YEARLY = "yearly", "Annuel"

    class Status(models.TextChoices):
        ACTIVE = "active", "Actif"
        PAST_DUE = "past_due", "En retard"
        CANCELED = "canceled", "Annulé"
        INCOMPLETE = "incomplete", "Incomplet"
        TRIALING = "trialing", "Essai"

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
        return self.plan in (self.Plan.MONTHLY, self.Plan.YEARLY) and self.status in (
            self.Status.ACTIVE,
            self.Status.TRIALING,
        )
