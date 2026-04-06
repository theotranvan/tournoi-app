"""Mutable scheduling state tracked during engine execution."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from apps.scheduling.slots import parse_date, parse_time
from apps.scheduling.types import Placement, ProvisionalMatch

logger = logging.getLogger(__name__)


class SchedulingContext:
    """Holds all state required by the scoring function and the greedy placer."""

    def __init__(self, tournament, categories, fields, groups, teams, constraints):
        self.tournament = tournament
        self.categories = {c.id: c for c in categories}
        self.fields = {f.id: f for f in fields}
        self.groups = {g.id: g for g in groups}
        self.teams = {t.id: t for t in teams}
        self.constraints = list(constraints)

        # Pre-compute per-field availability windows as (start_dt, end_dt) pairs
        # Use UTC-aware datetimes to avoid naive/aware comparison issues
        self._field_windows: dict[int, list[tuple[datetime, datetime]]] = {}
        for f in fields:
            windows: list[tuple[datetime, datetime]] = []
            for avail in f.availability:
                day = parse_date(avail["date"])
                s = datetime.combine(day, parse_time(avail["start"]), tzinfo=UTC)
                e = datetime.combine(day, parse_time(avail["end"]), tzinfo=UTC)
                windows.append((s, e))
            self._field_windows[f.id] = windows

        # Track placed matches: field_id -> sorted list of (start, end)
        self._field_schedule: dict[int, list[tuple[datetime, datetime]]] = {
            f.id: [] for f in fields
        }
        # Track placed matches: team_id -> sorted list of (start, end)
        self._team_schedule: dict[int, list[tuple[datetime, datetime]]] = {}
        # Track placed matches: category_id -> sorted list of (start, end)
        self._category_schedule: dict[int, list[tuple[datetime, datetime]]] = {
            c.id: [] for c in categories
        }
        # Total match count per field (for load balancing)
        self._field_match_count: dict[int, int] = {f.id: 0 for f in fields}
        self._total_placed = 0
        # Placements list
        self.placements: list[Placement] = []

        # Pre-compute constraint indices
        self._hard_constraints = [c for c in self.constraints if c.is_hard]
        self._soft_constraints = [c for c in self.constraints if not c.is_hard]

        # Build candidate start times per field (unique sorted starts, 5-min granularity)
        self._field_candidate_starts: dict[int, list[datetime]] = {}
        for f in fields:
            starts: list[datetime] = []
            for avail in f.availability:
                day = parse_date(avail["date"])
                s = datetime.combine(day, parse_time(avail["start"]), tzinfo=UTC)
                e = datetime.combine(day, parse_time(avail["end"]), tzinfo=UTC)
                current = s
                while current < e:
                    starts.append(current)
                    current += timedelta(minutes=5)
            self._field_candidate_starts[f.id] = starts

        # Category youth detection cache
        self._youth_categories: set[int] = set()
        for c in categories:
            name_lower = c.name.lower()
            if any(tag in name_lower for tag in ("u8", "u9", "u10")):
                self._youth_categories.add(c.id)

    # ─── Field availability ──────────────────────────────────────────────

    def field_has_availability(self, field_id: int, start: datetime, end: datetime) -> bool:
        """Check if [start, end) falls entirely within a field availability window."""
        for ws, we in self._field_windows.get(field_id, []):
            if start >= ws and end <= we:
                return True
        return False

    def field_is_busy(
        self, field_id: int, start: datetime, end: datetime, include_transition: bool = True,
    ) -> bool:
        """Check if the field has an overlapping match (with optional transition buffer)."""
        for ms, me in self._field_schedule.get(field_id, []):
            eff_end = me + timedelta(minutes=5) if include_transition else me
            if start < eff_end and end > ms:
                return True
        return False

    # ─── Team conflicts ──────────────────────────────────────────────────

    def team_has_conflict(
        self, team_id: int, start: datetime, end: datetime, rest_needed: int,
    ) -> bool:
        """Check if a team has an overlapping match or insufficient rest."""
        rest = timedelta(minutes=rest_needed)
        for ms, me in self._team_schedule.get(team_id, []):
            if start < (me + rest) and end > (ms - rest):
                return True
        return False

    # ─── Category time windows ───────────────────────────────────────────

    def category_time_window_ok(
        self, category_id: int, start: datetime, end: datetime,
    ) -> bool:
        cat = self.categories.get(category_id)
        if not cat:
            return True
        if cat.earliest_start and start.time() < cat.earliest_start:
            return False
        if cat.latest_end and end.time() > cat.latest_end:
            return False
        return True

    def category_day_allowed(self, category_id: int, start: datetime) -> bool:
        cat = self.categories.get(category_id)
        if not cat:
            return True
        allowed_days = cat.allowed_days
        if not allowed_days:
            return True
        return start.date().isoformat() in allowed_days

    # ─── Finals ordering ─────────────────────────────────────────────────

    def last_group_match_end(self, category_id: int) -> datetime | None:
        """Return the end time of the last group-phase match for this category."""
        last_end: datetime | None = None
        for p in self.placements:
            if p.match.category_id == category_id and p.match.phase == "group":
                match_end = p.start_time + timedelta(minutes=p.match.duration)
                if last_end is None or match_end > last_end:
                    last_end = match_end
        return last_end

    # ─── Load balancing ──────────────────────────────────────────────────

    def field_load_ratio(self, field_id: int) -> float:
        """Ratio of this field's load vs. average. >1 means overloaded."""
        if self._total_placed == 0:
            return 1.0
        avg = self._total_placed / max(len(self._field_match_count), 1)
        if avg == 0:
            return 1.0
        return self._field_match_count.get(field_id, 0) / avg

    # ─── Rest / gap helpers ──────────────────────────────────────────────

    def time_since_last_match(self, team_id: int, start: datetime) -> float:
        """Minutes since team's last match ended. Returns inf if no prior match."""
        schedule = self._team_schedule.get(team_id, [])
        if not schedule:
            return float("inf")
        last_end = max(me for _, me in schedule)
        if start <= last_end:
            return 0.0
        return (start - last_end).total_seconds() / 60.0

    def gap_in_category_schedule(self, category_id: int, start: datetime) -> float:
        """Minutes gap between start and end of last match in this category."""
        schedule = self._category_schedule.get(category_id, [])
        if not schedule:
            return 0.0
        last_end = max(me for _, me in schedule)
        if start <= last_end:
            return 0.0
        return (start - last_end).total_seconds() / 60.0

    # ─── Soft constraints ────────────────────────────────────────────────

    def soft_constraints_for_match(self, match: ProvisionalMatch) -> list:
        """Return soft constraints applicable to this match."""
        result = []
        for sc in self._soft_constraints:
            payload = sc.payload or {}
            if payload.get("category_id") and payload["category_id"] != match.category_id:
                continue
            if payload.get("phase") and payload["phase"] != match.phase:
                continue
            result.append(sc)
        return result

    def constraint_matches_placement(
        self, constraint, field_id: int, start: datetime,
    ) -> bool:
        """Check if a soft constraint is satisfied by this placement."""
        payload = constraint.payload or {}
        ctype = constraint.constraint_type
        if ctype == "required_field":
            return field_id == payload.get("field_id")
        if ctype == "earliest_time":
            t = parse_time(payload.get("time", "00:00"))
            return start.time() >= t
        if ctype == "latest_time":
            t = parse_time(payload.get("time", "23:59"))
            return start.time() <= t
        if ctype == "category_day":
            return start.date().isoformat() == payload.get("date")
        return False

    # ─── Hard constraint checking ────────────────────────────────────────

    def check_hard_constraints(
        self, match: ProvisionalMatch, field_id: int, start: datetime,
    ) -> bool:
        """Return True if all hard constraints are satisfied."""
        for hc in self._hard_constraints:
            payload = hc.payload or {}
            if payload.get("category_id") and payload["category_id"] != match.category_id:
                continue
            if payload.get("phase") and payload["phase"] != match.phase:
                continue
            ctype = hc.constraint_type
            if ctype == "earliest_time":
                t = parse_time(payload.get("time", "00:00"))
                if start.time() < t:
                    return False
            elif ctype == "latest_time":
                t = parse_time(payload.get("time", "23:59"))
                if start.time() > t:
                    return False
            elif ctype == "required_field":
                req_field = payload.get("field_id")
                if req_field and field_id != req_field:
                    return False
            elif ctype == "blocked_slot":
                blocked_date = payload.get("date")
                blocked_start = payload.get("start")
                blocked_end = payload.get("end")
                if blocked_date and blocked_start and blocked_end:
                    from datetime import date as dt_date

                    bd = dt_date.fromisoformat(blocked_date)
                    bs = datetime.combine(bd, parse_time(blocked_start), tzinfo=UTC)
                    be = datetime.combine(bd, parse_time(blocked_end), tzinfo=UTC)
                    end = start + timedelta(minutes=match.duration)
                    if start < be and end > bs:
                        return False
            elif ctype == "category_day":
                req_date = payload.get("date")
                if req_date and start.date().isoformat() != req_date:
                    return False
        return True

    # ─── Youth detection ─────────────────────────────────────────────────

    def category_is_youth(self, category_id: int) -> bool:
        return category_id in self._youth_categories

    # ─── Commit / remove placements ──────────────────────────────────────

    def commit_placement(self, placement: Placement) -> None:
        """Record a placement into all tracking structures."""
        m = placement.match
        start = placement.start_time
        end = start + timedelta(minutes=m.duration)
        end_with_transition = end + timedelta(minutes=m.transition)

        self._field_schedule[placement.field_id].append((start, end_with_transition))
        self._field_match_count[placement.field_id] = (
            self._field_match_count.get(placement.field_id, 0) + 1
        )
        self._total_placed += 1

        for tid in (m.team_home_id, m.team_away_id):
            if tid:
                self._team_schedule.setdefault(tid, []).append((start, end))

        self._category_schedule.setdefault(m.category_id, []).append((start, end))
        self.placements.append(placement)

    def remove_placement(self, placement: Placement) -> None:
        """Remove a placement from all tracking structures."""
        m = placement.match
        start = placement.start_time
        end = start + timedelta(minutes=m.duration)
        end_with_transition = end + timedelta(minutes=m.transition)

        sched = self._field_schedule.get(placement.field_id, [])
        try:
            sched.remove((start, end_with_transition))
        except ValueError:
            pass
        self._field_match_count[placement.field_id] = max(
            0, self._field_match_count.get(placement.field_id, 1) - 1,
        )
        self._total_placed = max(0, self._total_placed - 1)

        for tid in (m.team_home_id, m.team_away_id):
            if tid:
                tsched = self._team_schedule.get(tid, [])
                try:
                    tsched.remove((start, end))
                except ValueError:
                    pass

        csched = self._category_schedule.get(m.category_id, [])
        try:
            csched.remove((start, end))
        except ValueError:
            pass

        try:
            self.placements.remove(placement)
        except ValueError:
            pass

    # ─── Candidate start times ───────────────────────────────────────────

    def get_candidate_starts(self, field_id: int) -> list[datetime]:
        return self._field_candidate_starts.get(field_id, [])
