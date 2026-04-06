"""Tests for subscriptions app — checkout, portal, webhook, status."""

import pytest
from datetime import datetime, timezone as dt_tz
from unittest.mock import MagicMock, patch

from django.test import override_settings
from rest_framework.test import APIClient

from apps.subscriptions.models import Subscription
from tests.factories import UserFactory


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
