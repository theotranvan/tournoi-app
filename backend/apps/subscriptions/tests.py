"""Tests for subscriptions app — checkout, portal, webhook, status."""

import pytest
from datetime import datetime, timezone as dt_tz
from unittest.mock import MagicMock, patch

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.subscriptions.models import Subscription, TournamentLicense
from tests.factories import (
    CategoryFactory,
    ClubFactory,
    TeamFactory,
    TournamentFactory,
    UserFactory,
)


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def subscription(user):
    return Subscription.objects.create(
        user=user,
        plan=Subscription.Plan.FREE,
        status=Subscription.Status.ACTIVE,
        stripe_customer_id="cus_test123",
    )


# ─── Model Tests ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestSubscriptionModel:
    def test_free_plan_is_not_premium(self, subscription):
        assert subscription.is_premium is False

    def test_monthly_active_is_premium(self, subscription):
        subscription.plan = Subscription.Plan.MONTHLY
        subscription.status = Subscription.Status.ACTIVE
        subscription.save()
        assert subscription.is_premium is True

    def test_yearly_trialing_is_premium(self, subscription):
        subscription.plan = Subscription.Plan.YEARLY
        subscription.status = Subscription.Status.TRIALING
        subscription.save()
        assert subscription.is_premium is True

    def test_monthly_canceled_is_not_premium(self, subscription):
        subscription.plan = Subscription.Plan.MONTHLY
        subscription.status = Subscription.Status.CANCELED
        subscription.save()
        assert subscription.is_premium is False

    def test_str_representation(self, subscription):
        s = str(subscription)
        assert subscription.user.username in s


# ─── Status View Tests ───────────────────────────────────────────────────────


@pytest.mark.django_db
class TestSubscriptionStatusView:
    def test_get_status_creates_subscription_if_missing(self, api, user):
        assert not Subscription.objects.filter(user=user).exists()

        resp = api.get("/api/v1/subscriptions/status/")
        assert resp.status_code == 200
        assert resp.data["subscription"]["plan"] == "free"
        assert "licenses" in resp.data
        assert Subscription.objects.filter(user=user).exists()

    def test_get_status_returns_existing(self, api, subscription):
        resp = api.get("/api/v1/subscriptions/status/")
        assert resp.status_code == 200
        assert resp.data["subscription"]["plan"] == "free"
        assert resp.data["subscription"]["status"] == "active"

    def test_status_requires_auth(self):
        client = APIClient()
        resp = client.get("/api/v1/subscriptions/status/")
        assert resp.status_code in (401, 403)


# ─── Checkout View Tests ─────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCreateCheckoutView:
    @patch("apps.subscriptions.views.stripe.checkout.Session.create")
    @patch("apps.subscriptions.views.stripe.Customer.create")
    @patch("apps.subscriptions.views.PRICE_MAP", {"monthly": "price_monthly_test", "yearly": "price_yearly_test"})
    def test_checkout_creates_customer_and_session(self, mock_customer, mock_session, api, user):
        mock_customer.return_value = MagicMock(id="cus_new_123")
        mock_session.return_value = MagicMock(url="https://checkout.stripe.com/test")

        resp = api.post("/api/v1/subscriptions/checkout/", {"plan": "monthly"})
        assert resp.status_code == 200
        assert resp.data["checkout_url"] == "https://checkout.stripe.com/test"
        mock_customer.assert_called_once()
        mock_session.assert_called_once()

        sub = Subscription.objects.get(user=user)
        assert sub.stripe_customer_id == "cus_new_123"

    @patch("apps.subscriptions.views.stripe.checkout.Session.create")
    @patch("apps.subscriptions.views.PRICE_MAP", {"monthly": "price_monthly_test", "yearly": "price_yearly_test"})
    def test_checkout_reuses_existing_customer(self, mock_session, api, subscription):
        mock_session.return_value = MagicMock(url="https://checkout.stripe.com/reuse")

        resp = api.post("/api/v1/subscriptions/checkout/", {"plan": "monthly"})
        assert resp.status_code == 200
        mock_session.assert_called_once()
        call_kwargs = mock_session.call_args[1]
        assert call_kwargs["customer"] == "cus_test123"

    def test_checkout_rejects_invalid_plan(self, api):
        resp = api.post("/api/v1/subscriptions/checkout/", {"plan": "invalid"})
        assert resp.status_code == 400

    def test_checkout_requires_auth(self):
        client = APIClient()
        resp = client.post("/api/v1/subscriptions/checkout/", {"plan": "monthly"})
        assert resp.status_code in (401, 403)


