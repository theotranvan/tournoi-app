"""Scheduling engine — orchestrates match generation and placement.

Inspired by the proven algorithm from tournoi-exemple which handles 300+ teams.
Key ideas ported:
  - optimizeRest: pre-order group matches per category to spread team appearances
  - Slot-based parallel placement: fill ALL fields at each time slot
  - Constraint relaxation: when stuck, force placement with a warning instead of failing
  - Auto-populate field availability from tournament dates when empty
"""

from __future__ import annotations

import logging
import time as time_mod
from collections import defaultdict
from collections.abc import Callable
from datetime import timedelta

from django.db import transaction

from apps.scheduling.context import SchedulingContext
from apps.scheduling.enumerator import enumerate_tournament_matches
from apps.scheduling.optimizer import two_opt_optimization
from apps.scheduling.scoring import score_placement
from apps.scheduling.types import (
    Conflict,
    Placement,
    ProvisionalMatch,
    SchedulingReport,
    SoftWarning,
    Strategy,
)

logger = logging.getLogger(__name__)


def _index_in_recent(recent: list[int | None], team_id: int | None) -> int:
    """Return the position of team_id in the recent list, or -1 if absent."""
    if team_id is None:
        return -1
    try:
        return recent.index(team_id)
    except ValueError:
        return -1


