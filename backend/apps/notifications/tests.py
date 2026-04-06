"""Tests for notifications app — signals, views, push, and permissions."""

import pytest
from unittest.mock import patch, MagicMock
from django.utils import timezone
from rest_framework.test import APIClient

from apps.matches.models import Match
from apps.notifications.models import Notification, PushSubscription
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


@pytest.fixture
def organizer(db):
    return UserFactory(role="organizer")


@pytest.fixture
def coach(db):
    return UserFactory(role="coach", username="coach1")


@pytest.fixture
def tournament(organizer):
    club = ClubFactory(owner=organizer)
    return TournamentFactory(club=club)


@pytest.fixture
def match_with_teams(tournament):
    cat = CategoryFactory(tournament=tournament)
    field = FieldFactory(tournament=tournament)
    group = GroupFactory(category=cat)
    t1 = TeamFactory(tournament=tournament, category=cat, name="Lions")
    t2 = TeamFactory(tournament=tournament, category=cat, name="Tigers")
    group.teams.add(t1, t2)
    m = MatchFactory(
        tournament=tournament,
        category=cat,
        group=group,
        team_home=t1,
        team_away=t2,
        field=field,
        start_time=timezone.now(),
    )
    return m


@pytest.fixture
def api_organizer(organizer):
    client = APIClient()
    client.force_authenticate(user=organizer)
    return client


@pytest.fixture
def api_coach(coach):
    client = APIClient()
    client.force_authenticate(user=coach)
    return client


# ─── Signal Tests ────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestNotificationSignals:
    def test_match_going_live_creates_notification(self, match_with_teams):
        match = match_with_teams
        assert Notification.objects.count() == 0

        match.status = Match.Status.LIVE
        match.save(update_fields=["status"])

        notif = Notification.objects.get()
        assert notif.type == Notification.Type.MATCH_STARTED
        assert notif.target == Notification.Target.ALL
        assert "Lions" in notif.title
        assert "Tigers" in notif.title
        assert notif.tournament == match.tournament
        assert notif.match == match

    def test_match_finished_creates_notification(self, match_with_teams):
        match = match_with_teams
        match.status = Match.Status.LIVE
        match.save(update_fields=["status"])
        Notification.objects.all().delete()

        match.status = Match.Status.FINISHED
        match.score_home = 3
        match.score_away = 1
        match.save(update_fields=["status", "score_home", "score_away"])

        notif = Notification.objects.get()
        assert notif.type == Notification.Type.MATCH_FINISHED
        assert "3" in notif.title
        assert "1" in notif.title
        assert "Terminé" in notif.title

    def test_save_without_update_fields_does_not_create_notification(self, match_with_teams):
        """Regular save() without update_fields should not trigger notifications."""
        match = match_with_teams
        match.status = Match.Status.LIVE
        match.save()  # No update_fields
        assert Notification.objects.count() == 0

    def test_finished_without_score_does_not_create_notification(self, match_with_teams):
        """Finished status without scores should not create a finished notification."""
        match = match_with_teams
        match.status = Match.Status.FINISHED
        # score_home/score_away are None
        match.save(update_fields=["status"])
        # Either no notification or a match_started one — no match_finished
        assert not Notification.objects.filter(type=Notification.Type.MATCH_FINISHED).exists()


# ─── View Tests ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestNotificationListView:
    def test_list_notifications_for_admin(self, api_organizer, tournament):
        Notification.objects.create(
            type=Notification.Type.MATCH_STARTED,
            target=Notification.Target.ADMIN,
            title="Admin notif",
            tournament=tournament,
        )
        Notification.objects.create(
            type=Notification.Type.MATCH_STARTED,
            target=Notification.Target.ALL,
            title="All notif",
            tournament=tournament,
        )
        Notification.objects.create(
            type=Notification.Type.MATCH_STARTED,
            target=Notification.Target.COACH,
            title="Coach notif",
            tournament=tournament,
        )

        resp = api_organizer.get("/api/v1/notifications/")
        assert resp.status_code == 200
        titles = [n["title"] for n in resp.data]
        assert "Admin notif" in titles
        assert "All notif" in titles
        assert "Coach notif" not in titles

    def test_list_notifications_for_coach(self, api_coach, tournament):
        Notification.objects.create(
            type=Notification.Type.MATCH_STARTED,
            target=Notification.Target.ADMIN,
            title="Admin only",
            tournament=tournament,
        )
        Notification.objects.create(
            type=Notification.Type.MATCH_STARTED,
            target=Notification.Target.COACH,
            title="Coach notif",
            tournament=tournament,
        )
        Notification.objects.create(
            type=Notification.Type.MATCH_STARTED,
            target=Notification.Target.ALL,
            title="All notif",
            tournament=tournament,
        )

        resp = api_coach.get("/api/v1/notifications/")
        assert resp.status_code == 200
        titles = [n["title"] for n in resp.data]
        assert "Coach notif" in titles
        assert "All notif" in titles
        assert "Admin only" not in titles

    def test_list_filtered_by_tournament(self, api_organizer, tournament):
        other = TournamentFactory(club=tournament.club)
        Notification.objects.create(
            type=Notification.Type.MATCH_STARTED,
            target=Notification.Target.ALL,
            title="Notif A",
            tournament=tournament,
        )
        Notification.objects.create(
            type=Notification.Type.MATCH_STARTED,
            target=Notification.Target.ALL,
            title="Notif B",
            tournament=other,
        )

        resp = api_organizer.get(f"/api/v1/notifications/?tournament={tournament.id}")
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["title"] == "Notif A"

    def test_list_capped_at_50(self, api_organizer, tournament):
        for i in range(60):
            Notification.objects.create(
                type=Notification.Type.MATCH_STARTED,
                target=Notification.Target.ALL,
                title=f"N{i}",
                tournament=tournament,
            )

        resp = api_organizer.get("/api/v1/notifications/")
        assert resp.status_code == 200
        assert len(resp.data) == 50

    def test_anonymous_cannot_list_notifications(self, tournament):
        client = APIClient()
        resp = client.get("/api/v1/notifications/")
        assert resp.status_code in (401, 403)


