import re
import secrets
import string
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


def _generate_public_code() -> str:
    """Generate a 6-character uppercase alphanumeric code."""
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(6))


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
    public_code = models.CharField(
        max_length=6,
        unique=True,
        null=True,
        blank=True,
        help_text="Code unique à 6 caractères pour l'accès spectateur",
    )
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

    class SchedulingMode(models.TextChoices):
        CATEGORY_BLOCK = "CATEGORY_BLOCK", "Par catégorie (une catégorie après l'autre)"
        INTERLEAVE = "INTERLEAVE", "Entrelacé (matchs de toutes catégories mélangés)"

    scheduling_mode = models.CharField(
        max_length=20,
        choices=SchedulingMode.choices,
        default=SchedulingMode.CATEGORY_BLOCK,
    )
    default_min_rest_matches = models.PositiveIntegerField(
        default=1,
        help_text="Nombre minimum de créneaux de repos entre deux matchs d'une même équipe",
    )
    max_consecutive_matches = models.PositiveIntegerField(
        default=2,
        help_text="Nombre maximum de matchs consécutifs pour une équipe",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["club", "status"]),
            models.Index(fields=["slug"]),
            models.Index(fields=["public_code"]),
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
            base_slug = slugify(f"{self.name}-{self.start_date.year}")
            slug = base_slug
            for i in range(1, 100):
                if not Tournament.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                    break
                slug = f"{base_slug}-{i}"
            self.slug = slug
        if not self.public_code:
            for _ in range(100):
                code = _generate_public_code()
                if not Tournament.objects.filter(public_code=code).exists():
                    self.public_code = code
                    break
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.start_date})"


class Category(models.Model):
    """Catégorie d'âge : U8, U10, U13, Senior, etc."""

    class FinalsFormat(models.TextChoices):
        TOP2_CROSSOVER = "TOP2_CROSSOVER", "1er vs 2e croisé (demi-finales)"
        TOP1_FINAL = "TOP1_FINAL", "1er de chaque poule en finale directe"

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

    # Slot-based rest (from store.js approach)
    min_rest_matches = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Nombre minimum de créneaux de repos (surcharge tournoi)",
    )
    max_consecutive_matches = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Nombre maximum de matchs consécutifs (surcharge tournoi)",
    )

    # Pool / Finals configuration
    number_of_pools = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Nombre de poules souhaité pour l'auto-génération",
    )
    finals_format = models.CharField(
        max_length=20,
        choices=FinalsFormat.choices,
        default=FinalsFormat.TOP2_CROSSOVER,
    )
    finals_same_day = models.BooleanField(
        default=True,
        help_text="Si True, les finales sont le même jour que les poules",
    )

    # Day assignment (from store.js)
    day = models.ForeignKey(
        "Day", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="categories",
        help_text="Jour assigné à cette catégorie (vide = répartition auto)",
    )

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


class Day(models.Model):
    """Journée de tournoi avec horaires et pause déjeuner."""

    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="days"
    )
    date = models.DateField()
    label = models.CharField(max_length=100, blank=True)
    start_time = models.CharField(
        max_length=5, default="08:30",
        help_text="Heure de début (HH:MM)",
    )
    end_time = models.CharField(
        max_length=5, default="17:30",
        help_text="Heure de fin (HH:MM)",
    )
    lunch_start = models.CharField(
        max_length=5, default="12:00", blank=True,
        help_text="Début pause déjeuner (HH:MM)",
    )
    lunch_end = models.CharField(
        max_length=5, default="13:00", blank=True,
        help_text="Fin pause déjeuner (HH:MM)",
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "date"]
        unique_together = ("tournament", "date")

    def __str__(self) -> str:
        return f"{self.label or self.date} ({self.tournament.name})"

    def playable_minutes(self) -> int:
        """Calculate total playable minutes accounting for lunch break."""
        sh, sm = map(int, self.start_time.split(":"))
        eh, em = map(int, self.end_time.split(":"))
        total = (eh * 60 + em) - (sh * 60 + sm)

        if self.lunch_start and self.lunch_end:
            lsh, lsm = map(int, self.lunch_start.split(":"))
            leh, lem = map(int, self.lunch_end.split(":"))
            total -= (leh * 60 + lem) - (lsh * 60 + lsm)

        return max(0, total)
