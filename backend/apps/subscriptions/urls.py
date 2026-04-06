from django.urls import path

from . import views

app_name = "subscriptions"

urlpatterns = [
    path("status/", views.SubscriptionStatusView.as_view(), name="status"),
    path("checkout/", views.CreateCheckoutView.as_view(), name="checkout"),
    path("portal/", views.CustomerPortalView.as_view(), name="portal"),
    path("webhook/", views.StripeWebhookView.as_view(), name="webhook"),
    path(
        "tournament/<uuid:tournament_id>/plan/",
        views.TournamentPlanView.as_view(),
        name="tournament-plan",
    ),
]
