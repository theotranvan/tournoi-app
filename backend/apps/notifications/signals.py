"""Signals to auto-create notifications and send push on key events."""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.matches.models import Match
from .models import Notification
from .push import send_push_to_team

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Match)
def notify_match_status_change(sender, instance, **kwargs):
    """Create notification and send push when a match starts or finishes."""
    if not kwargs.get("update_fields"):
        return

    match = instance
    tournament = match.tournament

    if match.status == "live":
        home = match.team_home.name if match.team_home else match.display_home
        away = match.team_away.name if match.team_away else match.display_away
        field_name = match.field.name if match.field else ""

        title = f"Coup d'envoi : {home} vs {away}"
        body = f"{match.category.name} — {field_name}"
        link = f"/tournoi/{tournament.slug}/match/{match.id}"

        Notification.objects.create(
            type=Notification.Type.MATCH_STARTED,
            target=Notification.Target.ALL,
            title=title,
            body=body,
            link=link,
            tournament=tournament,
            match=match,
        )

        # Send push to coaches of both teams
        push_title = f"⚽ Votre match commence sur {field_name}" if field_name else "⚽ Votre match commence"
        push_body = f"{home} vs {away} — {match.category.name}"
        push_url = link

        for team in [match.team_home, match.team_away]:
            if team:
                try:
                    send_push_to_team(team.id, push_title, push_body, push_url, tag=f"match-live-{match.id}")
                except Exception:
                    logger.exception("Failed to send push for match %s to team %s", match.id, team.id)

    elif match.status == "finished" and match.score_home is not None:
        home = match.team_home.name if match.team_home else match.display_home
        away = match.team_away.name if match.team_away else match.display_away

        title = f"Terminé : {home} {match.score_home} - {match.score_away} {away}"
        body = match.category.name
        link = f"/tournoi/{tournament.slug}/match/{match.id}"

        Notification.objects.create(
            type=Notification.Type.MATCH_FINISHED,
            target=Notification.Target.ALL,
            title=title,
            body=body,
            link=link,
            tournament=tournament,
            match=match,
        )

        # Send push to coaches with the result
        push_title = f"Résultat : {home} {match.score_home} - {match.score_away} {away}"
        push_body = match.category.name

        for team in [match.team_home, match.team_away]:
            if team:
                try:
                    send_push_to_team(team.id, push_title, push_body, link, tag=f"match-result-{match.id}")
                except Exception:
                    logger.exception("Failed to send push for match %s to team %s", match.id, team.id)
