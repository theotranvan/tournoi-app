"""
Footix pricing plans — central source of truth for features & limits.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from django.db.models import Q

if TYPE_CHECKING:
    from apps.tournaments.models import Tournament
    from django.contrib.auth.models import AbstractUser


# ── Feature keys ─────────────────────────────────────────────────────────────

FEATURES = {
    "knockout_phase",
    "pdf_kit",
    "insights",
    "push_notifications",
    "multi_day",
    "speaker_mode",
    "multi_year_history",
    "club_branding",
    "full_export",
}

# ── Plan definitions ─────────────────────────────────────────────────────────

FREE_FEATURES: set[str] = set()  # no premium features

ONE_SHOT_FEATURES: set[str] = {
    "knockout_phase",
    "pdf_kit",
    "insights",
    "push_notifications",
    "multi_day",
    "speaker_mode",
}

CLUB_FEATURES: set[str] = ONE_SHOT_FEATURES | {
    "multi_year_history",
    "club_branding",
    "full_export",
}


@dataclass(frozen=True)
class FreeLimits:
    max_active_tournaments: int = 1
    max_teams_per_tournament: int = 16
    max_categories_per_tournament: int = 2
    max_fields_per_tournament: int = 3


FREE_LIMITS = FreeLimits()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_subscription(user: AbstractUser):
    from apps.subscriptions.models import Subscription
    try:
        return user.subscription  # type: ignore[union-attr]
    except Subscription.DoesNotExist:
        return None


def _get_license(tournament: Tournament):
    from apps.subscriptions.models import TournamentLicense
    try:
        return tournament.license  # type: ignore[union-attr]
    except TournamentLicense.DoesNotExist:
        return None


def get_effective_plan(user: AbstractUser, tournament: Tournament | None = None) -> str:
    """Return the effective plan for a user+tournament combo: 'CLUB', 'ONE_SHOT', or 'FREE'."""
    sub = _get_subscription(user)
    if sub and sub.is_club:
        return "CLUB"

    if tournament:
        lic = _get_license(tournament)
        if lic and lic.is_valid:
            return "ONE_SHOT"

    return "FREE"


def can_use_feature(user: AbstractUser, feature: str, tournament: Tournament | None = None) -> bool:
    """Check if a user can use a given premium feature."""
    plan = get_effective_plan(user, tournament)
    if plan == "CLUB":
        return feature in CLUB_FEATURES
    if plan == "ONE_SHOT":
        return feature in ONE_SHOT_FEATURES
    return feature in FREE_FEATURES


def check_free_limits(user: AbstractUser, tournament: Tournament | None = None) -> list[str]:
    """
    Return a list of limit violations for FREE plan users.
    Empty list = all within limits. Each string explains the violation.
    """
    plan = get_effective_plan(user, tournament)
    if plan != "FREE":
        return []

    violations: list[str] = []

    if tournament:
        team_count = tournament.teams.count()
        if team_count > FREE_LIMITS.max_teams_per_tournament:
            violations.append(
                f"Le plan gratuit est limité à {FREE_LIMITS.max_teams_per_tournament} équipes "
                f"par tournoi ({team_count} actuellement)."
            )

        cat_count = tournament.categories.count()
        if cat_count > FREE_LIMITS.max_categories_per_tournament:
            violations.append(
                f"Le plan gratuit est limité à {FREE_LIMITS.max_categories_per_tournament} catégories "
                f"par tournoi ({cat_count} actuellement)."
            )

        field_count = tournament.fields.count()
        if field_count > FREE_LIMITS.max_fields_per_tournament:
            violations.append(
                f"Le plan gratuit est limité à {FREE_LIMITS.max_fields_per_tournament} terrains "
                f"par tournoi ({field_count} actuellement)."
            )

    return violations


def check_can_create_tournament(user: AbstractUser) -> str | None:
    """
    Return an error message if the user cannot create a new tournament, or None if OK.
    """
    from apps.subscriptions.models import Subscription
    from apps.tournaments.models import Tournament

    sub = _get_subscription(user)
    if sub and sub.is_club:
        return None  # unlimited

    # Count active tournaments (not archived/finished)
    active_statuses = [
        Tournament.Status.DRAFT,
        Tournament.Status.PUBLISHED,
        Tournament.Status.LIVE,
    ]
    active_count = Tournament.objects.filter(
        Q(club__owner=user) | Q(club__members=user),
        status__in=active_statuses,
    ).distinct().count()

    if active_count >= FREE_LIMITS.max_active_tournaments:
        return (
            f"Le plan gratuit est limité à {FREE_LIMITS.max_active_tournaments} tournoi actif. "
            "Passe au plan Club ou achète une licence One-Shot pour ce tournoi."
        )

    return None
