"""Subscription views — checkout, portal, status, webhook for Footix pricing."""

import logging
from datetime import datetime, timedelta, timezone

import stripe
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tournaments.models import Tournament

from .models import Subscription, TournamentLicense
from .plans import get_effective_plan
from .serializers import SubscriptionSerializer, TournamentLicenseSerializer

logger = logging.getLogger(__name__)

stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", "")

# Legacy subscription prices (kept for old subscribers)
PRICE_MAP: dict[str, str] = {
    "monthly": getattr(settings, "STRIPE_PRICE_MONTHLY", ""),
    "yearly": getattr(settings, "STRIPE_PRICE_YEARLY", ""),
}

# New pricing v2
PRICE_CLUB_MONTHLY = getattr(settings, "STRIPE_PRICE_CLUB_MONTHLY", "")
PRICE_CLUB_YEARLY = getattr(settings, "STRIPE_PRICE_CLUB_YEARLY", "")
PRICE_ONE_SHOT = getattr(settings, "STRIPE_PRICE_ONE_SHOT", "")

CLUB_PRICE_MAP: dict[str, str] = {
    "club_monthly": PRICE_CLUB_MONTHLY,
    "club_yearly": PRICE_CLUB_YEARLY,
}


def _get_or_create_subscription(user) -> Subscription:
    sub, _ = Subscription.objects.get_or_create(user=user)
    return sub


def _get_or_create_customer_id(user) -> str:
    """Ensure user has a stripe_customer_id (via Subscription record)."""
    sub = _get_or_create_subscription(user)
    if sub.stripe_customer_id:
        return sub.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email,
        name=user.get_full_name() or user.username,
        metadata={"user_id": str(user.id)},
    )
    sub.stripe_customer_id = customer.id
    sub.save(update_fields=["stripe_customer_id"])
    return customer.id


# ─── Status ──────────────────────────────────────────────────────────────────


