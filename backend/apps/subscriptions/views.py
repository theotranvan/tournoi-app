"""Subscription views — checkout, portal, status, webhook."""

import logging
from datetime import datetime, timezone

import stripe
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Subscription
from .serializers import SubscriptionSerializer

logger = logging.getLogger(__name__)

stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", "")

PRICE_MAP = {
    "monthly": getattr(settings, "STRIPE_PRICE_MONTHLY", ""),
    "yearly": getattr(settings, "STRIPE_PRICE_YEARLY", ""),
}


def _get_or_create_subscription(user) -> Subscription:
    sub, _ = Subscription.objects.get_or_create(user=user)
    return sub


def _get_or_create_customer(user, subscription: Subscription) -> str:
    if subscription.stripe_customer_id:
        return subscription.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email,
        name=user.get_full_name() or user.username,
        metadata={"user_id": str(user.id)},
    )
    subscription.stripe_customer_id = customer.id
    subscription.save(update_fields=["stripe_customer_id"])
    return customer.id


class SubscriptionStatusView(APIView):
    """GET /api/v1/subscriptions/status/ — Return current subscription."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        sub = _get_or_create_subscription(request.user)
        return Response(SubscriptionSerializer(sub).data)


class CreateCheckoutView(APIView):
    """POST /api/v1/subscriptions/checkout/ — Create Stripe Checkout Session."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan = request.data.get("plan", "monthly")
        price_id = PRICE_MAP.get(plan)
        if not price_id:
            return Response(
                {"error": "Plan invalide. Choisissez 'monthly' ou 'yearly'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sub = _get_or_create_subscription(request.user)
        customer_id = _get_or_create_customer(request.user, sub)

        frontend_url = settings.FRONTEND_URL
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{frontend_url}/admin?subscription=success",
            cancel_url=f"{frontend_url}/admin/abonnement?canceled=true",
            metadata={"user_id": str(request.user.id), "plan": plan},
        )

        return Response({"checkout_url": session.url})


class CustomerPortalView(APIView):
    """POST /api/v1/subscriptions/portal/ — Open Stripe Customer Portal."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        sub = _get_or_create_subscription(request.user)
        if not sub.stripe_customer_id:
            return Response(
                {"error": "Aucun abonnement Stripe trouvé."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        frontend_url = settings.FRONTEND_URL
        session = stripe.billing_portal.Session.create(
            customer=sub.stripe_customer_id,
            return_url=f"{frontend_url}/admin/abonnement",
        )
        return Response({"portal_url": session.url})


class StripeWebhookView(APIView):
    """POST /api/v1/subscriptions/webhook/ — Handle Stripe events."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
        webhook_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", "")

        if not webhook_secret:
            logger.warning("STRIPE_WEBHOOK_SECRET not configured")
            return Response(status=status.HTTP_400_BAD_REQUEST)

        try:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            logger.warning("Stripe webhook signature failed: %s", e)
            return Response(status=status.HTTP_400_BAD_REQUEST)

        event_type = event["type"]
        data = event["data"]["object"]

        if event_type in (
            "customer.subscription.created",
            "customer.subscription.updated",
        ):
            self._handle_subscription_update(data)
        elif event_type == "customer.subscription.deleted":
            self._handle_subscription_deleted(data)
        elif event_type == "invoice.payment_failed":
            self._handle_payment_failed(data)

        return Response({"status": "ok"})

    def _handle_subscription_update(self, stripe_sub):
        customer_id = stripe_sub["customer"]
        try:
            sub = Subscription.objects.get(stripe_customer_id=customer_id)
        except Subscription.DoesNotExist:
            logger.warning("No local subscription for customer %s", customer_id)
            return

        sub.stripe_subscription_id = stripe_sub["id"]
        sub.status = stripe_sub["status"]
        sub.cancel_at_period_end = stripe_sub.get("cancel_at_period_end", False)

        # Determine plan from price
        items = stripe_sub.get("items", {}).get("data", [])
        if items:
            price_id = items[0].get("price", {}).get("id", "")
            if price_id == PRICE_MAP.get("yearly"):
                sub.plan = Subscription.Plan.YEARLY
            elif price_id == PRICE_MAP.get("monthly"):
                sub.plan = Subscription.Plan.MONTHLY

        period_start = stripe_sub.get("current_period_start")
        period_end = stripe_sub.get("current_period_end")
        if period_start:
            sub.current_period_start = datetime.fromtimestamp(period_start, tz=timezone.utc)
        if period_end:
            sub.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)

        sub.save()
        logger.info("Subscription updated: user=%s plan=%s status=%s", sub.user_id, sub.plan, sub.status)

    def _handle_subscription_deleted(self, stripe_sub):
        customer_id = stripe_sub["customer"]
        try:
            sub = Subscription.objects.get(stripe_customer_id=customer_id)
        except Subscription.DoesNotExist:
            return

        sub.status = Subscription.Status.CANCELED
        sub.plan = Subscription.Plan.FREE
        sub.stripe_subscription_id = ""
        sub.save()
        logger.info("Subscription canceled: user=%s", sub.user_id)

    def _handle_payment_failed(self, invoice):
        customer_id = invoice.get("customer")
        if not customer_id:
            return
        try:
            sub = Subscription.objects.get(stripe_customer_id=customer_id)
        except Subscription.DoesNotExist:
            return

        sub.status = Subscription.Status.PAST_DUE
        sub.save(update_fields=["status", "updated_at"])
        logger.info("Payment failed: user=%s", sub.user_id)
