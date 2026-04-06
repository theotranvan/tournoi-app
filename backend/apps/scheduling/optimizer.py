"""Two-opt local optimisation for schedule improvement."""

from __future__ import annotations

import logging

from apps.scheduling.context import SchedulingContext
from apps.scheduling.scoring import score_placement
from apps.scheduling.types import Placement

logger = logging.getLogger(__name__)


def can_swap(p1: Placement, p2: Placement, context: SchedulingContext) -> bool:
    """Check if two placements can theoretically be swapped.

    Requirements: different matches, same duration (simplifies slot compatibility).
    """
    if p1.match.provisional_id == p2.match.provisional_id:
        return False
    if p1.match.duration != p2.match.duration:
        return False
    return True


def apply_swap(
    p1: Placement,
    p2: Placement,
    new_s1: float,
    new_s2: float,
    context: SchedulingContext,
) -> None:
    """Swap field_id and start_time between two placements in-place."""
    context.remove_placement(p1)
    context.remove_placement(p2)

    old_f1, old_t1 = p1.field_id, p1.start_time
    old_f2, old_t2 = p2.field_id, p2.start_time

    p1.field_id = old_f2
    p1.start_time = old_t2
    p1.score = new_s1
    p2.field_id = old_f1
    p2.start_time = old_t1
    p2.score = new_s2

    context.commit_placement(p1)
    context.commit_placement(p2)


def two_opt_optimization(
    placements: list[Placement],
    context: SchedulingContext,
    max_iterations: int = 200,
) -> int:
    """Explore pairwise field/time swaps to improve total score.

    Returns the number of improving swaps applied.
    """
    if len(placements) < 2:
        return 0

    total_swaps = 0
    for _ in range(max_iterations):
        improved = False
        for i in range(len(placements)):
            for j in range(i + 1, len(placements)):
                p1, p2 = placements[i], placements[j]
                if not can_swap(p1, p2, context):
                    continue
                old_score = p1.score + p2.score
                new_s1 = score_placement(
                    p1.match, p2.field_id, p2.start_time, context,
                )
                new_s2 = score_placement(
                    p2.match, p1.field_id, p1.start_time, context,
                )
                if new_s1 is not None and new_s2 is not None:
                    new_score = new_s1 + new_s2
                    if new_score > old_score:
                        apply_swap(p1, p2, new_s1, new_s2, context)
                        total_swaps += 1
                        improved = True
        if not improved:
            break

    logger.debug("2-opt applied %d improving swaps", total_swaps)
    return total_swaps