# ─── Portal View Tests ───────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCustomerPortalView:
    @patch("apps.subscriptions.views.stripe.billing_portal.Session.create")
    def test_portal_returns_url(self, mock_portal, api, subscription):
        mock_portal.return_value = MagicMock(url="https://billing.stripe.com/portal")

        resp = api.post("/api/v1/subscriptions/portal/")
        assert resp.status_code == 200
        assert resp.data["portal_url"] == "https://billing.stripe.com/portal"
        mock_portal.assert_called_once()

    def test_portal_without_stripe_customer_fails(self, api, user):
        Subscription.objects.create(user=user, stripe_customer_id="")

        resp = api.post("/api/v1/subscriptions/portal/")
        assert resp.status_code == 400

    def test_portal_requires_auth(self):
        client = APIClient()
        resp = client.post("/api/v1/subscriptions/portal/")
        assert resp.status_code in (401, 403)


# ─── Webhook Tests ───────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestStripeWebhook:
    def _post_webhook(self, client, payload=b'{}', sig="sig_test"):
        return client.post(
            "/api/v1/subscriptions/webhook/",
            data=payload,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE=sig,
        )

    @override_settings(STRIPE_WEBHOOK_SECRET="whsec_test")
    def test_webhook_rejects_invalid_signature(self):
        """Without a valid construct_event, the webhook should return 400."""
        client = APIClient()
        resp = self._post_webhook(client, b'{"type":"fake"}', "invalid_sig")
        assert resp.status_code == 400

    def test_webhook_rejects_missing_secret(self):
        """When STRIPE_WEBHOOK_SECRET is empty, return 400."""
        client = APIClient()
        # Default settings have STRIPE_WEBHOOK_SECRET="" (empty)
        resp = self._post_webhook(client)
        assert resp.status_code == 400

    @patch("apps.subscriptions.views.stripe.Webhook.construct_event")
    @patch("apps.subscriptions.views.PRICE_MAP", {"monthly": "price_monthly_test", "yearly": "price_yearly_test"})
    @override_settings(STRIPE_WEBHOOK_SECRET="whsec_test")
    def test_webhook_handles_subscription_created(self, mock_construct, subscription):
        mock_construct.return_value = {
            "type": "customer.subscription.created",
            "data": {"object": {
                "id": "sub_stripe_123",
                "customer": "cus_test123",
                "status": "active",
                "items": {"data": [{"price": {"id": "price_monthly_test"}}]},
                "current_period_start": 1700000000,
                "current_period_end": 1702592000,
                "cancel_at_period_end": False,
            }},
        }

        client = APIClient()
        resp = self._post_webhook(client)

        assert resp.status_code == 200

        subscription.refresh_from_db()
        assert subscription.stripe_subscription_id == "sub_stripe_123"
        assert subscription.status == "active"
        assert subscription.plan == Subscription.Plan.MONTHLY
        assert subscription.current_period_start == datetime.fromtimestamp(1700000000, tz=dt_tz.utc)
        assert subscription.current_period_end == datetime.fromtimestamp(1702592000, tz=dt_tz.utc)

    @patch("apps.subscriptions.views.stripe.Webhook.construct_event")
    @override_settings(STRIPE_WEBHOOK_SECRET="whsec_test")
    def test_webhook_handles_subscription_deleted(self, mock_construct, subscription):
        subscription.plan = Subscription.Plan.MONTHLY
        subscription.status = Subscription.Status.ACTIVE
        subscription.stripe_subscription_id = "sub_old"
        subscription.save()

        mock_construct.return_value = {
            "type": "customer.subscription.deleted",
            "data": {"object": {
                "id": "sub_old",
                "customer": "cus_test123",
            }},
        }

        client = APIClient()
        resp = self._post_webhook(client)

        assert resp.status_code == 200

        subscription.refresh_from_db()
        assert subscription.plan == Subscription.Plan.FREE
        assert subscription.status == Subscription.Status.CANCELED
        assert subscription.stripe_subscription_id == ""

    @patch("apps.subscriptions.views.stripe.Webhook.construct_event")
    @override_settings(STRIPE_WEBHOOK_SECRET="whsec_test")
    def test_webhook_handles_payment_failed(self, mock_construct, subscription):
        subscription.plan = Subscription.Plan.MONTHLY
        subscription.status = Subscription.Status.ACTIVE
        subscription.save()

        mock_construct.return_value = {
            "type": "invoice.payment_failed",
            "data": {"object": {
                "customer": "cus_test123",
            }},
        }

        client = APIClient()
        resp = self._post_webhook(client)

        assert resp.status_code == 200

        subscription.refresh_from_db()
        assert subscription.status == Subscription.Status.PAST_DUE

    @patch("apps.subscriptions.views.stripe.Webhook.construct_event")
    @override_settings(STRIPE_WEBHOOK_SECRET="whsec_test")
    def test_webhook_ignores_unknown_customer(self, mock_construct):
        """Webhook for unknown customer should not crash."""
        mock_construct.return_value = {
            "type": "customer.subscription.created",
            "data": {"object": {
                "id": "sub_unknown",
                "customer": "cus_nonexistent",
                "status": "active",
                "items": {"data": []},
                "current_period_start": 1700000000,
                "current_period_end": 1702592000,
                "cancel_at_period_end": False,
            }},
        }

        client = APIClient()
        resp = self._post_webhook(client)

        assert resp.status_code == 200

    @patch("apps.subscriptions.views.stripe.Webhook.construct_event")
    @override_settings(STRIPE_WEBHOOK_SECRET="whsec_test")
    def test_webhook_handles_subscription_updated(self, mock_construct, subscription):
        """subscription.updated event should also update local subscription."""
        mock_construct.return_value = {
            "type": "customer.subscription.updated",
            "data": {"object": {
                "id": "sub_updated",
                "customer": "cus_test123",
                "status": "trialing",
                "items": {"data": []},
                "current_period_start": 1700000000,
                "current_period_end": 1702592000,
                "cancel_at_period_end": True,
            }},
        }

        client = APIClient()
        resp = self._post_webhook(client)
        assert resp.status_code == 200

        subscription.refresh_from_db()
        assert subscription.status == "trialing"
        assert subscription.cancel_at_period_end is True


