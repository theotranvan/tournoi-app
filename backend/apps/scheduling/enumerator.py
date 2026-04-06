"""Match enumerator — generates provisional matches from tournament structure."""

from __future__ import annotations

import logging
import uuid
from dataclasses import replace as dc_replace
from itertools import combinations

from apps.scheduling.types import ProvisionalMatch, SoftWarning

logger = logging.getLogger(__name__)


def enumerate_group_matches(group) -> list[ProvisionalMatch]:
    """Generate round-robin matches for a single group.

    Returns one ProvisionalMatch per pair of teams in the group.
    """
    cat = group.category
    team_ids = list(group.teams.values_list("id", flat=True))

    if len(team_ids) < 2:
        return []

    duration = cat.effective_match_duration
    transition = cat.effective_transition_time
    rest = cat.effective_rest_time
    matches: list[ProvisionalMatch] = []

    for home_id, away_id in combinations(team_ids, 2):
        matches.append(ProvisionalMatch(
            provisional_id=str(uuid.uuid4()),
            category_id=cat.id,
            group_id=group.id,
            phase="group",
            team_home_id=home_id,
            team_away_id=away_id,
            duration=duration,
            transition=transition,
            rest_needed=rest,
        ))

    return matches


def enumerate_bracket_matches(
    category,
    num_groups: int,
    group_names: list[str],
) -> list[ProvisionalMatch]:
    """Generate knockout-phase placeholder matches based on number of groups.

    - 2 groups → 2 semi-finals + third-place + final
    - 3-4 groups → 4 quarter-finals + 2 semis + third-place + final
    - 5-8 groups → 8 round-of-16 + 4 quarters + 2 semis + third-place + final
    """
    if num_groups < 2:
        return []

    duration = category.effective_match_duration
    transition = category.effective_transition_time
    rest = category.effective_rest_time
    cat_id = category.id
    matches: list[ProvisionalMatch] = []

    def _ph(phase: str, home: str, away: str) -> ProvisionalMatch:
        return ProvisionalMatch(
            provisional_id=str(uuid.uuid4()),
            category_id=cat_id,
            group_id=None,
            phase=phase,
            team_home_id=None,
            team_away_id=None,
            placeholder_home=home,
            placeholder_away=away,
            duration=duration,
            transition=transition,
            rest_needed=rest,
        )

    if num_groups == 2:
        matches.append(_ph("semi", f"1er {group_names[0]}", f"2e {group_names[1]}"))
        matches.append(_ph("semi", f"1er {group_names[1]}", f"2e {group_names[0]}"))
        matches.append(_ph("third", "Perdant D1", "Perdant D2"))
        matches.append(_ph("final", "Vainqueur D1", "Vainqueur D2"))

    elif num_groups <= 4:
        # Quarter-finals
        matchups: list[tuple[str, str]] = []
        for i in range(min(num_groups, 4)):
            opp = (i + 1) % min(num_groups, 4)
            if i < opp:
                matchups.append((f"1er {group_names[i]}", f"2e {group_names[opp]}"))
                matchups.append((f"1er {group_names[opp]}", f"2e {group_names[i]}"))
        seen: set[tuple[str, str]] = set()
        qf_list: list[tuple[str, str]] = []
        for h, a in matchups:
            key = (h, a)
            if key not in seen:
                seen.add(key)
                qf_list.append((h, a))
        for h, a in qf_list[:4]:
            matches.append(_ph("quarter", h, a))
        for i in range(2):
            matches.append(_ph("semi", f"Vainqueur QF{2*i+1}", f"Vainqueur QF{2*i+2}"))
        matches.append(_ph("third", "Perdant D1", "Perdant D2"))
        matches.append(_ph("final", "Vainqueur D1", "Vainqueur D2"))

    else:
        # 5-8 groups → round of 16
        r16_count = min(num_groups * 2, 8)
        for i in range(r16_count):
            gi = i % num_groups
            rank = "1er" if i < num_groups else "2e"
            opp_gi = (num_groups - 1 - i) % num_groups
            opp_rank = "2e" if i < num_groups else "1er"
            matches.append(_ph(
                "r16",
                f"{rank} {group_names[gi]}",
                f"{opp_rank} {group_names[opp_gi]}",
            ))
        for i in range(4):
            matches.append(_ph("quarter", f"Vainqueur R16-{2*i+1}", f"Vainqueur R16-{2*i+2}"))
        for i in range(2):
            matches.append(_ph("semi", f"Vainqueur QF{2*i+1}", f"Vainqueur QF{2*i+2}"))
        matches.append(_ph("third", "Perdant D1", "Perdant D2"))
        matches.append(_ph("final", "Vainqueur D1", "Vainqueur D2"))

    return matches


def enumerate_tournament_matches(tournament) -> tuple[list[ProvisionalMatch], list[SoftWarning]]:
    """Enumerate all provisional matches for an entire tournament.

    Returns (matches, warnings) where warnings may include single-team groups etc.
    """
    from apps.teams.models import Group

    groups = (
        Group.objects.filter(category__tournament=tournament)
        .prefetch_related("teams")
        .select_related("category")
    )

    matches: list[ProvisionalMatch] = []
    warnings: list[SoftWarning] = []
    categories_with_groups: dict[int, list] = {}

    for group in groups:
        team_ids = list(group.teams.values_list("id", flat=True))

        if len(team_ids) < 2:
            if len(team_ids) == 1:
                warnings.append(SoftWarning(
                    type="single_team_group",
                    message=f"Poule {group.name} de {group.category.name} n'a qu'une seule équipe.",
                    affected_team_id=team_ids[0],
                ))
            continue

        categories_with_groups.setdefault(group.category_id, []).append(group)
        matches.extend(enumerate_group_matches(group))

    # Knockout phases per category
    for cat_id, grps in categories_with_groups.items():
        cat = grps[0].category
        group_names = [g.name for g in sorted(grps, key=lambda g: g.display_order)]
        bracket_matches = enumerate_bracket_matches(cat, len(grps), group_names)

        # Apply knockout rest multiplier if mode is 'same_day_rest'
        if getattr(tournament, "phase_separation_mode", "none") == "same_day_rest":
            multiplier = getattr(tournament, "knockout_rest_multiplier", 3)
            bracket_matches = [
                dc_replace(m, rest_needed=m.rest_needed * multiplier)
                for m in bracket_matches
            ]

        matches.extend(bracket_matches)

    # Sort: group phase first, then by phase order
    phase_order = {"group": 0, "r16": 1, "quarter": 2, "semi": 3, "third": 4, "final": 5}
    matches.sort(key=lambda m: (phase_order.get(m.phase, 9), m.category_id))

    return matches, warnings
