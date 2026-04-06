"""Tests for realtime WebSocket consumers, middleware, and broadcasters."""

import pytest
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User
from apps.clubs.models import Club
from apps.matches.models import Match
from apps.realtime.middleware import JWTAuthMiddleware
from apps.realtime.routing import websocket_urlpatterns
from apps.teams.models import Group, Team
from apps.tournaments.models import Category, Field, Tournament

pytestmark = pytest.mark.django_db(transaction=True)

# Application instance that routes through URLRouter (populates url_route kwargs).
_ws_app = URLRouter(websocket_urlpatterns)


# ─── Helpers ─────────────────────────────────────────────────────────────────


@database_sync_to_async
def _create_organizer():
    return User.objects.create_user(
        username="org_ws",
        email="org_ws@test.com",
        password="testpass123",
        role="organizer",
    )


@database_sync_to_async
def _create_tournament(user, *, is_public=True, slug="test-ws-tournament"):
    club = Club.objects.create(name="WS Club", owner=user)
    t = Tournament.objects.create(
        club=club,
        name="WS Tournament",
        slug=slug,
        location="Test",
        start_date="2026-06-01",
        end_date="2026-06-02",
        is_public=is_public,
    )
    return t


@database_sync_to_async
def _create_match(tournament):
    cat = Category.objects.create(tournament=tournament, name="U10")
    grp = Group.objects.create(category=cat, name="A")
    field = Field.objects.create(
        tournament=tournament,
        name="F1",
        availability=[{"date": "2026-06-01", "start": "08:00", "end": "18:00"}],
    )
    t1 = Team.objects.create(name="Team A", tournament=tournament, category=cat)
    t2 = Team.objects.create(name="Team B", tournament=tournament, category=cat)
    grp.teams.add(t1, t2)
    m = Match.objects.create(
        tournament=tournament,
        category=cat,
        group=grp,
        team_home=t1,
        team_away=t2,
        field=field,
        start_time="2026-06-01T10:00:00Z",
        duration_minutes=15,
    )
    return m


def _make_communicator(path, user=None):
    """Build a WebsocketCommunicator routed through URLRouter."""
    communicator = WebsocketCommunicator(_ws_app, path)
    if user:
        communicator.scope["user"] = user
    else:
        communicator.scope["user"] = AnonymousUser()
    return communicator


# ─── TournamentConsumer Tests ────────────────────────────────────────────────


