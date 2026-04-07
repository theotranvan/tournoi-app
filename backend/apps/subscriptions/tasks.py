import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="subscriptions.expire_licenses")
def expire_licenses():
    """Deactivate ONE_SHOT licenses whose valid_until has passed."""
    from apps.subscriptions.models import TournamentLicense

    now = timezone.now()
    expired = TournamentLicense.objects.filter(
        is_active=True,
        valid_until__isnull=False,
        valid_until__lt=now,
    )
    count = expired.update(is_active=False)
    if count:
        logger.info("Deactivated %d expired license(s)", count)
    return count