class SchedulingEngine:
    """Deterministic tournament schedule generator.

    Phases:
      1. Enumerate required matches (round-robin + knockout)
      2. Load context (categories, fields, groups, teams, constraints)
      2b. Auto-populate field availability if empty
      3. Place locked matches from DB
      4. Place hard-constrained matches first
      4b. Pre-optimise match ordering (rest spreading)
      5. Slot-based parallel greedy placement
      6. 2-opt local optimisation
      7. Generate warnings
      8. Build report
    """

    def __init__(self, tournament, *, strategy: str = "balanced", seed: int = 42):
        self.tournament = tournament
        self.strategy = Strategy(strategy)
        self.seed = seed
        self._progress_cb: Callable[[int, str], None] | None = None
        self._matches: list[ProvisionalMatch] = []
        self._context: SchedulingContext | None = None
        self._conflicts: list[Conflict] = []
        self._warnings: list[SoftWarning] = []
        self._report: SchedulingReport | None = None

    def set_progress_callback(self, cb: Callable[[int, str], None]) -> None:
        self._progress_cb = cb

    def _progress(self, pct: int, msg: str) -> None:
        if self._progress_cb:
            try:
                self._progress_cb(pct, msg)
            except Exception:
                pass

    # ─── Public API ──────────────────────────────────────────────────────

    def generate(self) -> SchedulingReport:
        start_ts = time_mod.time()

        self._progress(5, "Chargement du contexte…")
        self.load_context()

        self._progress(8, "Vérification disponibilité terrains…")
        self._auto_populate_field_availability()

        self._progress(10, "Énumération des matchs…")
        self._enumerate_required_matches()

        if not self._matches:
            self._report = self._build_report(0, 0, start_ts)
            return self._report

        total = len(self._matches)
        self._progress(20, f"{total} matchs à placer")

        self._progress(25, "Placement des matchs verrouillés…")
        self._place_locked_matches()

        self._progress(35, "Placement des matchs avec contraintes dures…")
        self._place_hard_constrained()

        self._progress(40, "Optimisation de l'ordre des matchs…")
        self._optimize_match_ordering()

        self._progress(50, "Placement glouton parallèle…")
        self._greedy_placement()

        self._progress(80, "Optimisation locale (2-opt)…")
        two_opt_optimization(self._context.placements, self._context)

        self._progress(90, "Construction du rapport…")
        self._generate_warnings()

        placed = len(self._context.placements)
        self._report = self._build_report(placed, total, start_ts)

        self._progress(100, "Terminé")
        return self._report

    def load_context(self) -> None:
        from apps.teams.models import Group, Team
        from apps.tournaments.models import Category, Field, SchedulingConstraint

        categories = list(Category.objects.filter(tournament=self.tournament))
        fields = list(
            Field.objects.filter(tournament=self.tournament, is_active=True),
        )
        groups = list(
            Group.objects.filter(category__tournament=self.tournament),
        )
        teams = list(Team.objects.filter(tournament=self.tournament))
        constraints = list(
            SchedulingConstraint.objects.filter(tournament=self.tournament),
        )

        self._context = SchedulingContext(
            tournament=self.tournament,
            categories=categories,
            fields=fields,
            groups=groups,
            teams=teams,
            constraints=constraints,
        )

    # ─── Phase 1: Enumerate matches ─────────────────────────────────────

    def _auto_populate_field_availability(self) -> None:
        """Auto-populate field availability from tournament dates when empty.

        Ported from tournoi-exemple: fields inherit day windows from the
        tournament start/end dates. Each day gets a default 08:00-19:00 window
        unless categories provide tighter earliest_start/latest_end.
        """
        from datetime import date as dt_date, timedelta as td
        from apps.tournaments.models import Field

        empty_fields = [
            f for f in self._context.fields.values() if not f.availability
        ]
        if not empty_fields:
            return

        # Determine date range
        t = self.tournament
        days: list[dt_date] = []
        current = t.start_date
        while current <= t.end_date:
            days.append(current)
            current += td(days=1)

        if not days:
            return

        # Find global time window from categories, fallback 08:00-19:00
        earliest = "08:00"
        latest = "19:00"
        cats = list(self._context.categories.values())
        if cats:
            starts = [c.earliest_start for c in cats if c.earliest_start]
            ends = [c.latest_end for c in cats if c.latest_end]
            if starts:
                earliest = min(starts).strftime("%H:%M")
            if ends:
                latest = max(ends).strftime("%H:%M")

        # Build availability and save
        avail = [
            {"date": d.isoformat(), "start": earliest, "end": latest}
            for d in days
        ]
        for f in empty_fields:
            f.availability = avail
            f.save(update_fields=["availability"])

        # Reload context to pick up new availability
        self.load_context()
        self._warnings.append(SoftWarning(
            type="auto_availability",
            message=(
                f"{len(empty_fields)} terrain(s) sans disponibilité — "
                f"créneaux auto-générés ({earliest}–{latest})."
            ),
        ))

    def _enumerate_required_matches(self) -> None:
        matches, warnings = enumerate_tournament_matches(self.tournament)
        self._matches = matches
        self._warnings.extend(warnings)

    # ─── Phase 3: Place locked matches ───────────────────────────────────

    def _place_locked_matches(self) -> None:
        """Copy locked matches from DB into context as already-placed."""
        from apps.matches.models import Match

        locked = Match.objects.filter(tournament=self.tournament, is_locked=True)
        for m in locked:
            cat = self._context.categories.get(m.category_id)
            transition = cat.effective_transition_time if cat else 5
            rest = cat.effective_rest_time if cat else 20
            pm = ProvisionalMatch(
                provisional_id=str(m.id),
                category_id=m.category_id,
                group_id=m.group_id,
                phase=m.phase,
                team_home_id=m.team_home_id,
                team_away_id=m.team_away_id,
                placeholder_home=m.placeholder_home,
                placeholder_away=m.placeholder_away,
                duration=m.duration_minutes,
                transition=transition,
                rest_needed=rest,
            )
            placement = Placement(
                match=pm, field_id=m.field_id, start_time=m.start_time,
            )
            self._context.commit_placement(placement)

            # Remove matching provisional match (same teams + group + phase)
            self._matches = [
                pm2 for pm2 in self._matches
                if not (
                    pm2.category_id == m.category_id
                    and pm2.group_id == m.group_id
                    and pm2.phase == m.phase
                    and {pm2.team_home_id, pm2.team_away_id}
                    == {m.team_home_id, m.team_away_id}
                )
            ]

    # ─── Phase 4: Place hard-constrained matches ────────────────────────

    def _place_hard_constrained(self) -> None:
        """Matches with hard required_field constraints are placed first."""
        hard_required = [
            c for c in self._context._hard_constraints
            if c.constraint_type == "required_field"
        ]
        if not hard_required:
            return

        remaining: list[ProvisionalMatch] = []
        for m in self._matches:
            placed = False
            for hc in hard_required:
                payload = hc.payload or {}
                if (
                    payload.get("category_id")
                    and payload["category_id"] != m.category_id
                ):
                    continue
                if payload.get("phase") and payload["phase"] != m.phase:
                    continue
                req_field = payload.get("field_id")
                if not req_field:
                    continue
                best = self._find_best_placement(m, field_ids=[req_field])
                if best:
                    self._context.commit_placement(best)
                    placed = True
                    break
            if not placed:
                remaining.append(m)
        self._matches = remaining

    # ─── Phase 4b: Pre-optimise match ordering (from tournoi-exemple) ───

    def _optimize_match_ordering(self) -> None:
        """Reorder matches to maximise rest between teams.

        Hybrid approach:
        - Within each category, group matches are reordered using the
          rest-spreading algorithm from tournoi-exemple's `optimizeRest()`
        - Categories are then **interleaved** (round-robin) so no single
          category monopolises early time slots, preventing long waits
        - Knockout matches keep their phase ordering and come after all groups
        """
        phase_priority = {
            "group": 0, "r16": 1, "quarter": 2,
            "semi": 3, "third": 4, "final": 5,
        }

        groups_by_cat: dict[int, list[ProvisionalMatch]] = defaultdict(list)
        knockouts_by_cat: dict[int, list[ProvisionalMatch]] = defaultdict(list)

        for m in self._matches:
            if m.phase == "group":
                groups_by_cat[m.category_id].append(m)
            else:
                knockouts_by_cat[m.category_id].append(m)

        # Optimise rest within group matches per category
        optimised_groups: dict[int, list[ProvisionalMatch]] = {}
        all_cat_ids = sorted(
            set(list(groups_by_cat.keys()) + list(knockouts_by_cat.keys())),
        )
        for cat_id in all_cat_ids:
            cat = self._context.categories.get(cat_id)
            min_rest_slots = 1
            if cat:
                slot_dur = cat.effective_match_duration + cat.effective_transition_time
                if slot_dur > 0:
                    min_rest_slots = max(1, cat.effective_rest_time // slot_dur)

            grp_matches = groups_by_cat.get(cat_id, [])
            if grp_matches:
                optimised_groups[cat_id] = self._optimize_rest_order(
                    grp_matches, min_rest_slots,
                )

        # Interleave group matches across categories (round-robin)
        result: list[ProvisionalMatch] = []
        cat_iterators = {
            cid: iter(ms) for cid, ms in optimised_groups.items()
        }
        while cat_iterators:
            exhausted: list[int] = []
            for cid in list(cat_iterators):
                nxt = next(cat_iterators[cid], None)
                if nxt is None:
                    exhausted.append(cid)
                else:
                    result.append(nxt)
            for cid in exhausted:
                del cat_iterators[cid]

        # Knockouts come after all groups, ordered by phase within each category
        for cat_id in all_cat_ids:
            ko = knockouts_by_cat.get(cat_id, [])
            ko.sort(key=lambda m: phase_priority.get(m.phase, 9))
            result.extend(ko)

        self._matches = result

    @staticmethod
    def _optimize_rest_order(
        matches: list[ProvisionalMatch], min_rest: int,
    ) -> list[ProvisionalMatch]:
        """Reorder matches so that teams get maximum rest between appearances.

        Direct port of tournoi-exemple's `optimizeRest()`.
        Uses a recent-teams window to pick the match least likely to cause
        a rest violation.
        """
        if len(matches) <= 1:
            return matches

        ordered: list[ProvisionalMatch] = []
        remaining = list(matches)
        recent_teams: list[int | None] = []

        while remaining:
            best_idx = -1
            best_score = -1

            for i, m in enumerate(remaining):
                h_idx = _index_in_recent(recent_teams, m.team_home_id)
                a_idx = _index_in_recent(recent_teams, m.team_away_id)
                h_ok = h_idx == -1  # team not in recent window
                a_ok = a_idx == -1

                if h_ok and a_ok:
                    score = 100
                elif h_ok or a_ok:
                    score = 50
                else:
                    score = min(
                        h_idx if h_idx != -1 else 999,
                        a_idx if a_idx != -1 else 999,
                    )

                if score > best_score:
                    best_score = score
                    best_idx = i

            if best_idx == -1:
                best_idx = 0

            m = remaining.pop(best_idx)
            ordered.append(m)
            if m.team_home_id is not None:
                recent_teams.append(m.team_home_id)
            if m.team_away_id is not None:
                recent_teams.append(m.team_away_id)
            # Keep window size = min_rest * 2 (2 teams per match)
            while len(recent_teams) > min_rest * 2:
                recent_teams.pop(0)

        return ordered

    # ─── Phase 5: Greedy placement ───────────────────────────────────────

    def _greedy_placement(self) -> None:
        """Place remaining matches using per-match best-slot greedy approach.

        Hybrid of both engines:
        - Matches are pre-ordered by _optimize_match_ordering (from tournoi-
          exemple) to spread team appearances
        - Each match is placed at its globally best (field, time) via the
          scoring function (from tournoi-app's original engine)
        - Two-pass with reduced rest: when the first pass can't place a match,
          a second pass retries with halved rest time
        - Constraint relaxation (from tournoi-exemple): final fallback forces
          placement ignoring rest entirely
        """
        if not self._matches:
            return

        remaining: list[ProvisionalMatch] = list(self._matches)
        self._matches = []
        total = len(remaining)
        placed_count = 0

        # Pass 1: normal constraints
        retry: list[ProvisionalMatch] = []
        for m in remaining:
            if self._progress_cb and total > 0:
                pct = 50 + int(20 * placed_count / total)
                self._progress(pct, f"Placement {placed_count}/{total}…")

            best = self._find_best_placement(m)
            if best:
                self._context.commit_placement(best)
                placed_count += 1
            else:
                retry.append(m)

        # Pass 2: reduced rest (half)
        if retry:
            from dataclasses import replace as dc_replace

            retry2: list[ProvisionalMatch] = []
            for m in retry:
                if self._progress_cb and total > 0:
                    pct = 70 + int(10 * placed_count / total)
                    self._progress(pct, f"Placement réduit {placed_count}/{total}…")

                reduced_rest = max(5, m.rest_needed // 2)
                m_reduced = dc_replace(m, rest_needed=reduced_rest)
                best = self._find_best_placement(m_reduced)

                if best:
                    self._context.commit_placement(best)
                    placed_count += 1
                    self._warnings.append(SoftWarning(
                        type="reduced_rest",
                        message=(
                            f"Repos réduit pour "
                            f"{m.placeholder_home or 'team'}"
                            f" vs {m.placeholder_away or 'team'}"
                            f" ({m.phase}) — {reduced_rest}min au lieu de {m.rest_needed}min."
                        ),
                        affected_match_id=m.provisional_id,
                    ))
                else:
                    retry2.append(m)
            retry = retry2

        # Pass 3: constraint relaxation (ignore rest entirely)
        for m in retry:
            if self._progress_cb and total > 0:
                pct = 80 + int(5 * placed_count / total)
                self._progress(pct, f"Placement relaxé {placed_count}/{total}…")

            relaxed = self._find_relaxed_placement(m)
            if relaxed:
                self._context.commit_placement(relaxed)
                placed_count += 1
                self._warnings.append(SoftWarning(
                    type="constraint_relaxed",
                    message=(
                        f"Contrainte relaxée pour "
                        f"{m.placeholder_home or 'team'}"
                        f" vs {m.placeholder_away or 'team'}"
                        f" ({m.phase}) — repos ou équilibrage non garanti."
                    ),
                    affected_match_id=m.provisional_id,
                ))
                continue

            # Truly impossible
            self._conflicts.append(Conflict(
                type="no_valid_slot",
                match_id=m.provisional_id,
                reason=(
                    f"Aucun créneau valide pour "
                    f"{m.placeholder_home or 'team'}"
                    f" vs {m.placeholder_away or 'team'}"
                    f" ({m.phase})"
                ),
                severity="hard",
            ))
            self._matches.append(m)

    def _find_relaxed_placement(
        self, match: ProvisionalMatch,
    ) -> Placement | None:
        """Find a placement ignoring rest/balance constraints.

        Only hard constraints kept: field availability, field not busy,
        category day, category time window. Team rest is IGNORED.
        """
        from datetime import timedelta as td

        best: Placement | None = None
        best_time = None

        for fid in self._context.fields:
            for start in self._context.get_candidate_starts(fid):
                end = start + td(minutes=match.duration)

                # Must fit field availability
                if not self._context.field_has_availability(fid, start, end):
                    continue
                # Field must not be busy
                if self._context.field_is_busy(fid, start, end, include_transition=True):
                    continue
                # Category day must match
                if not self._context.category_day_allowed(match.category_id, start):
                    continue
                # Category time window
                if not self._context.category_time_window_ok(match.category_id, start, end):
                    continue
                # Team must not have an overlapping match (but rest is ignored)
                overlap = False
                for tid in (match.team_home_id, match.team_away_id):
                    if tid and self._context.team_has_conflict(tid, start, end, rest_needed=0):
                        overlap = True
                        break
                if overlap:
                    continue

                # Pick earliest valid slot
                if best_time is None or start < best_time:
                    best_time = start
                    best = Placement(
                        match=match, field_id=fid, start_time=start, score=0.0,
                    )
                    break  # Take first valid on this field, keep scanning fields for earlier

        return best

    def _find_best_placement(
        self,
        match: ProvisionalMatch,
        *,
        field_ids: list[int] | None = None,
    ) -> Placement | None:
        """Find the highest-scoring valid placement for a match."""
        best_placement: Placement | None = None
        best_score = -float("inf")

        target_fields = field_ids or list(self._context.fields.keys())

        for fid in target_fields:
            for start in self._context.get_candidate_starts(fid):
                s = score_placement(match, fid, start, self._context)
                if s is not None and s > best_score:
                    best_score = s
                    best_placement = Placement(
                        match=match, field_id=fid, start_time=start, score=s,
                    )

        return best_placement

    # ─── Warnings generation ─────────────────────────────────────────────

    def _generate_warnings(self) -> None:
        """Scan placements for soft issues."""
        # Unbalanced fields
        counts = self._context._field_match_count
        if counts:
            avg = sum(counts.values()) / max(len(counts), 1)
            for fid, cnt in counts.items():
                if avg > 0 and cnt / avg > 1.3:
                    fname = (
                        self._context.fields[fid].name
                        if fid in self._context.fields
                        else str(fid)
                    )
                    self._warnings.append(SoftWarning(
                        type="unbalanced_field",
                        message=(
                            f"Terrain {fname} est surchargé"
                            f" ({cnt} matchs, moy. {avg:.0f})."
                        ),
                    ))

        # Team rest times and consecutive matches
        team_matches: dict[int, list[Placement]] = {}
        for p in self._context.placements:
            for tid in (p.match.team_home_id, p.match.team_away_id):
                if tid:
                    team_matches.setdefault(tid, []).append(p)

        for tid, pls in team_matches.items():
            sorted_p = sorted(pls, key=lambda p: p.start_time)
            tname = (
                self._context.teams[tid].name
                if tid in self._context.teams
                else str(tid)
            )

            consecutive = 1
            for i in range(1, len(sorted_p)):
                prev = sorted_p[i - 1]
                curr = sorted_p[i]
                prev_end = prev.start_time + timedelta(minutes=prev.match.duration)
                gap = (curr.start_time - prev_end).total_seconds() / 60.0

                if gap < curr.match.rest_needed:
                    self._warnings.append(SoftWarning(
                        type="short_rest",
                        message=(
                            f"Équipe {tname} a seulement {gap:.0f}min"
                            f" de repos (min: {curr.match.rest_needed})."
                        ),
                        affected_team_id=tid,
                        affected_match_id=curr.match.provisional_id,
                    ))
                elif gap > 180 and prev.start_time.date() == curr.start_time.date():
                    # Only flag long waits within the same day (inter-day gaps are expected)
                    self._warnings.append(SoftWarning(
                        type="long_wait",
                        message=(
                            f"Équipe {tname} attend {gap:.0f}min"
                            f" entre deux matchs."
                        ),
                        affected_team_id=tid,
                        affected_match_id=curr.match.provisional_id,
                    ))

                # Track consecutive (back-to-back within transition time)
                if gap <= (curr.match.transition + 2):
                    consecutive += 1
                    if consecutive > 2:
                        self._warnings.append(SoftWarning(
                            type="too_many_consecutive",
                            message=(
                                f"Équipe {tname} joue {consecutive} matchs "
                                f"consécutifs sans repos suffisant."
                            ),
                            affected_team_id=tid,
                            affected_match_id=curr.match.provisional_id,
                        ))
                else:
                    consecutive = 1

    # ─── Phase 8: Build report ───────────────────────────────────────────

    def _build_report(
        self, placed: int, total: int, start_ts: float,
    ) -> SchedulingReport:
        score_val = 100.0
        score_val -= len(self._conflicts) * 20
        score_val -= len(self._warnings) * 1
        if not self._conflicts and placed == total and total > 0:
            score_val += 5
        return SchedulingReport(
            placed_count=placed,
            total_count=total,
            score=max(0.0, min(100.0, score_val)),
            hard_conflicts=list(self._conflicts),
            soft_warnings=list(self._warnings),
            execution_time_ms=int((time_mod.time() - start_ts) * 1000),
            strategy_used=self.strategy,
        )

    # ─── Commit to DB ────────────────────────────────────────────────────

    @classmethod
    def check_feasibility(cls, tournament) -> dict:
        """Detailed feasibility analysis before scheduling.

        Returns utilization %, per-day breakdown, per-category stats,
        bottleneck detection, and a composite feasibility score 0-100.
        """
        from collections import Counter, defaultdict
        from apps.scheduling.enumerator import enumerate_tournament_matches
        from apps.tournaments.models import Category, Field
        from apps.scheduling.slots import parse_date, parse_time

        categories = list(Category.objects.filter(tournament=tournament))
        fields = list(
            Field.objects.filter(tournament=tournament, is_active=True),
        )

        # ── Count matches per category ───────────────────────────────────
        matches, _ = enumerate_tournament_matches(tournament)
        total_matches = len(matches)
        matches_by_cat: dict[int, int] = Counter()
        teams_by_cat: dict[int, set] = defaultdict(set)
        for m in matches:
            matches_by_cat[m.category_id] += 1
            if m.team_home_id:
                teams_by_cat[m.category_id].add(m.team_home_id)
            if m.team_away_id:
                teams_by_cat[m.category_id].add(m.team_away_id)

        # ── Count slots per field per day ────────────────────────────────
        avg_dur = tournament.default_match_duration + tournament.default_transition_time
        if avg_dur <= 0:
            avg_dur = 20  # fallback

        total_slots = 0
        slots_per_day: dict[str, int] = Counter()
        playable_minutes_per_day: dict[str, int] = Counter()
        for f in fields:
            for avail in f.availability:
                day_str = avail["date"]
                start_t = parse_time(avail["start"])
                end_t = parse_time(avail["end"])
                start_min = start_t.hour * 60 + start_t.minute
                end_min = end_t.hour * 60 + end_t.minute
                playable = max(0, end_min - start_min)
                slots = playable // avg_dur
                total_slots += slots
                slots_per_day[day_str] += slots
                playable_minutes_per_day[day_str] += playable

        # ── Per-day match demand (how many matches could land on each day) ──
        cat_map = {c.id: c for c in categories}
        matches_per_day: dict[str, int] = Counter()
        for m in matches:
            cat = cat_map.get(m.category_id)
            if cat and cat.allowed_days:
                n_days = len(cat.allowed_days)
                for d in cat.allowed_days:
                    # Split matches proportionally across allowed days
                    matches_per_day[d] += 1 / n_days
            else:
                # No day restriction — distribute evenly across all days
                for d in slots_per_day:
                    matches_per_day[d] += 1 / max(len(slots_per_day), 1)

        # ── Rest-adjusted capacity ───────────────────────────────────────
        # With rest constraints, effective capacity is reduced.
        # A team playing N matches needs (N-1)*rest_time extra minutes.
        # Estimate: rest penalty ≈ total_rest_minutes / total_playable_minutes
        total_playable = sum(playable_minutes_per_day.values())
        total_rest_penalty = 0
        for cat in categories:
            n_teams = len(teams_by_cat.get(cat.id, set()))
            n_matches = matches_by_cat.get(cat.id, 0)
            if n_teams > 0:
                matches_per_team = n_matches * 2 / max(n_teams, 1)  # each match uses 2 teams
                rest_time = getattr(cat, "rest_time", None) or tournament.default_rest_time
                # Each team needs (matches_per_team - 1) * rest gaps
                total_rest_penalty += n_teams * max(0, matches_per_team - 1) * rest_time

        rest_overhead = total_rest_penalty / max(total_playable, 1)

        # ── Per-day utilization ──────────────────────────────────────────
        days_detail = []
        day_bottleneck = None
        max_day_util = 0
        for day_str in sorted(slots_per_day):
            day_slots = slots_per_day[day_str]
            day_demand = round(matches_per_day.get(day_str, 0))
            day_util = round(day_demand / day_slots * 100) if day_slots > 0 else 0
            days_detail.append({
                "date": day_str,
                "slots": day_slots,
                "estimated_matches": day_demand,
                "utilization": min(day_util, 100),
            })
            if day_util > max_day_util:
                max_day_util = day_util
                day_bottleneck = day_str

        # ── Per-category detail ──────────────────────────────────────────
        categories_detail = []
        for cat in sorted(categories, key=lambda c: c.id):
            n_matches = matches_by_cat.get(cat.id, 0)
            n_teams = len(teams_by_cat.get(cat.id, set()))
            rest = getattr(cat, "rest_time", None) or tournament.default_rest_time
            dur = getattr(cat, "match_duration", None) or tournament.default_match_duration
            days = cat.allowed_days if cat.allowed_days else [d for d in slots_per_day]
            # Slots available for this category
            cat_slots = sum(slots_per_day.get(d, 0) for d in days)
            cat_util = round(n_matches / cat_slots * 100) if cat_slots > 0 else 0
            categories_detail.append({
                "id": cat.id,
                "name": cat.name,
                "teams": n_teams,
                "matches": n_matches,
                "slots_available": cat_slots,
                "utilization": min(cat_util, 100),
                "match_duration": dur,
                "rest_time": rest,
                "days": days,
            })

        # ── Composite feasibility score (0-100) ─────────────────────────
        global_util = round(total_matches / total_slots * 100) if total_slots > 0 else 100
        #
        # Score components:
        #  - Slot capacity (40%): 100 if util < 60%, linear drop to 0 at 100%
        #  - Rest overhead (20%): 100 if overhead < 20%, linear drop to 0 at 60%
        #  - Day balance (20%): 100 if max day util < 70%, drop to 0 at 100%
        #  - Setup completeness (20%): fields>0, categories>0, teams>0
        #
        slot_score = max(0, min(100, (100 - global_util) / 40 * 100))
        rest_score = max(0, min(100, (60 - rest_overhead * 100) / 40 * 100))
        day_score = max(0, min(100, (100 - max_day_util) / 30 * 100))

        has_fields = len(fields) > 0
        has_categories = len(categories) > 0
        has_teams = total_matches > 0
        has_availability = total_slots > 0
        setup_score = sum([
            25 if has_fields else 0,
            25 if has_categories else 0,
            25 if has_teams else 0,
            25 if has_availability else 0,
        ])

        feasibility_score = round(
            slot_score * 0.4 + rest_score * 0.2 + day_score * 0.2 + setup_score * 0.2
        )
        feasibility_score = max(0, min(100, feasibility_score))

        # ── Bottlenecks / tips ───────────────────────────────────────────
        bottlenecks = []
        if not has_fields:
            bottlenecks.append("Aucun terrain actif configuré.")
        if not has_categories:
            bottlenecks.append("Aucune catégorie créée.")
        if not has_teams:
            bottlenecks.append("Aucune équipe inscrite.")
        if not has_availability:
            bottlenecks.append("Aucune disponibilité terrain configurée.")
        if global_util > 90:
            bottlenecks.append(
                f"Utilisation très élevée ({global_util}%) — risque de conflits. "
                f"Ajoutez des terrains ou réduisez le nombre d'équipes."
            )
        elif global_util > 75:
            bottlenecks.append(
                f"Utilisation élevée ({global_util}%) — le planning sera serré."
            )
        if rest_overhead > 0.4:
            bottlenecks.append(
                "Le temps de repos entre matchs consomme beaucoup de capacité. "
                "Envisagez de réduire légèrement le temps de repos."
            )
        if day_bottleneck and max_day_util > 85:
            bottlenecks.append(
                f"Le {day_bottleneck} est surchargé ({max_day_util}%). "
                f"Répartissez les catégories sur plusieurs jours."
            )

        return {
            "feasibility_score": feasibility_score,
            "total_matches": total_matches,
            "total_slots": total_slots,
            "feasible": total_slots >= total_matches and feasibility_score >= 30,
            "utilization": min(global_util, 100),
            "rest_overhead_pct": round(rest_overhead * 100),
            "fields_count": len(fields),
            "categories_count": len(categories),
            "teams_count": sum(len(t) for t in teams_by_cat.values()),
            "days": days_detail,
            "categories": categories_detail,
            "bottlenecks": bottlenecks,
        }

    @transaction.atomic
    def commit_to_db(self) -> list:
        """Save all placements as Match objects. Only DB-write point.

        Decorated with @transaction.atomic so DELETE + bulk_create
        are rolled back together on any error.
        """
        from apps.matches.models import Match

        Match.objects.select_for_update().filter(
            tournament=self.tournament,
            is_locked=False,
            status=Match.Status.SCHEDULED,
        ).delete()

        created = []
        for p in self._context.placements:
            m = p.match
            # Skip locked matches (already in DB)
            if Match.objects.filter(pk=m.provisional_id, is_locked=True).exists():
                continue
            match = Match(
                tournament=self.tournament,
                category_id=m.category_id,
                group_id=m.group_id,
                phase=m.phase,
                team_home_id=m.team_home_id,
                team_away_id=m.team_away_id,
                placeholder_home=m.placeholder_home,
                placeholder_away=m.placeholder_away,
                field_id=p.field_id,
                start_time=p.start_time,
                duration_minutes=m.duration,
                status=Match.Status.SCHEDULED,
            )
            created.append(match)

        if created:
            Match.objects.bulk_create(created)
        return created

    # ─── Incremental recalculation ───────────────────────────────────────

    @classmethod
    @transaction.atomic
    def reschedule(cls, tournament, changed_match_ids: list[str]) -> SchedulingReport:
        """Re-place only affected matches without full regeneration.

        Locked matches are left in-place. Non-locked affected matches
        (same category / same day) are deleted and re-placed.
        Wrapped in @transaction.atomic so the delete + re-place is all-or-nothing.
        """
        from apps.matches.models import Match

        engine = cls(tournament)
        engine.load_context()

        changed = Match.objects.filter(
            id__in=changed_match_ids, tournament=tournament,
        )
        affected_cats = set(changed.values_list("category_id", flat=True))
        affected_days: set = set()
        for m in changed:
            if m.start_time:
                affected_days.add(m.start_time.date())

        affected = Match.objects.filter(
            tournament=tournament,
            category_id__in=affected_cats,
        )
        if affected_days:
            from django.db.models import Q

            day_filter = Q()
            for day in affected_days:
                day_filter |= Q(start_time__date=day)
            affected = affected.filter(day_filter)

        # Place locked matches into context
        for m in affected.filter(is_locked=True):
            cat = engine._context.categories.get(m.category_id)
            pm = ProvisionalMatch(
                provisional_id=str(m.id),
                category_id=m.category_id,
                group_id=m.group_id,
                phase=m.phase,
                team_home_id=m.team_home_id,
                team_away_id=m.team_away_id,
                placeholder_home=m.placeholder_home,
                placeholder_away=m.placeholder_away,
                duration=m.duration_minutes,
                transition=cat.effective_transition_time if cat else 5,
                rest_needed=cat.effective_rest_time if cat else 20,
            )
            placement = Placement(
                match=pm, field_id=m.field_id, start_time=m.start_time,
            )
            engine._context.commit_placement(placement)

        # Collect non-locked matches to re-place
        to_replace = affected.filter(is_locked=False)
        for m in to_replace:
            cat = engine._context.categories.get(m.category_id)
            engine._matches.append(ProvisionalMatch(
                provisional_id=str(m.id),
                category_id=m.category_id,
                group_id=m.group_id,
                phase=m.phase,
                team_home_id=m.team_home_id,
                team_away_id=m.team_away_id,
                placeholder_home=m.placeholder_home,
                placeholder_away=m.placeholder_away,
                duration=m.duration_minutes,
                transition=cat.effective_transition_time if cat else 5,
                rest_needed=cat.effective_rest_time if cat else 20,
            ))

        to_replace.delete()

        start_ts = time_mod.time()
        engine._greedy_placement()
        engine._generate_warnings()

        placed = len(engine._context.placements)
        total = placed + len(engine._matches)
        engine._report = engine._build_report(placed, total, start_ts)

        # commit_to_db is itself @transaction.atomic; the outer
        # reschedule @transaction.atomic wraps everything (delete + place + commit).
        engine.commit_to_db()

        return engine._report
