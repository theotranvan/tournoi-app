import re
import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify

from apps.clubs.models import Club

_TIME_RE = re.compile(r"^\d{2}:\d{2}$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_availability(value: list) -> None:
    """Validate Field.availability JSON structure.

    Expected: list of dicts with keys 'date' (YYYY-MM-DD), 'start' (HH:MM), 'end' (HH:MM).
    """
    if not isinstance(value, list):
        raise ValidationError("La disponibilité doit être une liste.")
    for i, slot in enumerate(value):
        if not isinstance(slot, dict):
            raise ValidationError(f"Slot {i}: doit être un objet.")
        missing = {"date", "start", "end"} - set(slot.keys())
        if missing:
            raise ValidationError(f"Slot {i}: clés manquantes {missing}.")
        if not isinstance(slot["date"], str) or not _DATE_RE.match(slot["date"]):
            raise ValidationError(f"Slot {i}: 'date' doit être au format YYYY-MM-DD.")
        if not isinstance(slot["start"], str) or not _TIME_RE.match(slot["start"]):
            raise ValidationError(f"Slot {i}: 'start' doit être au format HH:MM.")
        if not isinstance(slot["end"], str) or not _TIME_RE.match(slot["end"]):
            raise ValidationError(f"Slot {i}: 'end' doit être au format HH:MM.")
        if slot["start"] >= slot["end"]:
            raise ValidationError(f"Slot {i}: 'start' doit être avant 'end'.")


class Tournament(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        PUBLISHED = "published", "Publié"
        LIVE = "live", "En cours"
        FINISHED = "finished", "Terminé"
        ARCHIVED = "archived", "Archivé"

    class PhaseSeparationMode(models.TextChoices):
        NONE = "none", "Aucune séparation — tout dans l'ordre naturel"
        SAME_DAY_REST = "same_day_rest", "Même jour avec repos minimum augmenté"
        NEXT_DAY = "next_day", "Phases finales au jour suivant"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name="tournaments")
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, max_length=220)
    location = models.CharField(max_length=300)
    start_date = models.DateField()
    end_date = models.DateField()
    description = models.TextField(blank=True)
    rules = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="tournaments/", null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    is_public = models.BooleanField(default=True)

    # Paramètres de planification par défaut (surchargés par Category si besoin)
    default_match_duration = models.PositiveIntegerField(
        default=15, help_text="Durée d'un match en minutes"
    )
    default_transition_time = models.PositiveIntegerField(
        default=5, help_text="Temps de transition entre deux matchs en minutes"
    )
    default_rest_time = models.PositiveIntegerField(
        default=20,
        help_text="Repos minimum entre deux matchs d'une même équipe en minutes",
    )

    phase_separation_mode = models.CharField(
        max_length=20,
        choices=PhaseSeparationMode.choices,
        default=PhaseSeparationMode.SAME_DAY_REST,
        help_text="Comment séparer les phases de poules des phases finales",
    )
    knockout_rest_multiplier = models.PositiveIntegerField(
        default=3,
        help_text="Multiplicateur de repos entre dernière poule et première phase finale",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["club", "status"]),
            models.Index(fields=["slug"]),
        ]
        ordering = ["-start_date"]

    def clean(self):
        super().clean()
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValidationError(
                {"end_date": "La date de fin doit être postérieure à la date de début."}
            )

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.name}-{self.start_date.year}")
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.start_date})"


class Category(models.Model):
    """Catégorie d'âge : U8, U10, U13, Senior, etc."""

    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="categories"
    )
    name = models.CharField(max_length=50)
    display_order = models.PositiveIntegerField(default=0)
    color = models.CharField(max_length=7, default="#3b82f6")

    # Surcharges de planification
    match_duration = models.PositiveIntegerField(null=True, blank=True)
    transition_time = models.PositiveIntegerField(null=True, blank=True)
    rest_time = models.PositiveIntegerField(null=True, blank=True)

    # Règles métier
    players_per_team = models.PositiveIntegerField(default=7)
    points_win = models.PositiveIntegerField(default=3)
    points_draw = models.PositiveIntegerField(default=1)
    points_loss = models.PositiveIntegerField(default=0)

    # Contraintes horaires spécifiques
    allowed_days = models.JSONField(
        default=list,
        blank=True,
        help_text="Liste de dates ISO où cette catégorie peut jouer. Vide = toutes.",
    )
    earliest_start = models.TimeField(null=True, blank=True)
    latest_end = models.TimeField(null=True, blank=True)

    class Meta:
        ordering = ["display_order", "name"]
        unique_together = ("tournament", "name")

    def clean(self):
        super().clean()
        if self.earliest_start and self.latest_end and self.earliest_start >= self.latest_end:
            raise ValidationError(
                {"latest_end": "L'heure de fin doit être postérieure à l'heure de début."}
            )

    def __str__(self) -> str:
        return f"{self.tournament.name} - {self.name}"

    @property
    def effective_match_duration(self) -> int:
        return self.match_duration or self.tournament.default_match_duration

    @property
    def effective_transition_time(self) -> int:
        return self.transition_time or self.tournament.default_transition_time

    @property
    def effective_rest_time(self) -> int:
        return self.rest_time or self.tournament.default_rest_time


class Field(models.Model):
    """Terrain physique."""

    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="fields"
    )
    name = models.CharField(max_length=50)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    # Disponibilité par jour, format:
    # [{"date": "2026-04-11", "start": "08:00", "end": "19:00"}, ...]
    availability = models.JSONField(default=list, validators=[validate_availability])

    class Meta:
        ordering = ["display_order", "name"]
        unique_together = ("tournament", "name")

    def clean(self) -> None:
        super().clean()
        validate_availability(self.availability)

    def __str__(self) -> str:
        return f"{self.tournament.name} - {self.name}"


class SchedulingConstraint(models.Model):
    """Contrainte métier ajoutée par l'admin (ex: finale U13 après 16h)."""

    class ConstraintType(models.TextChoices):
        EARLIEST_TIME = "earliest_time", "Heure minimum"
        LATEST_TIME = "latest_time", "Heure maximum"
        REQUIRED_FIELD = "required_field", "Terrain imposé"
        BLOCKED_SLOT = "blocked_slot", "Créneau bloqué"
        CATEGORY_DAY = "category_day", "Catégorie sur jour précis"

    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="constraints"
    )
    name = models.CharField(max_length=200)
    constraint_type = models.CharField(max_length=30, choices=ConstraintType.choices)
    payload = models.JSONField(
        help_text="Structure dépend du type. Voir SCHEDULING_ENGINE_SPEC.md"
    )
    is_hard = models.BooleanField(
        default=True,
        help_text="True = contrainte obligatoire, False = préférence",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.tournament.name} - {self.name}"
