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
    *,
    explain: bool = False,
) -> float | dict | None:
    """Return None if a hard constraint is violated, else a score (higher = better).

    When explain=True, returns a dict with "score" and "penalties" details
    instead of a bare float.

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

    # 5b. Forced date (phase separation next_day mode)
    if match.forced_date and start_time.date() != match.forced_date:
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
    penalties: list[dict] = [] if explain else []

    # A. Field load balancing — penalise overloaded fields (> 115% of average)
    load_ratio = context.field_load_ratio(field_id)
    if load_ratio > 1.15:
        amount = (load_ratio - 1.15) * 80
        score -= amount
        if explain:
            fname = (
                context.fields[field_id].name
                if field_id in context.fields
                else str(field_id)
            )
            penalties.append({
                "type": "field_imbalance",
                "amount": round(-amount, 1),
                "detail": f"Terrain {fname} surchargé ({load_ratio:.0%} de la moyenne).",
            })

    # B. Team rest quality — penalise too-short or too-long rest
    ideal_rest = match.rest_needed * 1.5
    for team_id in (match.team_home_id, match.team_away_id):
        if team_id:
            actual_rest = context.time_since_last_match(team_id, start_time)
            tname = (
                context.teams[team_id].name
                if explain and team_id in context.teams
                else str(team_id)
            )
            if actual_rest == float("inf"):
                pass  # First match for this team — no penalty
            elif actual_rest < ideal_rest:
                amount = (ideal_rest - actual_rest) * 0.5
                score -= amount
                if explain:
                    penalties.append({
                        "type": "short_rest",
                        "amount": round(-amount, 1),
                        "detail": (
                            f"L'équipe {tname} n'a que {actual_rest:.0f} min de repos "
                            f"avant ce match (idéal: {ideal_rest:.0f} min)."
                        ),
                    })
            elif actual_rest > 180:
                amount = (actual_rest - 180) * 0.3
                score -= amount
                if explain:
                    penalties.append({
                        "type": "long_wait",
                        "amount": round(-amount, 1),
                        "detail": (
                            f"L'équipe {tname} attend {actual_rest:.0f} min "
                            f"entre deux matchs."
                        ),
                    })

    # C. Category schedule compactness — penalise large gaps between category matches
    gap = context.gap_in_category_schedule(match.category_id, start_time)
    if gap > 0:
        amount = gap * 0.4
        score -= amount
        if explain and amount > 1:
            penalties.append({
                "type": "category_gap",
                "amount": round(-amount, 1),
                "detail": f"Écart de {gap:.0f} min dans le planning de cette catégorie.",
            })

    # D. Soft constraint bonuses
    for constraint in context.soft_constraints_for_match(match):
        if context.constraint_matches_placement(constraint, field_id, start_time):
            score += 30
            if explain:
                penalties.append({
                    "type": "soft_constraint_bonus",
                    "amount": 30,
                    "detail": f"Contrainte souple satisfaite : {constraint.name}.",
                })

    # E. Finals prefer later in the day
    if match.phase == "final":
        hour = start_time.hour
        bonus = (hour - 9) * 5
        score += bonus
        if explain and bonus != 0:
            penalties.append({
                "type": "final_time_preference",
                "amount": round(bonus, 1),
                "detail": f"La finale est placée à {hour}h (bonus horaire).",
            })

    # F. Youth categories prefer mornings — penalise afternoon
    if context.category_is_youth(match.category_id):
        if start_time.hour >= 14:
            score -= 50
            if explain:
                penalties.append({
                    "type": "youth_afternoon",
                    "amount": -50,
                    "detail": "Catégorie jeune placée l'après-midi (préférence matin).",
                })

    if explain:
        return {"score": score, "penalties": penalties}
    return score
