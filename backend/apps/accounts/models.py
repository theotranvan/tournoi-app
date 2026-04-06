from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Utilisateur unique pour tous les rôles — le rôle est contextuel selon le club/tournoi."""

    class Role(models.TextChoices):
        SUPERADMIN = "superadmin", "Super Admin"
        ORGANIZER = "organizer", "Organisateur"
        COACH = "coach", "Coach"
        PUBLIC = "public", "Public"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PUBLIC)
    phone = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_user"

    def __str__(self) -> str:
        return self.username
