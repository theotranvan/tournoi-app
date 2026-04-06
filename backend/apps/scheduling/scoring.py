"""Pure scoring function for match placement evaluation.

Each penalty is documented inline. The function has NO side effects —
it only reads from the context, never writes.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from apps.scheduling.context import SchedulingContext
from apps.scheduling.types import ProvisionalMatch

logger = logging.getLogger(__name__)


def score_placement(
    match: ProvisionalMatch,
    field_id: int,
    start_time: datetime,
    context: SchedulingContext,
) -> float | None:
    """Return None if a hard constraint is violated, else a score (higher = better).

    Hard constraints (return None):
      1. Slot must fit within field availability
      2. Field must not be busy (including transition)
      3. Both teams must be free (including rest)
      4. Category time window must be respected
      5. Category allowed days must be respected
      6. Finals cannot start before groups finish + rest
      7. Admin-defined hard constraints

    Soft penalties (base 1000, subtract):
      A. Field load balancing — penalise overloaded fields
      B. Team rest quality — penalise too-short OR too-long rest
      C. Category schedule compactness — penalise large gaps
      D. Soft constraint bonuses — +30 per satisfied soft constraint
      E. Finals prefer later in the day
      F. Youth categories prefer mornings
    """
    end_time = start_time + timedelta(minutes=match.duration)

    # ── HARD CONSTRAINTS ─────────────────────────────────────────────────

    # 1. Slot must fit within field availability
    if not context.field_has_availability(field_id, start_time, end_time):
        return None

    # 2. Field must not be busy (including transition from prior match)
    if context.field_is_busy(field_id, start_time, end_time, include_transition=True):
        return None

    # 3. Both teams must be free (including rest)
    if match.team_home_id:
        if context.team_has_conflict(
            match.team_home_id, start_time, end_time, match.rest_needed,
        ):
            return None
    if match.team_away_id:
        if context.team_has_conflict(
            match.team_away_id, start_time, end_time, match.rest_needed,
        ):
            return None

    # 4. Category time window
    if not context.category_time_window_ok(match.category_id, start_time, end_time):
        return None

    # 5. Allowed days for category
    if not context.category_day_allowed(match.category_id, start_time):
        return None

    # 6. Finals cannot start before group phase finishes + rest
    if match.phase != "group":
        last_end = context.last_group_match_end(match.category_id)
        if last_end and start_time < last_end + timedelta(minutes=match.rest_needed):
            return None

    # 7. Admin-defined hard constraints
    if not context.check_hard_constraints(match, field_id, start_time):
        return None

    # ── SOFT PENALTIES (base 1000, subtract) ─────────────────────────────
    score = 1000.0

    # A. Field load balancing — penalise overloaded fields (> 115% of average)
    load_ratio = context.field_load_ratio(field_id)
    if load_ratio > 1.15:
        score -= (load_ratio - 1.15) * 80

    # B. Team rest quality — penalise too-short or too-long rest
    ideal_rest = match.rest_needed * 1.5
    for team_id in (match.team_home_id, match.team_away_id):
        if team_id:
            actual_rest = context.time_since_last_match(team_id, start_time)
            if actual_rest == float("inf"):
                pass  # First match for this team — no penalty
            elif actual_rest < ideal_rest:
                score -= (ideal_rest - actual_rest) * 0.5
            elif actual_rest > 180:
                score -= (actual_rest - 180) * 0.3

    # C. Category schedule compactness — penalise large gaps between category matches
    gap = context.gap_in_category_schedule(match.category_id, start_time)
    score -= gap * 0.4

    # D. Soft constraint bonuses
    for constraint in context.soft_constraints_for_match(match):
        if context.constraint_matches_placement(constraint, field_id, start_time):
            score += 30

    # E. Finals prefer later in the day
    if match.phase == "final":
        hour = start_time.hour
        score += (hour - 9) * 5

    # F. Youth categories prefer mornings — penalise afternoon
    if context.category_is_youth(match.category_id):
        if start_time.hour >= 14:
            score -= 50

    return score
