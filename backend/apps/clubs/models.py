from django.db import models
from django.utils.text import slugify

from apps.accounts.models import User


class Club(models.Model):
    """Club organisateur (multi-tenant à terme)."""

    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, max_length=220)
    logo = models.ImageField(upload_to="clubs/", null=True, blank=True)
    website = models.URLField(blank=True)
    contact_email = models.EmailField(blank=True)
    owner = models.ForeignKey(User, on_delete=models.PROTECT, related_name="owned_clubs")
    members = models.ManyToManyField(User, related_name="clubs", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name
