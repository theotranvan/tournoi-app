"""Signals to auto-create notifications on key events."""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.matches.models import Match
from .models import Notification


@receiver(post_save, sender=Match)
def notify_match_status_change(sender, instance, **kwargs):
    """Create notification when a match starts or finishes."""
    if not kwargs.get("update_fields"):
        return

    match = instance
    tournament = match.tournament

    if match.status == "live":
        home = match.team_home.name if match.team_home else match.display_home
        away = match.team_away.name if match.team_away else match.display_away
        Notification.objects.create(
            type=Notification.Type.MATCH_STARTED,
            target=Notification.Target.ALL,
            title=f"Coup d'envoi : {home} vs {away}",
            body=f"{match.category.name} — {match.field.name if match.field else ''}",
            link=f"/tournoi/{tournament.slug}/match/{match.id}",
            tournament=tournament,
            match=match,
        )

    elif match.status == "finished" and match.score_home is not None:
        home = match.team_home.name if match.team_home else match.display_home
        away = match.team_away.name if match.team_away else match.display_away
        Notification.objects.create(
            type=Notification.Type.MATCH_FINISHED,
            target=Notification.Target.ALL,
            title=f"Terminé : {home} {match.score_home} - {match.score_away} {away}",
            body=match.category.name,
            link=f"/tournoi/{tournament.slug}/match/{match.id}",
            tournament=tournament,
            match=match,
        )
