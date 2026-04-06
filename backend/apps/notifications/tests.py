"""Tests for notifications app — signals, views, and permissions."""

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.matches.models import Match
from apps.notifications.models import Notification
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