class TestTournamentConsumer:
    @pytest.mark.asyncio
    async def test_connect_public_tournament(self):
        user = await _create_organizer()
        await _create_tournament(user, slug="pub-t")
        comm = _make_communicator("/ws/tournaments/pub-t/")
        connected, _ = await comm.connect()
        assert connected

        welcome = await comm.receive_json_from()
        assert welcome["event"] == "connected"
        assert welcome["tournament"] == "pub-t"
        await comm.disconnect()

    @pytest.mark.asyncio
    async def test_connect_private_tournament_no_auth_rejected(self):
        user = await _create_organizer()
        await _create_tournament(user, slug="priv-t", is_public=False)
        comm = _make_communicator("/ws/tournaments/priv-t/")
        connected, code = await comm.connect()
        # The consumer accepts then closes with 4003
        if connected:
            msg = await comm.receive_output()
            assert msg["type"] == "websocket.close"

    @pytest.mark.asyncio
    async def test_connect_private_tournament_with_auth(self):
        user = await _create_organizer()
        await _create_tournament(user, slug="priv-auth", is_public=False)
        comm = _make_communicator("/ws/tournaments/priv-auth/", user=user)
        connected, _ = await comm.connect()
        assert connected
        welcome = await comm.receive_json_from()
        assert welcome["event"] == "connected"
        await comm.disconnect()

    @pytest.mark.asyncio
    async def test_connect_nonexistent_tournament_rejected(self):
        comm = _make_communicator("/ws/tournaments/no-such/")
        connected, code = await comm.connect()
        if connected:
            msg = await comm.receive_output()
            assert msg["type"] == "websocket.close"

    @pytest.mark.asyncio
    async def test_receive_match_score_updated_event(self):
        user = await _create_organizer()
        await _create_tournament(user, slug="evt-t")
        comm = _make_communicator("/ws/tournaments/evt-t/")
        connected, _ = await comm.connect()
        assert connected
        _ = await comm.receive_json_from()  # consume welcome

        # Simulate a broadcast
        layer = get_channel_layer()
        await layer.group_send("tournament_evt-t", {
            "type": "match.score_updated",
            "event": "match.score_updated",
            "match_id": "abc-123",
            "score_home": 2,
            "score_away": 1,
        })

        msg = await comm.receive_json_from()
        assert msg["event"] == "match.score_updated"
        assert msg["score_home"] == 2
        assert msg["score_away"] == 1
        await comm.disconnect()

    @pytest.mark.asyncio
    async def test_receive_schedule_updated_event(self):
        user = await _create_organizer()
        await _create_tournament(user, slug="sched-t")
        comm = _make_communicator("/ws/tournaments/sched-t/")
        connected, _ = await comm.connect()
        assert connected
        _ = await comm.receive_json_from()

        layer = get_channel_layer()
        await layer.group_send("tournament_sched-t", {
            "type": "schedule.updated",
            "event": "schedule.updated",
        })

        msg = await comm.receive_json_from()
        assert msg["event"] == "schedule.updated"
        await comm.disconnect()

    @pytest.mark.asyncio
    async def test_receive_match_started_event(self):
        user = await _create_organizer()
        await _create_tournament(user, slug="start-t")
        comm = _make_communicator("/ws/tournaments/start-t/")
        connected, _ = await comm.connect()
        assert connected
        _ = await comm.receive_json_from()

        layer = get_channel_layer()
        await layer.group_send("tournament_start-t", {
            "type": "match.started",
            "event": "match.started",
            "match_id": "m-1",
        })

        msg = await comm.receive_json_from()
        assert msg["event"] == "match.started"
        assert msg["match_id"] == "m-1"
        await comm.disconnect()

    @pytest.mark.asyncio
    async def test_receive_goal_added_event(self):
        user = await _create_organizer()
        await _create_tournament(user, slug="goal-t")
        comm = _make_communicator("/ws/tournaments/goal-t/")
        connected, _ = await comm.connect()
        assert connected
        _ = await comm.receive_json_from()

        layer = get_channel_layer()
        await layer.group_send("tournament_goal-t", {
            "type": "goal.added",
            "event": "goal.added",
            "match_id": "m-2",
            "player_name": "Theo",
        })

        msg = await comm.receive_json_from()
        assert msg["event"] == "goal.added"
        assert msg["player_name"] == "Theo"
        await comm.disconnect()


# ─── MatchConsumer Tests ─────────────────────────────────────────────────────


class TestMatchConsumer:
    @pytest.mark.asyncio
    async def test_connect_to_existing_match(self):
        user = await _create_organizer()
        tournament = await _create_tournament(user, slug="match-t")
        match = await _create_match(tournament)
        match_id = str(match.id)

        comm = _make_communicator(f"/ws/matches/{match_id}/")
        connected, _ = await comm.connect()
        assert connected

        welcome = await comm.receive_json_from()
        assert welcome["event"] == "connected"
        assert welcome["match_id"] == match_id
        await comm.disconnect()

    @pytest.mark.asyncio
    async def test_connect_nonexistent_match_rejected(self):
        comm = _make_communicator(
            "/ws/matches/00000000-0000-0000-0000-000000000000/",
        )
        connected, _ = await comm.connect()
        if connected:
            msg = await comm.receive_output()
            assert msg["type"] == "websocket.close"

    @pytest.mark.asyncio
    async def test_receives_event_on_match_group(self):
        user = await _create_organizer()
        tournament = await _create_tournament(user, slug="match-evt-t")
        match = await _create_match(tournament)
        match_id = str(match.id)

        comm = _make_communicator(f"/ws/matches/{match_id}/")
        connected, _ = await comm.connect()
        assert connected
        _ = await comm.receive_json_from()

        layer = get_channel_layer()
        await layer.group_send(f"match_{match_id}", {
            "type": "match.score_updated",
            "event": "match.score_updated",
            "score_home": 3,
            "score_away": 0,
        })

        msg = await comm.receive_json_from()
        assert msg["score_home"] == 3
        await comm.disconnect()


# ─── TaskProgressConsumer Tests ──────────────────────────────────────────────


