"""Synchronous helpers for broadcasting events to WebSocket groups.

These functions are safe to call from anywhere: views, signals, Celery tasks.
They use ``async_to_sync`` so they work in synchronous Django code.
"""

from __future__ import annotations

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def _send(group: str, event_type: str, payload: dict) -> None:
    """Low-level send: dispatch *event_type* with *payload* to *group*."""
    layer = get_channel_layer()
    if layer is None:
        return
    # Channels dispatches to a handler whose name is ``type`` with dots → underscores.
    async_to_sync(layer.group_send)(
        group,
        {"type": event_type.replace(".", "_"), "event": event_type, **payload},
    )


# ─── Tournament-scoped broadcasts ───────────────────────────────────────────


def broadcast_tournament(slug: str, event_type: str, payload: dict) -> None:
    """Generic broadcast to all clients watching a tournament."""
    _send(f"tournament_{slug}", event_type, payload)


def broadcast_match_started(match) -> None:
    slug = match.tournament.slug
    payload = {
        "match_id": str(match.id),
        "category_id": match.category_id,
        "group_id": match.group_id,
        "phase": match.phase,
        "display_home": match.display_home,
        "display_away": match.display_away,
        "field_id": match.field_id and str(match.field_id),
        "start_time": match.start_time.isoformat() if match.start_time else None,
    }
    _send(f"tournament_{slug}", "match.started", payload)
    _send(f"match_{match.id}", "match.started", payload)


def broadcast_match_score_updated(match) -> None:
    slug = match.tournament.slug
    payload = {
        "match_id": str(match.id),
        "score_home": match.score_home,
        "score_away": match.score_away,
        "category_id": match.category_id,
        "group_id": match.group_id,
    }
    _send(f"tournament_{slug}", "match.score_updated", payload)
    _send(f"match_{match.id}", "match.score_updated", payload)


def broadcast_match_finished(match) -> None:
    slug = match.tournament.slug
    payload = {
        "match_id": str(match.id),
        "score_home": match.score_home,
        "score_away": match.score_away,
        "category_id": match.category_id,
        "group_id": match.group_id,
        "phase": match.phase,
    }
    _send(f"tournament_{slug}", "match.finished", payload)
    _send(f"match_{match.id}", "match.finished", payload)


def broadcast_goal_added(goal) -> None:
    match = goal.match
    slug = match.tournament.slug
    payload = {
        "match_id": str(match.id),
        "goal_id": goal.id,
        "team_id": goal.team_id,
        "player_name": goal.player_name,
        "minute": goal.minute,
    }
    _send(f"tournament_{slug}", "goal.added", payload)
    _send(f"match_{match.id}", "goal.added", payload)


def broadcast_standings_updated(category, group=None) -> None:
    slug = category.tournament.slug
    payload = {
        "category_id": category.id,
        "category_name": category.name,
    }
    if group is not None:
        payload["group_id"] = group.id
        payload["group_name"] = group.name
    _send(f"tournament_{slug}", "standings.updated", payload)


def broadcast_schedule_updated(tournament, affected_ids: list[str] | None = None) -> None:
    payload: dict = {}
    if affected_ids:
        payload["affected_match_ids"] = affected_ids
    _send(f"tournament_{tournament.slug}", "schedule.updated", payload)


# ─── Task-scoped broadcasts ─────────────────────────────────────────────────


def broadcast_task(task_id: str, event_type: str, payload: dict) -> None:
    """Generic broadcast to the client tracking a Celery task."""
    _send(f"task_{task_id}", event_type, payload)


def broadcast_task_progress(task_id: str, percent: int, message: str) -> None:
    _send(f"task_{task_id}", "task.progress", {"percent": percent, "message": message})


def broadcast_task_completed(task_id: str, result: dict) -> None:
    _send(f"task_{task_id}", "task.completed", {"result": result})


def broadcast_task_failed(task_id: str, error: str) -> None:
    _send(f"task_{task_id}", "task.failed", {"error": error})