# ─── License Model Tests ─────────────────────────────────────────────────────


@pytest.mark.django_db
class TestTournamentLicense:
    def test_license_active_by_default(self):
        user = UserFactory()
        tournament = TournamentFactory(club__owner=user)
        license_obj = TournamentLicense.objects.create(
            user=user,
            tournament=tournament,
            stripe_payment_intent_id="pi_test",
        )
        assert license_obj.is_active is True
        assert license_obj.is_valid is True

    def test_license_valid_until_none_means_lifetime(self):
        user = UserFactory()
        tournament = TournamentFactory(club__owner=user)
        license_obj = TournamentLicense.objects.create(
            user=user,
            tournament=tournament,
            stripe_payment_intent_id="pi_test",
            valid_until=None,
        )
        assert license_obj.is_valid is True

    def test_license_unlocks_one_shot_features(self):
        user = UserFactory()
        tournament = TournamentFactory(club__owner=user)
        TournamentLicense.objects.create(
            user=user,
            tournament=tournament,
            stripe_payment_intent_id="pi_test",
        )
        from apps.subscriptions.plans import can_use_feature, get_effective_plan

        assert get_effective_plan(user, tournament) == "ONE_SHOT"
        assert can_use_feature(user, "knockout_phase", tournament) is True
        assert can_use_feature(user, "pdf_kit", tournament) is True

    def test_inactive_license_is_not_valid(self):
        user = UserFactory()
        tournament = TournamentFactory(club__owner=user)
        license_obj = TournamentLicense.objects.create(
            user=user,
            tournament=tournament,
            stripe_payment_intent_id="pi_test",
            is_active=False,
        )
        assert license_obj.is_valid is False


