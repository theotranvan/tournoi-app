"""Residual multi-tenant issues found during the second security review.

``test_access_control.py`` covers the resource *targeted by the URL*. This file
covers the complementary hole: foreign keys supplied in the **request body**.
``TournamentScopedMixin`` scopes ``get_object``/``get_queryset``, but a serializer
whose related field uses an unfiltered queryset (``Team.objects.all()``,
the default for a ``ModelSerializer`` FK) still accepts a primary key belonging to
another organizer's tournament.

It also adds the WebSocket authorization tests (H1) and the one-shot licence
ownership test (H3), which had no coverage.

Finding N1 is now fixed: nested serializers scope their FK fields to the request's
tournament (via the tournament injected into serializer context by
``TournamentScopedMixin.get_serializer_context``). All tests here pass.
"""

import pytest
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import AnonymousUser
from rest_framework import status
from rest_framework.test import APIClient

from apps.realtime.consumers import MatchConsumer, TaskProgressConsumer, TournamentConsumer
from tests.factories import (
    CategoryFactory,
    ClubFactory,
    FieldFactory,
    GroupFactory,
    MatchFactory,
    TeamFactory,
    TournamentFactory,
    UserFactory,
)

DENIED = (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)


@pytest.fixture
def owner_client(db):
    """An organizer with their own tournament, plus a foreign tournament to poke at."""
    user = UserFactory()
    tournament = TournamentFactory(club=ClubFactory(owner=user))
    category = CategoryFactory(tournament=tournament)

    foreign_tournament = TournamentFactory()
    foreign_category = CategoryFactory(tournament=foreign_tournament)

    client = APIClient()
    client.force_authenticate(user=user)
    return {
        "client": client,
        "user": user,
        "tournament": tournament,
        "category": category,
        "foreign_tournament": foreign_tournament,
        "foreign_category": foreign_category,
    }


# ─── N1 — cross-tenant foreign keys in request bodies ────────────────────────


class TestCrossTenantForeignKeys:
    """An organizer must not be able to reference another tenant's objects."""

    def test_cannot_schedule_own_match_on_foreign_field(self, owner_client):
        ctx = owner_client
        match = MatchFactory(tournament=ctx["tournament"], category=ctx["category"])
        foreign_field = FieldFactory(tournament=ctx["foreign_tournament"])

        url = f"/api/v1/tournaments/{ctx['tournament'].id}/matches/{match.id}/"
        resp = ctx["client"].patch(url, data={"field": foreign_field.pk}, format="json")

        assert resp.status_code in DENIED, f"a foreign Field ({foreign_field.pk}) was accepted -> {resp.status_code}"
        match.refresh_from_db()
        assert match.field_id != foreign_field.pk

    def test_cannot_put_foreign_team_in_own_group(self, owner_client):
        ctx = owner_client
        group = GroupFactory(category=ctx["category"])
        foreign_team = TeamFactory(tournament=ctx["foreign_tournament"], category=ctx["foreign_category"])

        url = f"/api/v1/tournaments/{ctx['tournament'].id}/categories/{ctx['category'].id}/groups/{group.pk}/"
        resp = ctx["client"].patch(url, data={"team_ids": [foreign_team.pk]}, format="json")

        assert resp.status_code in DENIED
        assert not group.teams.filter(pk=foreign_team.pk).exists()

    def test_cannot_create_team_in_foreign_category(self, owner_client):
        ctx = owner_client
        url = f"/api/v1/tournaments/{ctx['tournament'].id}/teams/"
        resp = ctx["client"].post(
            url,
            data={"name": "Squatteur", "category": ctx["foreign_category"].id},
            format="json",
        )
        assert resp.status_code in DENIED


# ─── H1 — WebSocket authorization ────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestWebSocketAuthorization:
    async def _connect(self, consumer, path, url_kwargs, user=None):
        communicator = WebsocketCommunicator(consumer.as_asgi(), path)
        communicator.scope["url_route"] = {"kwargs": url_kwargs, "args": ()}
        communicator.scope["user"] = user or AnonymousUser()
        connected, _ = await communicator.connect()
        await communicator.disconnect()
        return connected

    async def test_anonymous_rejected_on_private_tournament(self):
        from channels.db import database_sync_to_async

        tournament = await database_sync_to_async(TournamentFactory)(is_public=False)
        connected = await self._connect(
            TournamentConsumer, f"/ws/tournaments/{tournament.slug}/", {"slug": tournament.slug}
        )
        assert connected is False

    async def test_anonymous_accepted_on_public_tournament(self):
        from channels.db import database_sync_to_async

        tournament = await database_sync_to_async(TournamentFactory)(is_public=True)
        connected = await self._connect(
            TournamentConsumer, f"/ws/tournaments/{tournament.slug}/", {"slug": tournament.slug}
        )
        assert connected is True

    async def test_match_consumer_rejects_anonymous_on_private_tournament(self):
        from channels.db import database_sync_to_async

        tournament = await database_sync_to_async(TournamentFactory)(is_public=False)
        match = await database_sync_to_async(MatchFactory)(tournament=tournament)
        connected = await self._connect(MatchConsumer, f"/ws/matches/{match.id}/", {"match_id": str(match.id)})
        assert connected is False

    async def test_task_consumer_rejects_anonymous(self):
        connected = await self._connect(TaskProgressConsumer, "/ws/tasks/abc-123/", {"task_id": "abc-123"})
        assert connected is False


# ─── H3 — one-shot licence ownership ─────────────────────────────────────────


class TestOneShotLicenceOwnership:
    def test_cannot_start_checkout_on_someone_elses_tournament(self, db, settings):
        settings.STRIPE_SECRET_KEY = "sk_test_dummy"
        victim_tournament = TournamentFactory()

        client = APIClient()
        client.force_authenticate(user=UserFactory())
        resp = client.post(
            "/api/v1/subscriptions/checkout/",
            data={"plan": "one_shot", "tournament_id": str(victim_tournament.id)},
            format="json",
        )

        # 403 (ownership) or 503 (Stripe not configured) — never a created licence.
        assert resp.status_code != status.HTTP_200_OK
        from apps.subscriptions.models import TournamentLicense

        assert not TournamentLicense.objects.filter(tournament=victim_tournament).exists()


# ─── M7 — CSV import hardening ───────────────────────────────────────────────


class TestCsvImportHardening:
    def _url(self, ctx):
        return f"/api/v1/tournaments/{ctx['tournament'].id}/teams/bulk-import/"

    def test_rejects_non_csv_extension(self, owner_client):
        from django.core.files.uploadedfile import SimpleUploadedFile

        file = SimpleUploadedFile("payload.exe", b"name,category\nA,U10\n")
        resp = owner_client["client"].post(self._url(owner_client), data={"file": file}, format="multipart")
        assert resp.status_code in DENIED + (status.HTTP_422_UNPROCESSABLE_ENTITY,)

    def test_rejects_non_utf8_payload(self, owner_client):
        from django.core.files.uploadedfile import SimpleUploadedFile

        file = SimpleUploadedFile("teams.csv", b"\xff\xfe\x00binary")
        resp = owner_client["client"].post(self._url(owner_client), data={"file": file}, format="multipart")
        assert resp.status_code != status.HTTP_500_INTERNAL_SERVER_ERROR
        assert resp.status_code in DENIED + (status.HTTP_422_UNPROCESSABLE_ENTITY,)