@pytest.mark.django_db
class TestNotificationMarkRead:
    def test_mark_single_notification_read(self, api_organizer, tournament):
        notif = Notification.objects.create(
            type=Notification.Type.MATCH_STARTED,
            target=Notification.Target.ALL,
            title="Test",
            tournament=tournament,
        )

        resp = api_organizer.patch(f"/api/v1/notifications/{notif.id}/read/")
        assert resp.status_code == 200
        assert resp.data["is_read"] is True

        notif.refresh_from_db()
        assert notif.is_read is True

    def test_mark_all_read(self, api_organizer, tournament):
        for i in range(5):
            Notification.objects.create(
                type=Notification.Type.MATCH_STARTED,
                target=Notification.Target.ALL,
                title=f"N{i}",
                tournament=tournament,
            )

        resp = api_organizer.post("/api/v1/notifications/read_all/")
        assert resp.status_code == 200
        assert resp.data["marked_read"] == 5
        assert Notification.objects.filter(is_read=False).count() == 0

    def test_unread_count(self, api_organizer, tournament):
        for i in range(3):
            Notification.objects.create(
                type=Notification.Type.MATCH_STARTED,
                target=Notification.Target.ALL,
                title=f"N{i}",
                tournament=tournament,
                is_read=(i == 0),
            )

        resp = api_organizer.get("/api/v1/notifications/unread_count/")
        assert resp.status_code == 200
        assert resp.data["count"] == 2


# ─── Push Subscription Tests ────────────────────────────────────────────────


