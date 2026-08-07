import secrets
import string

from django.core.validators import FileExtensionValidator
from django.db import models

from apps.core.validators import validate_image_size
from apps.tournaments.models import Category, Tournament

IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"]


def generate_access_code(length: int = 8) -> str:
    """Génère un code alphanumérique lisible (sans 0, O, I, 1)."""
    alphabet = "".join(c for c in string.ascii_uppercase + string.digits if c not in "0O1I")
    return "".join(secrets.choice(alphabet) for _ in range(length))


class Team(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="teams")
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="teams")
    name = models.CharField(max_length=200)
    short_name = models.CharField(max_length=20, blank=True, help_text="Pour affichage mobile")
    logo = models.ImageField(
        upload_to="teams/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(IMAGE_EXTENSIONS), validate_image_size],
    )
    coach_name = models.CharField(max_length=200, blank=True)
    coach_phone = models.CharField(max_length=20, blank=True)
    coach_email = models.EmailField(blank=True)

    access_code = models.CharField(max_length=8, unique=True, db_index=True)
    # Bumped by regenerate_code to invalidate previously issued team JWTs.
    token_version = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "name"]
        unique_together = ("tournament", "category", "name")

    def save(self, *args, **kwargs):
        if not self.access_code:
            self.access_code = generate_access_code()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.category.name})"


class Group(models.Model):
    """Poule."""

    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="groups")
    name = models.CharField(max_length=20)
    display_order = models.PositiveIntegerField(default=0)
    teams = models.ManyToManyField(Team, related_name="groups", blank=True)

    class Meta:
        ordering = ["category", "display_order"]
        unique_together = ("category", "name")

    def __str__(self) -> str:
        return f"{self.category.name} - {self.name}"
