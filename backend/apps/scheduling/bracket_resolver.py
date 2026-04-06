"""Bracket resolver — assigns teams to knockout matches after group phase.

Logic:
- When all group matches for a category finish, resolve first-round knockout placeholders
  (e.g. "1er Poule A" → team ranked #1 in Poule A).
- When a knockout match finishes, advance the winner/loser to the next round
  (e.g. "Vainqueur D1" → winner of semi #1).
"""

from __future__ import annotations

import logging
import re

from django.db import transaction

from apps.matches.models import Match
from apps.standings.services import compute_group_standings

logger = logging.getLogger(__name__)


def _all_group_matches_finished(category) -> bool:
    """Check if all group-phase matches for a category are finished."""
    group_matches = Match.objects.filter(
        category=category, phase=Match.Phase.GROUP,
    )
    if not group_matches.exists():
        return False
    return not group_matches.exclude(status=Match.Status.FINISHED).exists()


def _get_group_team_by_rank(category, group_name: str, rank: int):
    """Get the team at a given rank in a group from standings."""
    from apps.teams.models import Group

    try:
        group = Group.objects.get(category=category, name=group_name)
    except Group.DoesNotExist:
        logger.warning("Group '%s' not found in category %s", group_name, category.name)
        return None

    standings = compute_group_standings(group.id, bypass_cache=True)
    for entry in standings:
        if entry["rank"] == rank:
            from apps.teams.models import Team
            try:
                return Team.objects.get(pk=entry["team_id"])
            except Team.DoesNotExist:
                return None
    return None


def _parse_group_placeholder(placeholder: str, category):
    """Parse placeholder like '1er Poule A' or '2e Poule B'.

    Returns (Team, True) if resolved, (None, False) if not a group placeholder.
    """
    # Match patterns: "1er Poule A", "2e Poule B", "3e Poule C", etc.
    m = re.match(r"^(\d+)(?:er|e|ème) (.+)$", placeholder.strip())
    if not m:
        return None, False

    rank = int(m.group(1))
    group_name = m.group(2).strip()
    team = _get_group_team_by_rank(category, group_name, rank)
    return team, True


def _parse_knockout_placeholder(placeholder: str, category):
    """Parse placeholder like 'Vainqueur D1', 'Perdant D2', 'Vainqueur QF1'.

    Returns (Team, True) if resolved, (None, False) if not a knockout placeholder.
    """
    # "Vainqueur D1" / "Perdant D1" — semi match index
    m = re.match(r"^(Vainqueur|Perdant) D(\d+)$", placeholder.strip())
    if m:
        role = m.group(1)  # Vainqueur or Perdant
        semi_index = int(m.group(2))
        return _resolve_semi_result(category, semi_index, role), True

    # "Vainqueur QF1" / "Perdant QF1" — quarter match index
    m = re.match(r"^(Vainqueur|Perdant) QF(\d+)$", placeholder.strip())
    if m:
        role = m.group(1)
        qf_index = int(m.group(2))
        return _resolve_phase_result(category, Match.Phase.QUARTER, qf_index, role), True

    # "Vainqueur R16-1" — round of 16 match index
    m = re.match(r"^(Vainqueur|Perdant) R16-(\d+)$", placeholder.strip())
    if m:
        role = m.group(1)
        r16_index = int(m.group(2))
        return _resolve_phase_result(category, Match.Phase.ROUND_OF_16, r16_index, role), True

    return None, False


def _resolve_semi_result(category, semi_index: int, role: str):
    """Resolve winner/loser of semi-final #semi_index."""
    semis = list(
        Match.objects.filter(
            category=category, phase=Match.Phase.SEMI,
        ).order_by("start_time", "created_at")
    )
    if semi_index < 1 or semi_index > len(semis):
        return None
    match = semis[semi_index - 1]
    return _get_match_result(match, role)


