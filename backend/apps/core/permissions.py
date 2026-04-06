from rest_framework.permissions import BasePermission


class IsOrganizer(BasePermission):
    """Seuls les organisateurs et superadmins peuvent modifier."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in ("organizer", "superadmin")


class IsClubOwnerOrMember(BasePermission):
    """L'utilisateur doit être owner ou member du club concerné."""

    def has_object_permission(self, request, view, obj):
        club = getattr(obj, "club", obj)
        user = request.user
        return club.owner_id == user.id or club.members.filter(id=user.id).exists()


class IsTournamentOwner(BasePermission):
    """L'utilisateur doit être owner du club lié au tournoi."""

    def has_object_permission(self, request, view, obj):
        tournament = getattr(obj, "tournament", obj)
        return (
            tournament.club.owner_id == request.user.id
            or tournament.club.members.filter(id=request.user.id).exists()
        )
