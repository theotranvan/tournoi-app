import uuid

from django.conf import settings
from django.db import models


class PushSubscription(models.Model):
    """Browser push subscription (Web Push API).

    Supports both real User (admin) and Team (coach) subscriptions.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="push_subscriptions",
    )
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="push_subscriptions",
    )
    endpoint = models.URLField(max_length=1000, unique=True)
    p256dh_key = models.CharField(max_length=200)
    auth_key = models.CharField(max_length=100)
    user_agent = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Push({self.user}) → {self.endpoint[:60]}…"


class Notification(models.Model):
    """In-app notification for admins and coaches."""

    class Type(models.TextChoices):
        MATCH_STARTED = "match_started", "Match démarré"
        MATCH_FINISHED = "match_finished", "Match terminé"
        SCORE_UPDATED = "score_updated", "Score mis à jour"
        PLANNING_GENERATED = "planning_generated", "Planning généré"
        FIELD_CHANGE = "field_change", "Changement de terrain"
        TOURNAMENT_PUBLISHED = "tournament_published", "Tournoi publié"

    class Target(models.TextChoices):
        ADMIN = "admin", "Admin"
        COACH = "coach", "Coach"
        ALL = "all", "Tous"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=30, choices=Type.choices)
    target = models.CharField(max_length=10, choices=Target.choices, default=Target.ALL)

    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default="")
    link = models.CharField(max_length=500, blank=True, default="")

    # Optional FK references (nullable for flexibility)
    tournament = models.ForeignKey(
        "tournaments.Tournament",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
    )
    match = models.ForeignKey(
        "matches.Match",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
    )
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
    )

    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["tournament", "target", "-created_at"]),
        ]

    def __str__(self):
        return f"[{self.type}] {self.title}"
