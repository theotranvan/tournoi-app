import uuid

from django.core.exceptions import ValidationError
from django.db import models

from apps.accounts.models import User
from apps.realtime.mixins import TrackChangesMixin
from apps.teams.models import Group, Team
from apps.tournaments.models import Category, Field, Tournament


class Match(TrackChangesMixin, models.Model):
    _tracked_fields = ("status", "score_home", "score_away", "penalty_score_home", "penalty_score_away")
    class Phase(models.TextChoices):
        GROUP = "group", "Phase de poules"
        ROUND_OF_16 = "r16", "8èmes de finale"
        QUARTER = "quarter", "Quart de finale"
        SEMI = "semi", "Demi-finale"
        THIRD_PLACE = "third", "Petite finale"
        FINAL = "final", "Finale"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Programmé"
        LIVE = "live", "En direct"
        FINISHED = "finished", "Terminé"
        CANCELLED = "cancelled", "Annulé"
        POSTPONED = "postponed", "Reporté"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="matches"
    )
    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name="matches"
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matches",
    )
    phase = models.CharField(max_length=20, choices=Phase.choices, default=Phase.GROUP)

    team_home = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="home_matches",
        null=True,
        blank=True,
    )
    team_away = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="away_matches",
        null=True,
        blank=True,
    )

    # Placeholders pour phases finales avant que les équipes soient connues
    placeholder_home = models.CharField(
        max_length=100, blank=True, help_text="ex: '1er Poule A'"
    )
    placeholder_away = models.CharField(max_length=100, blank=True)

    # Source match references for bracket propagation (from store.js approach)
    source_home = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="next_home_matches",
        help_text="Match source pour l'équipe domicile (ex: demi-finale)",
    )
    source_away = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="next_away_matches",
        help_text="Match source pour l'équipe extérieur",
    )
    source_home_type = models.CharField(
        max_length=10, blank=True,
        help_text="'winner' ou 'loser' du match source_home",
    )
    source_away_type = models.CharField(
        max_length=10, blank=True,
        help_text="'winner' ou 'loser' du match source_away",
    )

    # Day reference for slot-based scheduling
    day = models.ForeignKey(
        "tournaments.Day", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="matches",
    )
    slot_index = models.IntegerField(
        null=True, blank=True,
        help_text="Index du créneau global (pour tri chronologique)",
    )

    field = models.ForeignKey(
        Field, on_delete=models.SET_NULL, null=True, related_name="matches"
    )
    start_time = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=15)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.SCHEDULED
    )
    score_home = models.PositiveIntegerField(null=True, blank=True)
    score_away = models.PositiveIntegerField(null=True, blank=True)

    penalty_score_home = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Tirs au but domicile (phases finales uniquement)",
    )
    penalty_score_away = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Tirs au but extérieur (phases finales uniquement)",
    )

    score_entered_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    score_validated = models.BooleanField(default=False)

    is_locked = models.BooleanField(
        default=False,
        help_text="Si True, le moteur ne touche pas à ce match lors d'un recalcul",
    )

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["tournament", "start_time"]),
            models.Index(fields=["field", "start_time"]),
            models.Index(fields=["status"]),
            models.Index(fields=["category", "phase"]),
        ]
        ordering = ["start_time"]

    def clean(self):
        super().clean()
        errors = {}

        # Au moins des équipes ou des placeholders
        if not self.team_home and not self.placeholder_home and not self.team_away and not self.placeholder_away:
            errors["team_home"] = "Un match doit avoir des équipes ou des placeholders."

        # Cohérence catégorie ↔ équipes
        if self.team_home and self.team_home.category_id != self.category_id:
            errors["team_home"] = "L'équipe domicile n'appartient pas à cette catégorie."
        if self.team_away and self.team_away.category_id != self.category_id:
            errors["team_away"] = "L'équipe extérieure n'appartient pas à cette catégorie."

        # Cohérence group ↔ category
        if self.group and self.group.category_id != self.category_id:
            errors["group"] = "La poule n'appartient pas à cette catégorie."

        # Cohérence field ↔ tournament
        if self.field and self.field.tournament_id != self.tournament_id:
            errors["field"] = "Le terrain n'appartient pas à ce tournoi."

        # Status FINISHED → scores obligatoires
        if self.status == self.Status.FINISHED:
            if self.score_home is None:
                errors["score_home"] = "Le score domicile est requis pour un match terminé."
            if self.score_away is None:
                errors["score_away"] = "Le score extérieur est requis pour un match terminé."

        # Penalties: interdit en phase de poules
        has_pen = self.penalty_score_home is not None or self.penalty_score_away is not None
        if has_pen and self.phase == self.Phase.GROUP:
            errors["penalty_score_home"] = "Les tirs au but ne sont pas autorisés en phase de poules."

        # Penalties must come in pairs
        if (self.penalty_score_home is None) != (self.penalty_score_away is None):
            errors["penalty_score_away"] = "Les deux scores de tirs au but doivent être renseignés."

        # Penalties only valid when regular scores are tied
        if (
            has_pen
            and self.score_home is not None
            and self.score_away is not None
            and self.score_home != self.score_away
        ):
            errors["penalty_score_home"] = "Les tirs au but ne sont possibles qu'en cas d'égalité."

        # Penalties must not also be a draw
        if (
            self.penalty_score_home is not None
            and self.penalty_score_away is not None
            and self.penalty_score_home == self.penalty_score_away
        ):
            errors["penalty_score_away"] = "Les tirs au but ne peuvent pas être à égalité."

        if errors:
            raise ValidationError(errors)

    @property
    def display_home(self) -> str:
        return self.team_home.name if self.team_home else self.placeholder_home

    @property
    def display_away(self) -> str:
        return self.team_away.name if self.team_away else self.placeholder_away

    def __str__(self) -> str:
        return f"{self.display_home} vs {self.display_away} @ {self.start_time}"


class Goal(models.Model):
    """Buteur — optionnel selon config tournoi."""

    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="goals")
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    player_name = models.CharField(max_length=200, blank=True)
    minute = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["minute", "created_at"]
