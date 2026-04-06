"""Web Push notification helpers using pywebpush."""

import json
import logging

from django.conf import settings

from .models import PushSubscription

logger = logging.getLogger(__name__)


def _get_vapid_claims() -> dict:
    return {
        "sub": f"mailto:{getattr(settings, 'VAPID_ADMIN_EMAIL', 'admin@footix.app')}",
    }


def send_push(user, title: str, body: str, url: str = "/", tag: str = "footix") -> int:
    """Send a push notification to all subscriptions for a user.

    Returns the number of successfully sent notifications.
    """
    from pywebpush import webpush, WebPushException

    subscriptions = PushSubscription.objects.filter(user=user)
    return _send_to_subscriptions(subscriptions, title, body, url, tag)


def send_push_to_team(team_id: int, title: str, body: str, url: str = "/", tag: str = "footix") -> int:
    """Send a push notification to all subscriptions for a team."""
    subscriptions = PushSubscription.objects.filter(team_id=team_id)
    return _send_to_subscriptions(subscriptions, title, body, url, tag)


def send_push_to_users(users, title: str, body: str, url: str = "/", tag: str = "footix") -> int:
    """Send a push notification to multiple users. Returns total sent count."""
    total = 0
    for user in users:
        total += send_push(user, title, body, url, tag)
    return total


def _send_to_subscriptions(subscriptions, title: str, body: str, url: str, tag: str) -> int:
    from pywebpush import webpush, WebPushException

    vapid_private_key = getattr(settings, "VAPID_PRIVATE_KEY", "")
    if not vapid_private_key:
        logger.warning("VAPID_PRIVATE_KEY not configured — skipping push")
        return 0

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
    })

    sent = 0
    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh_key,
                "auth": sub.auth_key,
            },
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims=_get_vapid_claims(),
            )
            sent += 1
        except WebPushException as e:
            status_code = getattr(e, "response", None)
            status_code = getattr(status_code, "status_code", None) if status_code else None
            if status_code in (404, 410):
                logger.info("Removing expired push subscription %s", sub.endpoint[:60])
                sub.delete()
            else:
                logger.warning("Push failed for %s: %s", sub.endpoint[:60], e)
        except Exception:
            logger.exception("Unexpected error sending push to %s", sub.endpoint[:60])

    return sent
