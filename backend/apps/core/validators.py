"""Shared model/field validators."""

from django.core.exceptions import ValidationError

MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


def validate_image_size(file):
    """Reject uploaded images larger than MAX_IMAGE_SIZE."""
    if getattr(file, "size", 0) and file.size > MAX_IMAGE_SIZE:
        raise ValidationError(f"L'image ne doit pas dépasser {MAX_IMAGE_SIZE // (1024 * 1024)} Mo.")