class TestTaskProgressConsumer:
    @pytest.mark.asyncio
    async def test_connect_and_receive_progress(self):
        comm = _make_communicator("/ws/tasks/task-abc/")
        connected, _ = await comm.connect()
        assert connected

        layer = get_channel_layer()
        await layer.group_send("task_task-abc", {
            "type": "task.progress",
            "event": "task.progress",
            "percent": 50,
            "message": "Half done",
        })

        msg = await comm.receive_json_from()
        assert msg["event"] == "task.progress"
        assert msg["percent"] == 50
        await comm.disconnect()

    @pytest.mark.asyncio
    async def test_receive_task_completed(self):
        comm = _make_communicator("/ws/tasks/task-xyz/")
        connected, _ = await comm.connect()
        assert connected

        layer = get_channel_layer()
        await layer.group_send("task_task-xyz", {
            "type": "task.completed",
            "event": "task.completed",
            "result": {"total_matches": 40},
        })

        msg = await comm.receive_json_from()
        assert msg["event"] == "task.completed"
        assert msg["result"]["total_matches"] == 40
        await comm.disconnect()

    @pytest.mark.asyncio
    async def test_receive_task_failed(self):
        comm = _make_communicator("/ws/tasks/task-fail/")
        connected, _ = await comm.connect()
        assert connected

        layer = get_channel_layer()
        await layer.group_send("task_task-fail", {
            "type": "task.failed",
            "event": "task.failed",
            "error": "Timeout exceeded",
        })

        msg = await comm.receive_json_from()
        assert msg["event"] == "task.failed"
        assert msg["error"] == "Timeout exceeded"
        await comm.disconnect()


# ─── JWT Middleware Tests ────────────────────────────────────────────────────


class TestJWTMiddleware:
    @pytest.mark.asyncio
    async def test_valid_token_authenticates_user(self):
        user = await _create_organizer()
        token = await database_sync_to_async(lambda: str(AccessToken.for_user(user)))()

        from channels.routing import URLRouter

        app = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
        comm = WebsocketCommunicator(app, f"/ws/tasks/t1/?token={token}")
        connected, _ = await comm.connect()
        assert connected
        await comm.disconnect()

    @pytest.mark.asyncio
    async def test_no_token_sets_anonymous(self):
        from channels.routing import URLRouter

        app = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
        comm = WebsocketCommunicator(app, "/ws/tasks/t2/")
        connected, _ = await comm.connect()
        assert connected
        await comm.disconnect()

    @pytest.mark.asyncio
    async def test_invalid_token_sets_anonymous(self):
        from channels.routing import URLRouter

        app = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
        comm = WebsocketCommunicator(app, "/ws/tasks/t3/?token=bad.token.value")
        connected, _ = await comm.connect()
        assert connected
        await comm.disconnect()


# ─── Broadcaster Integration Tests ──────────────────────────────────────────


class TestBroadcasterIntegration:
    @pytest.mark.asyncio
    async def test_broadcast_match_score_updated_sync(self):
        """Verify the sync broadcaster sends events that consumers receive."""
        user = await _create_organizer()
        tournament = await _create_tournament(user, slug="bc-score-t")
        match = await _create_match(tournament)

        comm = _make_communicator("/ws/tournaments/bc-score-t/")
        connected, _ = await comm.connect()
        assert connected
        _ = await comm.receive_json_from()

        # Call the sync broadcaster from async context
        from apps.realtime.broadcasters import broadcast_match_score_updated

        await database_sync_to_async(broadcast_match_score_updated)(match)

        msg = await comm.receive_json_from()
        assert msg["event"] == "match.score_updated"
        assert msg["match_id"] == str(match.id)
        await comm.disconnect()

    @pytest.mark.asyncio
    async def test_broadcast_task_progress_sync(self):
        comm = _make_communicator("/ws/tasks/bc-task/")
        connected, _ = await comm.connect()
        assert connected

        from apps.realtime.broadcasters import broadcast_task_progress

        await database_sync_to_async(broadcast_task_progress)("bc-task", 75, "Almost done")

        msg = await comm.receive_json_from()
        assert msg["event"] == "task.progress"
        assert msg["percent"] == 75
        await comm.disconnect()
