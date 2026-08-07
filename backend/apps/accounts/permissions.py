"""Custom DRF permissions for Kickoff."""

from rest_framework.permissions import BasePermission

from apps.accounts.authentication import TeamAnonymousUser


class IsOrganizer(BasePermission):
    """User authentifié avec role organizer ou superadmin."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if isinstance(user, TeamAnonymousUser):
            return False
        return user.role in ("organizer", "superadmin")


class IsClubOwnerOrMember(BasePermission):
    """L'utilisateur est owner ou member du club."""

    def has_object_permission(self, request, view, obj):
        club = getattr(obj, "club", obj)
        user = request.user
        if isinstance(user, TeamAnonymousUser):
            return False
        return club.owner_id == user.id or club.members.filter(id=user.id).exists()


class IsTournamentOwner(BasePermission):
    """L'utilisateur est owner/member du club qui possède le tournoi."""

    def has_object_permission(self, request, view, obj):
        tournament = getattr(obj, "tournament", obj)
        user = request.user
        if isinstance(user, TeamAnonymousUser):
            return False
        return tournament.club.owner_id == user.id or tournament.club.members.filter(id=user.id).exists()


class IsPublicOrAuthenticated(BasePermission):
    """Toujours autorisé — pour les routes publiques."""

    def has_permission(self, request, view):
        return True
