"""Django signal handlers that auto-broadcast WebSocket events on mutations."""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.matches.models import Goal, Match
from apps.realtime.broadcasters import (
    broadcast_goal_added,
    broadcast_match_finished,
    broadcast_match_score_updated,
    broadcast_match_started,
    broadcast_standings_updated,
)

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Match)
def on_match_saved(sender, instance, created, **kwargs):
    """Broadcast relevant events when a match is created or updated."""
    if created:
        return

    # The TrackChangesMixin populates _changed_fields before save.
    changed = getattr(instance, "_changed_fields", {})
    if not changed:
        return

    # Status transitions
    if "status" in changed:
        new_status = instance.status
        if new_status == Match.Status.LIVE:
            broadcast_match_started(instance)
            logger.info("Broadcast match.started match=%s", instance.id)
        elif new_status == Match.Status.FINISHED:
            broadcast_match_finished(instance)
            logger.info("Broadcast match.finished match=%s", instance.id)
            # Invalidate standings cache and broadcast update
            _refresh_standings(instance)
            # Resolve bracket placeholders
            _resolve_brackets_on_finish(instance)

    # Score changes
    if "score_home" in changed or "score_away" in changed:
        broadcast_match_score_updated(instance)
        logger.info("Broadcast match.score_updated match=%s", instance.id)
        # If match is finished, recalc standings on score correction
        if instance.status == Match.Status.FINISHED:
            _refresh_standings(instance)


def _refresh_standings(match):
    """Invalidate cache and broadcast standings for the match's group/category."""
    from apps.standings.services import invalidate_standings

    if match.group_id:
        invalidate_standings(match.group_id)
        # Fetch category via group (might not be loaded)
        category = match.category
        broadcast_standings_updated(category, match.group)
        logger.info("Standings invalidated & broadcast group=%s", match.group_id)


@receiver(post_save, sender=Goal)
def on_goal_created(sender, instance, created, **kwargs):
    """Broadcast when a new goal is recorded."""
    if not created:
        return
    broadcast_goal_added(instance)
    logger.info("Broadcast goal.added goal=%s match=%s", instance.id, instance.match_id)


def _resolve_brackets_on_finish(match):
    """Auto-resolve knockout brackets when a match finishes."""
    try:
        from apps.scheduling.bracket_resolver import (
            advance_knockout_winner,
            resolve_group_to_knockout,
        )

        category = match.category
        if match.phase == Match.Phase.GROUP:
            updated = resolve_group_to_knockout(category)
            if updated:
                logger.info(
                    "Auto-resolved %d bracket match(es) for category %s",
                    updated, category.name,
                )
        else:
            updated = advance_knockout_winner(match)
            if updated:
                logger.info(
                    "Advanced %d knockout match(es) after %s finished",
                    updated, match.id,
                )
    except Exception:
        logger.exception("Error resolving brackets after match %s", match.id)