# ─── ONE_SHOT Webhook Tests ──────────────────────────────────────────────────


@pytest.mark.django_db
class TestOneShotWebhookFlow:
    """Checkout completed / payment_intent.succeeded → license activation."""

    def _post_webhook(self, client, payload=b'{}', sig="sig_test"):
        return client.post(
            "/api/v1/subscriptions/webhook/",
            data=payload,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE=sig,
        )

    @patch("apps.subscriptions.views.stripe.Webhook.construct_event")
    @override_settings(STRIPE_WEBHOOK_SECRET="whsec_test")
    def test_checkout_completed_activates_license(self, mock_construct, user):
        tournament = TournamentFactory(club__owner=user)
        license_obj = TournamentLicense.objects.create(
            user=user,
            tournament=tournament,
            stripe_checkout_session_id="cs_test_123",
            is_active=False,
        )

        mock_construct.return_value = {
            "type": "checkout.session.completed",
            "data": {"object": {
                "id": "cs_test_123",
                "mode": "payment",
                "payment_intent": "pi_webhook_123",
                "metadata": {
                    "user_id": str(user.id),
                    "plan": "one_shot",
                    "tournament_id": str(tournament.id),
                },
            }},
        }

        resp = self._post_webhook(APIClient())
        assert resp.status_code == 200

        license_obj.refresh_from_db()
        assert license_obj.is_active is True
        assert license_obj.stripe_payment_intent_id == "pi_webhook_123"
        assert license_obj.valid_from is not None
        assert license_obj.valid_until is not None

    @patch("apps.subscriptions.views.stripe.Webhook.construct_event")
    @override_settings(STRIPE_WEBHOOK_SECRET="whsec_test")
    def test_checkout_completed_ignores_subscription_mode(self, mock_construct):
        mock_construct.return_value = {
            "type": "checkout.session.completed",
            "data": {"object": {
                "id": "cs_sub",
                "mode": "subscription",
                "metadata": {"plan": "club_monthly"},
            }},
        }
        resp = self._post_webhook(APIClient())
        assert resp.status_code == 200  # no crash

    @patch("apps.subscriptions.views.stripe.Webhook.construct_event")
    @override_settings(STRIPE_WEBHOOK_SECRET="whsec_test")
    def test_payment_intent_activates_license_fallback(self, mock_construct, user):
        tournament = TournamentFactory(club__owner=user)
        TournamentLicense.objects.create(
            user=user,
            tournament=tournament,
            is_active=False,
        )

        mock_construct.return_value = {
            "type": "payment_intent.succeeded",
            "data": {"object": {
                "id": "pi_fallback_456",
                "metadata": {
                    "plan": "one_shot",
                    "tournament_id": str(tournament.id),
                },
            }},
        }

        resp = self._post_webhook(APIClient())
        assert resp.status_code == 200

        lic = TournamentLicense.objects.get(tournament=tournament)
        assert lic.is_active is True
        assert lic.stripe_payment_intent_id == "pi_fallback_456"

    @patch("apps.subscriptions.views.stripe.Webhook.construct_event")
    @override_settings(STRIPE_WEBHOOK_SECRET="whsec_test")
    def test_payment_intent_skips_already_active(self, mock_construct, user):
        tournament = TournamentFactory(club__owner=user)
        TournamentLicense.objects.create(
            user=user,
            tournament=tournament,
            is_active=True,
            stripe_payment_intent_id="pi_original",
        )

        mock_construct.return_value = {
            "type": "payment_intent.succeeded",
            "data": {"object": {
                "id": "pi_duplicate",
                "metadata": {
                    "plan": "one_shot",
                    "tournament_id": str(tournament.id),
                },
            }},
        }

        resp = self._post_webhook(APIClient())
        assert resp.status_code == 200

        lic = TournamentLicense.objects.get(tournament=tournament)
        assert lic.stripe_payment_intent_id == "pi_original"  # not overwritten

    @patch("apps.subscriptions.views.stripe.Webhook.construct_event")
    @override_settings(STRIPE_WEBHOOK_SECRET="whsec_test")
    def test_license_validity_with_end_date(self, mock_construct, user):
        """License valid_until = tournament.end_date + 30 days."""
        from datetime import date
        tournament = TournamentFactory(
            club__owner=user,
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 2),
        )
        TournamentLicense.objects.create(
            user=user,
            tournament=tournament,
            stripe_checkout_session_id="cs_val",
            is_active=False,
        )

        mock_construct.return_value = {
            "type": "checkout.session.completed",
            "data": {"object": {
                "id": "cs_val",
                "mode": "payment",
                "payment_intent": "pi_val",
                "metadata": {
                    "plan": "one_shot",
                    "tournament_id": str(tournament.id),
                },
            }},
        }

        self._post_webhook(APIClient())

        lic = TournamentLicense.objects.get(tournament=tournament)
        assert lic.valid_until.date() == date(2026, 7, 2)  # end_date + 30


