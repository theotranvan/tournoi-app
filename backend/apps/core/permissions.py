"""Re-export canonical permissions from accounts app.

All permission classes live in ``apps.accounts.permissions`` which
properly guards against ``TeamAnonymousUser`` tokens.
"""

from apps.accounts.permissions import (  # noqa: F401
    IsClubOwnerOrMember,
    IsOrganizer,
    IsTournamentOwner,
)

__all__ = ["IsOrganizer", "IsClubOwnerOrMember", "IsTournamentOwner"]
