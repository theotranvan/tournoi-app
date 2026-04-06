from django.urls import path

from apps.accounts.views import (
    LoginView,
    MeView,
    RefreshView,
    RegisterView,
    TeamAccessView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("team-access/", TeamAccessView.as_view(), name="auth-team-access"),
    path("me/", MeView.as_view(), name="auth-me"),
]