# ─── Expire Licenses Task Tests ──────────────────────────────────────────────


@pytest.mark.django_db
class TestExpireLicensesTask:
    def test_expires_past_due_licenses(self):
        from apps.subscriptions.tasks import expire_licenses
        from datetime import timedelta

        user = UserFactory()
        t1 = TournamentFactory(club__owner=user)
        t2 = TournamentFactory(club__owner=user)

        # Expired license
        TournamentLicense.objects.create(
            user=user, tournament=t1,
            is_active=True,
            valid_until=timezone.now() - timedelta(days=1),
        )
        # Still valid license
        TournamentLicense.objects.create(
            user=user, tournament=t2,
            is_active=True,
            valid_until=timezone.now() + timedelta(days=30),
        )

        count = expire_licenses()
        assert count == 1
        assert TournamentLicense.objects.get(tournament=t1).is_active is False
        assert TournamentLicense.objects.get(tournament=t2).is_active is True

    def test_ignores_already_inactive(self):
        from apps.subscriptions.tasks import expire_licenses
        from datetime import timedelta

        user = UserFactory()
        t = TournamentFactory(club__owner=user)
        TournamentLicense.objects.create(
            user=user, tournament=t,
            is_active=False,
            valid_until=timezone.now() - timedelta(days=10),
        )
        count = expire_licenses()
        assert count == 0

    def test_ignores_null_valid_until(self):
        from apps.subscriptions.tasks import expire_licenses

        user = UserFactory()
        t = TournamentFactory(club__owner=user)
        TournamentLicense.objects.create(
            user=user, tournament=t,
            is_active=True,
            valid_until=None,
        )
        count = expire_licenses()
        assert count == 0


# ─── Tournament Plan View Tests ──────────────────────────────────────────────


