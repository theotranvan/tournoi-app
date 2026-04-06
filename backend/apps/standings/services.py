"""Standings computation with cache and head-to-head tiebreakers.

Cache strategy:
- Each group standings is cached under ``standings:group:{id}``
- TTL = 60s (safety net; normally invalidated on match finish)
- ``invalidate_standings()`` is called by signals when a match finishes
"""

from __future__ import annotations

from typing import TypedDict

from django.core.cache import cache

from apps.matches.models import Match

CACHE_TTL = 60  # seconds


class TeamStanding(TypedDict):
    team_id: int
    team_name: str
    played: int
    won: int
    drawn: int
    lost: int
    goals_for: int
    goals_against: int
    goal_difference: int
    points: int
    rank: int
    form: list[str]  # last 5 results: "W", "D", "L"


def _cache_key(group_id: int) -> str:
    return f"standings:group:{group_id}"


def invalidate_standings(group_id: int) -> None:
    """Delete cached standings for a group. Called from signals."""
    cache.delete(_cache_key(group_id))


def invalidate_category_standings(category_id: int) -> None:
    """Delete cached standings for all groups in a category."""
    from apps.teams.models import Group

    for gid in Group.objects.filter(category_id=category_id).values_list("id", flat=True):
        cache.delete(_cache_key(gid))


def compute_group_standings(group_id: int, *, bypass_cache: bool = False) -> list[TeamStanding]:
    """Compute standings for a group, with cache.

    Tiebreaker order (UEFA-style):
    1. Points
    2. Head-to-head points between tied teams
    3. Head-to-head goal difference
    4. Overall goal difference
    5. Overall goals scored
    """
    if not bypass_cache:
        cached = cache.get(_cache_key(group_id))
        if cached is not None:
            return cached

    from apps.teams.models import Group

    group = Group.objects.select_related("category").prefetch_related("teams").get(pk=group_id)
    category = group.category
    teams = list(group.teams.all())

    matches = list(
        Match.objects.filter(
            group=group,
            status=Match.Status.FINISHED,
        )
        .select_related("team_home", "team_away")
        .order_by("start_time")
    )

    # ── Accumulate stats ─────────────────────────────────────────────────
    stats: dict[int, dict] = {}
    for team in teams:
        stats[team.id] = {
            "team_id": team.id,
            "team_name": team.name,
            "played": 0,
            "won": 0,
            "drawn": 0,
            "lost": 0,
            "goals_for": 0,
            "goals_against": 0,
            "_results": [],  # chronological list of "W"/"D"/"L"
        }

    # Head-to-head record: h2h[(a,b)] = {"pts_a": 0, "pts_b": 0, "gd_a": 0, "gd_b": 0}
    h2h: dict[tuple[int, int], dict] = {}

    for match in matches:
        hid = match.team_home_id
        aid = match.team_away_id
        if hid not in stats or aid not in stats:
            continue
        if match.score_home is None or match.score_away is None:
            continue

        home = stats[hid]
        away = stats[aid]

        home["played"] += 1
        away["played"] += 1
        home["goals_for"] += match.score_home
        home["goals_against"] += match.score_away
        away["goals_for"] += match.score_away
        away["goals_against"] += match.score_home

        if match.score_home > match.score_away:
            home["won"] += 1
            away["lost"] += 1
            home["_results"].append("W")
            away["_results"].append("L")
        elif match.score_home < match.score_away:
            away["won"] += 1
            home["lost"] += 1
            home["_results"].append("L")
            away["_results"].append("W")
        else:
            home["drawn"] += 1
            away["drawn"] += 1
            home["_results"].append("D")
            away["_results"].append("D")

        # Head-to-head tracking
        key = (min(hid, aid), max(hid, aid))
        if key not in h2h:
            h2h[key] = {}
        rec = h2h[key]
        # Store points for each side
        for tid, sc_for, sc_ag in [(hid, match.score_home, match.score_away), (aid, match.score_away, match.score_home)]:
            rec.setdefault(f"pts_{tid}", 0)
            rec.setdefault(f"gd_{tid}", 0)
            if sc_for > sc_ag:
                rec[f"pts_{tid}"] += category.points_win
            elif sc_for == sc_ag:
                rec[f"pts_{tid}"] += category.points_draw
            else:
                rec[f"pts_{tid}"] += category.points_loss
            rec[f"gd_{tid}"] += sc_for - sc_ag

    # ── Compute derived fields ───────────────────────────────────────────
    for s in stats.values():
        s["points"] = (
            s["won"] * category.points_win
            + s["drawn"] * category.points_draw
            + s["lost"] * category.points_loss
        )
        s["goal_difference"] = s["goals_for"] - s["goals_against"]
        s["form"] = s.pop("_results")[-5:]  # last 5 results

    # ── Sort with head-to-head tiebreaker ────────────────────────────────
    team_list = list(stats.values())

    def _h2h_points(tid_a: int, tid_b: int) -> int:
        """Return h2h points advantage of a over b."""
        key = (min(tid_a, tid_b), max(tid_a, tid_b))
        rec = h2h.get(key, {})
        return rec.get(f"pts_{tid_a}", 0) - rec.get(f"pts_{tid_b}", 0)

    def _h2h_gd(tid_a: int, tid_b: int) -> int:
        key = (min(tid_a, tid_b), max(tid_a, tid_b))
        rec = h2h.get(key, {})
        return rec.get(f"gd_{tid_a}", 0) - rec.get(f"gd_{tid_b}", 0)

    import functools

    def _compare(a: dict, b: dict) -> int:
        """Compare two team standings. Returns negative if a < b (b ranks higher)."""
        # 1. Points
        if a["points"] != b["points"]:
            return b["points"] - a["points"]
        # 2. H2H points
        h2h_pts = _h2h_points(a["team_id"], b["team_id"])
        if h2h_pts != 0:
            return -h2h_pts  # positive h2h_pts means a is better
        # 3. H2H goal difference
        h2h_goal = _h2h_gd(a["team_id"], b["team_id"])
        if h2h_goal != 0:
            return -h2h_goal
        # 4. Overall goal difference
        if a["goal_difference"] != b["goal_difference"]:
            return b["goal_difference"] - a["goal_difference"]
        # 5. Goals scored
        return b["goals_for"] - a["goals_for"]

    team_list.sort(key=functools.cmp_to_key(_compare))

    standings: list[TeamStanding] = []
    for rank, entry in enumerate(team_list, start=1):
        entry["rank"] = rank
        standings.append(entry)  # type: ignore[arg-type]

    cache.set(_cache_key(group_id), standings, CACHE_TTL)
    return standings