@pytest.mark.django_db
class TestPushSubscription:
    def test_subscribe_creates_push_subscription(self, api_organizer, organizer):
        data = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
            "keys": {"p256dh": "BNcRd0fake", "auth": "AUTHfake"},
        }
        resp = api_organizer.post("/api/v1/notifications/subscribe/", data, format="json")
        assert resp.status_code == 201
        assert resp.data["status"] == "subscribed"
        sub = PushSubscription.objects.get()
        assert sub.user == organizer
        assert sub.endpoint == data["endpoint"]
        assert sub.p256dh_key == "BNcRd0fake"
        assert sub.auth_key == "AUTHfake"

    def test_subscribe_update_or_create(self, api_organizer, organizer):
        data = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
            "keys": {"p256dh": "key1", "auth": "auth1"},
        }
        resp = api_organizer.post("/api/v1/notifications/subscribe/", data, format="json")
        assert resp.status_code == 201

        # Re-subscribe with updated keys
        data["keys"] = {"p256dh": "key2", "auth": "auth2"}
        resp = api_organizer.post("/api/v1/notifications/subscribe/", data, format="json")
        assert resp.status_code == 201
        assert PushSubscription.objects.count() == 1
        sub = PushSubscription.objects.get()
        assert sub.p256dh_key == "key2"

    def test_subscribe_missing_keys_rejected(self, api_organizer):
        data = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
            "keys": {"p256dh": "key1"},  # missing auth
        }
        resp = api_organizer.post("/api/v1/notifications/subscribe/", data, format="json")
        assert resp.status_code == 400

    def test_unsubscribe_deletes_subscriptions(self, api_organizer, organizer):
        PushSubscription.objects.create(
            user=organizer,
            endpoint="https://fcm.googleapis.com/fcm/send/abc",
            p256dh_key="k", auth_key="a",
        )
        resp = api_organizer.delete("/api/v1/notifications/unsubscribe/")
        assert resp.status_code == 200
        assert resp.data["deleted"] == 1
        assert PushSubscription.objects.count() == 0

    def test_unsubscribe_specific_endpoint(self, api_organizer, organizer):
        PushSubscription.objects.create(
            user=organizer,
            endpoint="https://fcm.googleapis.com/fcm/send/a",
            p256dh_key="k", auth_key="a",
        )
        PushSubscription.objects.create(
            user=organizer,
            endpoint="https://fcm.googleapis.com/fcm/send/b",
            p256dh_key="k", auth_key="a",
        )
        resp = api_organizer.delete(
            "/api/v1/notifications/unsubscribe/",
            data={"endpoint": "https://fcm.googleapis.com/fcm/send/a"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["deleted"] == 1
        assert PushSubscription.objects.count() == 1

    def test_vapid_public_key_endpoint(self):
        client = APIClient()
        resp = client.get("/api/v1/notifications/vapid-public-key/")
        assert resp.status_code == 200
        assert "key" in resp.data

    def test_anonymous_cannot_subscribe(self):
        client = APIClient()
        data = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/abc",
            "keys": {"p256dh": "k", "auth": "a"},
        }
        resp = client.post("/api/v1/notifications/subscribe/", data, format="json")
        assert resp.status_code in (401, 403)


# ─── Push Send Tests ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestSendPush:
    @patch("apps.notifications.push.settings")
    def test_send_push_skips_without_vapid_key(self, mock_settings, organizer):
        mock_settings.VAPID_PRIVATE_KEY = ""
        mock_settings.VAPID_ADMIN_EMAIL = "test@test.com"
        from apps.notifications.push import send_push
        result = send_push(organizer, "Test", "Body")
        assert result == 0

    @patch("apps.notifications.push.settings")
    def test_send_push_to_user(self, mock_settings, organizer):
        mock_settings.VAPID_PRIVATE_KEY = "fake-private-key"
        mock_settings.VAPID_ADMIN_EMAIL = "test@test.com"
        PushSubscription.objects.create(
            user=organizer,
            endpoint="https://fcm.googleapis.com/fcm/send/xyz",
            p256dh_key="p256dh_test",
            auth_key="auth_test",
        )
        with patch("pywebpush.webpush") as mock_webpush:
            from apps.notifications.push import send_push
            result = send_push(organizer, "Title", "Body", "/test")
            assert result == 1
            mock_webpush.assert_called_once()

    @patch("apps.notifications.push.settings")
    def test_send_push_removes_expired_subscription(self, mock_settings, organizer):
        mock_settings.VAPID_PRIVATE_KEY = "fake-key"
        mock_settings.VAPID_ADMIN_EMAIL = "test@test.com"
        PushSubscription.objects.create(
            user=organizer,
            endpoint="https://fcm.googleapis.com/fcm/send/expired",
            p256dh_key="k", auth_key="a",
        )

        from pywebpush import WebPushException
        mock_response = MagicMock()
        mock_response.status_code = 410

        with patch("pywebpush.webpush", side_effect=WebPushException("Gone", response=mock_response)):
            from apps.notifications.push import send_push
            result = send_push(organizer, "Test", "Body")
            assert result == 0
            assert PushSubscription.objects.count() == 0

    @patch("apps.notifications.push.settings")
    def test_send_push_to_team(self, mock_settings, tournament):
        mock_settings.VAPID_PRIVATE_KEY = "fake-key"
        mock_settings.VAPID_ADMIN_EMAIL = "test@test.com"
        cat = CategoryFactory(tournament=tournament)
        team = TeamFactory(tournament=tournament, category=cat)
        PushSubscription.objects.create(
            team=team,
            endpoint="https://fcm.googleapis.com/fcm/send/team1",
            p256dh_key="k", auth_key="a",
        )
        with patch("pywebpush.webpush"):
            from apps.notifications.push import send_push_to_team
            result = send_push_to_team(team.id, "Title", "Body")
            assert result == 1


# ─── Signal Push Tests ──────────────────────────────────────────────────────


@pytest.mark.django_db
class TestSignalPush:
    @patch("apps.notifications.signals.send_push_to_team")
    def test_match_live_sends_push_to_teams(self, mock_push, match_with_teams):
        match = match_with_teams
        match.status = Match.Status.LIVE
        match.save(update_fields=["status"])

        # Should have been called for both teams
        assert mock_push.call_count == 2
        # Verify the title contains field info
        call_args = mock_push.call_args_list[0]
        assert "commence" in call_args[0][1].lower() or "commence" in str(call_args)

    @patch("apps.notifications.signals.send_push_to_team")
    def test_match_finished_sends_push_to_teams(self, mock_push, match_with_teams):
        match = match_with_teams
        match.status = Match.Status.FINISHED
        match.score_home = 2
        match.score_away = 1
        match.save(update_fields=["status", "score_home", "score_away"])

        assert mock_push.call_count == 2
        call_args = mock_push.call_args_list[0]
        assert "2" in str(call_args) and "1" in str(call_args)