@pytest.mark.django_db
class TestTournamentPlanView:
    def test_returns_free_for_no_license(self, api, user):
        tournament = TournamentFactory(club__owner=user)
        resp = api.get(f"/api/v1/subscriptions/tournament/{tournament.id}/plan/")
        assert resp.status_code == 200
        assert resp.data["plan"] == "FREE"

    def test_returns_one_shot_with_active_license(self, api, user):
        tournament = TournamentFactory(club__owner=user)
        TournamentLicense.objects.create(
            user=user, tournament=tournament, is_active=True,
        )
        resp = api.get(f"/api/v1/subscriptions/tournament/{tournament.id}/plan/")
        assert resp.status_code == 200
        assert resp.data["plan"] == "ONE_SHOT"

    def test_returns_club_for_club_subscriber(self, api, user):
        Subscription.objects.filter(user=user).delete()
        Subscription.objects.create(
            user=user,
            plan=Subscription.Plan.CLUB_MONTHLY,
            status=Subscription.Status.ACTIVE,
        )
        tournament = TournamentFactory(club__owner=user)
        resp = api.get(f"/api/v1/subscriptions/tournament/{tournament.id}/plan/")
        assert resp.status_code == 200
        assert resp.data["plan"] == "CLUB"

    def test_returns_404_for_nonexistent_tournament(self, api):
        import uuid
        resp = api.get(f"/api/v1/subscriptions/tournament/{uuid.uuid4()}/plan/")
        assert resp.status_code == 404

    def test_requires_auth(self):
        client = APIClient()
        import uuid
        resp = client.get(f"/api/v1/subscriptions/tournament/{uuid.uuid4()}/plan/")
        assert resp.status_code in (401, 403)


# ─── Plans Logic Tests ───────────────────────────────────────────────────────


@pytest.mark.django_db
class TestPlansLogic:
    def test_free_user_cannot_use_premium_features(self):
        from apps.subscriptions.plans import can_use_feature
        user = UserFactory()
        assert can_use_feature(user, "knockout_phase") is False
        assert can_use_feature(user, "pdf_kit") is False
        assert can_use_feature(user, "club_branding") is False

    def test_club_user_can_use_all_features(self):
        from apps.subscriptions.plans import can_use_feature, CLUB_FEATURES
        user = UserFactory()
        Subscription.objects.create(
            user=user,
            plan=Subscription.Plan.CLUB_MONTHLY,
            status=Subscription.Status.ACTIVE,
        )
        for feat in CLUB_FEATURES:
            assert can_use_feature(user, feat) is True

    def test_one_shot_excludes_club_only_features(self):
        from apps.subscriptions.plans import can_use_feature
        user = UserFactory()
        tournament = TournamentFactory(club__owner=user)
        TournamentLicense.objects.create(user=user, tournament=tournament, is_active=True)
        assert can_use_feature(user, "knockout_phase", tournament) is True
        assert can_use_feature(user, "club_branding", tournament) is False

    def test_check_free_limits_teams(self):
        from apps.subscriptions.plans import check_free_limits, FREE_LIMITS
        user = UserFactory()
        tournament = TournamentFactory(club__owner=user)
        cat = CategoryFactory(tournament=tournament)
        for _ in range(FREE_LIMITS.max_teams_per_tournament + 1):
            TeamFactory(tournament=tournament, category=cat)
        violations = check_free_limits(user, tournament)
        assert len(violations) >= 1
        assert "équipes" in violations[0]

    def test_check_free_limits_ok_when_within(self):
        from apps.subscriptions.plans import check_free_limits
        user = UserFactory()
        tournament = TournamentFactory(club__owner=user)
        violations = check_free_limits(user, tournament)
        assert violations == []

    def test_check_can_create_tournament_free_limit(self):
        from apps.subscriptions.plans import check_can_create_tournament
        user = UserFactory()
        club = ClubFactory(owner=user)
        TournamentFactory(club=club, status="draft")
        error = check_can_create_tournament(user)
        assert error is not None
        assert "limité" in error

    def test_check_can_create_tournament_club_unlimited(self):
        from apps.subscriptions.plans import check_can_create_tournament
        user = UserFactory()
        Subscription.objects.create(
            user=user,
            plan=Subscription.Plan.CLUB_MONTHLY,
            status=Subscription.Status.ACTIVE,
        )
        club = ClubFactory(owner=user)
        TournamentFactory(club=club, status="draft")
        TournamentFactory(club=club, status="draft")
        error = check_can_create_tournament(user)
        assert error is None