def _resolve_phase_result(category, phase: str, index: int, role: str):
    """Resolve winner/loser of a specific phase match by index."""
    matches = list(
        Match.objects.filter(
            category=category, phase=phase,
        ).order_by("start_time", "created_at")
    )
    if index < 1 or index > len(matches):
        return None
    match = matches[index - 1]
    return _get_match_result(match, role)


def _get_match_result(match, role: str):
    """Get winner or loser of a finished match."""
    if match.status != Match.Status.FINISHED:
        return None
    if match.score_home is None or match.score_away is None:
        return None
    if match.score_home > match.score_away:
        winner, loser = match.team_home, match.team_away
    elif match.score_away > match.score_home:
        winner, loser = match.team_away, match.team_home
    else:
        # Draw in knockout — home team advances by default
        winner, loser = match.team_home, match.team_away

    return winner if role == "Vainqueur" else loser


@transaction.atomic
def resolve_group_to_knockout(category) -> int:
    """Assign teams to first-round knockout matches based on group standings.

    Returns the number of matches updated.
    """
    if not _all_group_matches_finished(category):
        return 0

    # Find knockout matches with unresolved placeholders
    knockout_matches = Match.objects.filter(
        category=category,
        team_home__isnull=True,
    ).exclude(phase=Match.Phase.GROUP).select_for_update()

    updated = 0
    for match in knockout_matches:
        changed = False

        if match.placeholder_home and not match.team_home:
            team, is_group = _parse_group_placeholder(match.placeholder_home, category)
            if is_group and team:
                match.team_home = team
                changed = True

        if match.placeholder_away and not match.team_away:
            team, is_group = _parse_group_placeholder(match.placeholder_away, category)
            if is_group and team:
                match.team_away = team
                changed = True

        if changed:
            match.save(update_fields=["team_home", "team_away", "updated_at"])
            updated += 1
            logger.info(
                "Bracket resolved: %s → %s vs %s",
                match.id, match.display_home, match.display_away,
            )

    return updated


@transaction.atomic
def advance_knockout_winner(finished_match) -> int:
    """After a knockout match finishes, advance winner/loser to the next round.

    Returns the number of matches updated.
    """
    if finished_match.phase == Match.Phase.GROUP:
        return 0

    category = finished_match.category

    # Find matches that reference this match's result via placeholders
    next_matches = Match.objects.filter(
        category=category,
    ).exclude(
        phase=Match.Phase.GROUP,
    ).filter(
        team_home__isnull=True,
    ) | Match.objects.filter(
        category=category,
    ).exclude(
        phase=Match.Phase.GROUP,
    ).filter(
        team_away__isnull=True,
    )

    next_matches = next_matches.select_for_update()

    updated = 0
    for match in next_matches:
        changed = False

        if match.placeholder_home and not match.team_home:
            team, is_ko = _parse_knockout_placeholder(match.placeholder_home, category)
            if is_ko and team:
                match.team_home = team
                changed = True

        if match.placeholder_away and not match.team_away:
            team, is_ko = _parse_knockout_placeholder(match.placeholder_away, category)
            if is_ko and team:
                match.team_away = team
                changed = True

        if changed:
            match.save(update_fields=["team_home", "team_away", "updated_at"])
            updated += 1
            logger.info(
                "Knockout advanced: %s → %s vs %s",
                match.id, match.display_home, match.display_away,
            )

    return updated


def resolve_brackets(tournament) -> dict:
    """Resolve all bracket matches for all categories in a tournament.

    Returns summary dict.
    """
    results = {"categories": {}, "total_updated": 0}

    for category in tournament.categories.all():
        group_resolved = resolve_group_to_knockout(category)

        # Also try to advance any finished knockout matches
        ko_resolved = 0
        finished_ko = Match.objects.filter(
            category=category,
            status=Match.Status.FINISHED,
        ).exclude(phase=Match.Phase.GROUP)
        for m in finished_ko:
            ko_resolved += advance_knockout_winner(m)

        total = group_resolved + ko_resolved
        results["categories"][category.name] = {
            "group_resolved": group_resolved,
            "knockout_advanced": ko_resolved,
        }
        results["total_updated"] += total

    return results
