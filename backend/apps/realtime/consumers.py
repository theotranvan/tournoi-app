"""WebSocket consumers for real-time tournament updates."""

import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from apps.tournaments.models import Tournament

logger = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────────────────────


@database_sync_to_async
def _get_tournament(slug):
    try:
        return Tournament.objects.select_related("club").get(slug=slug)
    except Tournament.DoesNotExist:
        return None


@database_sync_to_async
def _tournament_for_match(match_id):
    """Return the Tournament for a given match id (or None)."""
    from apps.matches.models import Match

    try:
        return Match.objects.select_related("tournament__club").get(id=match_id).tournament
    except Match.DoesNotExist:
        return None


@database_sync_to_async
def _can_access_tournament(tournament, user):
    """Public tournaments are open; private ones require an owner/member."""
    if tournament.is_public:
        return True
    if isinstance(user, AnonymousUser) or not getattr(user, "is_authenticated", False):
        return False
    club = tournament.club
    return club.owner_id == user.id or club.members.filter(id=user.id).exists()


# ─── Tournament Consumer ────────────────────────────────────────────────────


class TournamentConsumer(AsyncJsonWebsocketConsumer):
    """
    Live tournament feed.

    Route: ``/ws/tournaments/{slug}/``

    Clients receive:
      - match.started
      - match.score_updated
      - match.finished
      - standings.updated
      - schedule.updated
      - goal.added
    """

    async def connect(self):
        self.slug = self.scope["url_route"]["kwargs"]["slug"]
        self.group_name = f"tournament_{self.slug}"

        tournament = await _get_tournament(self.slug)
        if tournament is None:
            await self.close(code=4004)
            return

        user = self.scope.get("user", AnonymousUser())

        # Public tournaments are open; private ones require an owner/member.
        if not await _can_access_tournament(tournament, user):
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Welcome snapshot
        await self.send_json(
            {
                "event": "connected",
                "tournament": self.slug,
                "message": f"Connected to tournament {self.slug}",
            }
        )
        logger.info("WS connected: tournament=%s user=%s", self.slug, user)

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info("WS disconnected: tournament=%s code=%s", self.slug, close_code)

    async def receive_json(self, content, **kwargs):
        # Clients are read-only; ignore inbound messages.
        pass

    # ── Event handlers ───────────────────────────────────────────────────

    async def match_started(self, event):
        await self.send_json(event)

    async def match_score_updated(self, event):
        await self.send_json(event)

    async def match_finished(self, event):
        await self.send_json(event)

    async def standings_updated(self, event):
        await self.send_json(event)

    async def schedule_updated(self, event):
        await self.send_json(event)

    async def goal_added(self, event):
        await self.send_json(event)


# ─── Match Consumer ─────────────────────────────────────────────────────────


class MatchConsumer(AsyncJsonWebsocketConsumer):
    """
    Per-match live feed with double scope (match + tournament groups).

    Route: ``/ws/matches/{match_id}/``

    Events are the same as TournamentConsumer but scoped to one match.
    """

    async def connect(self):
        self.match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.match_group = f"match_{self.match_id}"

        tournament = await _tournament_for_match(self.match_id)
        if tournament is None:
            await self.close(code=4004)
            return

        user = self.scope.get("user", AnonymousUser())
        if not await _can_access_tournament(tournament, user):
            await self.close(code=4003)
            return

        self.tournament_group = f"tournament_{tournament.slug}"

        await self.channel_layer.group_add(self.match_group, self.channel_name)
        await self.channel_layer.group_add(self.tournament_group, self.channel_name)
        await self.accept()

        await self.send_json(
            {
                "event": "connected",
                "match_id": self.match_id,
            }
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.match_group, self.channel_name)
        if hasattr(self, "tournament_group"):
            await self.channel_layer.group_discard(self.tournament_group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        pass

    # ── Same event handlers as TournamentConsumer ────────────────────────

    async def match_started(self, event):
        await self.send_json(event)

    async def match_score_updated(self, event):
        await self.send_json(event)

    async def match_finished(self, event):
        await self.send_json(event)

    async def standings_updated(self, event):
        await self.send_json(event)

    async def schedule_updated(self, event):
        await self.send_json(event)

    async def goal_added(self, event):
        await self.send_json(event)


# ─── Task Progress Consumer ─────────────────────────────────────────────────


class TaskProgressConsumer(AsyncJsonWebsocketConsumer):
    """
    Celery task progress tracking.

    Route: ``/ws/tasks/{task_id}/``

    Events:
      - task.progress  { percent, message }
      - task.completed { result }
      - task.failed    { error }
    """

    async def connect(self):
        self.task_id = self.scope["url_route"]["kwargs"]["task_id"]
        self.group_name = f"task_{self.task_id}"

        # Task progress can reveal generation internals; require authentication.
        # (Owner-level scoping needs a task->user registry — see follow-up.)
        user = self.scope.get("user", AnonymousUser())
        if isinstance(user, AnonymousUser) or not user.is_authenticated:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        pass

    async def task_progress(self, event):
        await self.send_json(event)

    async def task_completed(self, event):
        await self.send_json(event)

    async def task_failed(self, event):
        await self.send_json(event)