class SubscriptionStatusView(APIView):
    """GET /api/v1/subscriptions/status/ — Return current subscription + licenses."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        sub = _get_or_create_subscription(request.user)
        licenses = TournamentLicense.objects.filter(
            user=request.user, is_active=True
        ).select_related("tournament")
        return Response(
            {
                "subscription": SubscriptionSerializer(sub).data,
                "licenses": TournamentLicenseSerializer(licenses, many=True).data,
            }
        )


class TournamentPlanView(APIView):
    """GET /api/v1/subscriptions/tournament/<uuid>/plan/ — effective plan for a tournament."""

    permission_classes = [IsAuthenticated]

    def get(self, request, tournament_id):
        try:
            tournament = Tournament.objects.get(pk=tournament_id)
        except Tournament.DoesNotExist:
            return Response({"error": "Tournoi introuvable."}, status=status.HTTP_404_NOT_FOUND)
        plan = get_effective_plan(request.user, tournament)
        return Response({"plan": plan, "tournament_id": str(tournament_id)})


# ─── Checkout ────────────────────────────────────────────────────────────────


class CreateCheckoutView(APIView):
    """POST /api/v1/subscriptions/checkout/ — Create Stripe Checkout Session.

    Body:
      CLUB:     { "plan": "club_monthly" | "club_yearly" }
      ONE_SHOT: { "plan": "one_shot", "tournament_id": "<uuid>" }
      Legacy:   { "plan": "monthly" | "yearly" }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan = request.data.get("plan", "")
        frontend_url = settings.FRONTEND_URL

        # Validate plan early — before any Stripe call
        valid_plans = {"one_shot"} | set(CLUB_PRICE_MAP.keys()) | set(PRICE_MAP.keys())
        if plan not in valid_plans:
            return Response(
                {"error": "Plan invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        customer_id = _get_or_create_customer_id(request.user)

        # ── ONE_SHOT (payment mode) ─────────────────────────────────────
        if plan == "one_shot":
            return self._checkout_one_shot(request, customer_id, frontend_url)

        # ── CLUB (subscription mode) ────────────────────────────────────
        if plan in CLUB_PRICE_MAP:
            price_id = CLUB_PRICE_MAP[plan]
            if not price_id:
                return Response(
                    {"error": f"Stripe price non configuré pour {plan}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                mode="subscription",
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=f"{frontend_url}/admin?subscription=success",
                cancel_url=f"{frontend_url}/pricing?canceled=true",
                metadata={"user_id": str(request.user.id), "plan": plan},
            )
            return Response({"checkout_url": session.url})

        # ── Legacy plans (monthly/yearly) ───────────────────────────────
        price_id = PRICE_MAP.get(plan)
        if not price_id:
            return Response(
                {"error": "Plan invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )
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

    def _checkout_one_shot(self, request, customer_id: str, frontend_url: str):
        tournament_id = request.data.get("tournament_id")
        if not tournament_id:
            return Response(
                {"error": "tournament_id requis pour le plan one_shot."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            tournament = Tournament.objects.get(pk=tournament_id)
        except Tournament.DoesNotExist:
            return Response(
                {"error": "Tournoi introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not PRICE_ONE_SHOT:
            return Response(
                {"error": "Stripe price non configuré pour one_shot."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create or retrieve pending license
        license_obj, _ = TournamentLicense.objects.get_or_create(
            tournament=tournament,
            defaults={"user": request.user, "stripe_customer_id": customer_id},
        )
        if license_obj.is_active:
            return Response(
                {"error": "Ce tournoi a déjà une licence active."},
                status=status.HTTP_409_CONFLICT,
            )

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            mode="payment",
            line_items=[{"price": PRICE_ONE_SHOT, "quantity": 1}],
            success_url=f"{frontend_url}/admin/tournois/{tournament_id}?license=success",
            cancel_url=f"{frontend_url}/pricing?canceled=true",
            metadata={
                "user_id": str(request.user.id),
                "plan": "one_shot",
                "tournament_id": str(tournament_id),
            },
        )
        license_obj.stripe_checkout_session_id = session.id
        license_obj.save(update_fields=["stripe_checkout_session_id", "updated_at"])

        return Response({"checkout_url": session.url})


# ─── Portal ──────────────────────────────────────────────────────────────────


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


# ─── Webhook ─────────────────────────────────────────────────────────────────


class StripeWebhookView(APIView):
    """POST /api/v1/subscriptions/webhook/ — Handle Stripe events."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

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

        handler = {
            "customer.subscription.created": self._handle_subscription_update,
            "customer.subscription.updated": self._handle_subscription_update,
            "customer.subscription.deleted": self._handle_subscription_deleted,
            "invoice.payment_failed": self._handle_payment_failed,
            "payment_intent.succeeded": self._handle_payment_intent_succeeded,
            "checkout.session.completed": self._handle_checkout_completed,
        }.get(event_type)

        if handler:
            handler(data)

        return Response({"status": "ok"})

    # ── CLUB subscription handlers ──────────────────────────────────────

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
            if price_id == PRICE_CLUB_YEARLY:
                sub.plan = Subscription.Plan.CLUB_YEARLY
            elif price_id == PRICE_CLUB_MONTHLY:
                sub.plan = Subscription.Plan.CLUB_MONTHLY
            # Legacy fallback
            elif price_id == PRICE_MAP.get("yearly"):
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

    # ── ONE_SHOT payment handlers ───────────────────────────────────────

    def _handle_checkout_completed(self, session):
        """Activate ONE_SHOT license when checkout completes (payment mode)."""
        if session.get("mode") != "payment":
            return

        metadata = session.get("metadata", {})
        if metadata.get("plan") != "one_shot":
            return

        tournament_id = metadata.get("tournament_id")
        if not tournament_id:
            return

        try:
            license_obj = TournamentLicense.objects.get(
                tournament_id=tournament_id,
                stripe_checkout_session_id=session["id"],
            )
        except TournamentLicense.DoesNotExist:
            logger.warning("No license found for checkout session %s", session["id"])
            return

        payment_intent_id = session.get("payment_intent", "")
        self._activate_license(license_obj, payment_intent_id)

    def _handle_payment_intent_succeeded(self, payment_intent):
        """Fallback: activate license via payment_intent.succeeded."""
        metadata = payment_intent.get("metadata", {})
        if metadata.get("plan") != "one_shot":
            return

        tournament_id = metadata.get("tournament_id")
        if not tournament_id:
            return

        try:
            license_obj = TournamentLicense.objects.get(tournament_id=tournament_id)
        except TournamentLicense.DoesNotExist:
            return

        if license_obj.is_active:
            return

        self._activate_license(license_obj, payment_intent["id"])

    def _activate_license(self, license_obj: TournamentLicense, payment_intent_id: str):
        """Set validity window: from now until 30 days after tournament end."""
        tournament = license_obj.tournament
        now = datetime.now(tz=timezone.utc)
        license_obj.stripe_payment_intent_id = payment_intent_id
        license_obj.valid_from = now  # usable immediately after purchase
        # valid_until = end_date + 30 days (or start_date + 60 if no end_date)
        if tournament.end_date:
            end_date = datetime.combine(
                tournament.end_date, datetime.min.time(), tzinfo=timezone.utc
            )
            license_obj.valid_until = end_date + timedelta(days=30)
        else:
            start_date = datetime.combine(
                tournament.start_date, datetime.min.time(), tzinfo=timezone.utc
            )
            license_obj.valid_until = start_date + timedelta(days=60)
        license_obj.is_active = True
        license_obj.save()
        logger.info(
            "ONE_SHOT license activated: tournament=%s valid=%s→%s",
            tournament.id,
            license_obj.valid_from,
            license_obj.valid_until,
        )
