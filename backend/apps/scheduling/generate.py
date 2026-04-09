"""Schedule generation — slot-based algorithm ported from tournoi-exemple store.js.

Key concepts:
  - Day-based scheduling: each Day has start/end times and optional lunch break
  - Category-to-Day assignment: categories can be pinned to specific days
  - Slot-based placement: matches are placed in parallel across fields per time slot
  - Rest constraints: team_last_slot tracking ensures minimum rest between matches
  - Consecutive match limits: teams can't play too many back-to-back matches
  - Constraint relaxation: when stuck, force placement with a warning
  - Scheduling modes: CATEGORY_BLOCK (default) or INTERLEAVE
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from django.db import transaction

from apps.matches.models import Match
from apps.teams.models import Group

logger = logging.getLogger(__name__)


def _round_to_5(n: int) -> int:
    return max(5, round(n / 5) * 5)


def _fmt_time(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _parse_hhmm(s: str) -> int:
    """Parse 'HH:MM' to minutes since midnight."""
    h, m = s.split(":")
    return int(h) * 60 + int(m)


# ─── Round Robin Generation ─────────────────────────────────────────────────


def gen_round_robin(team_ids: list, group, category, tournament) -> list[dict]:
    """Generate round-robin matches for a group of teams.

    Uses the classic circle method: fix team[0], rotate the rest.
    """
    teams = list(team_ids)
    if len(teams) < 2:
        return []

    dur = _round_to_5(category.effective_match_duration)

    if len(teams) % 2 != 0:
        teams.append(None)  # BYE

    n = len(teams)
    fixed = teams[0]
    rot = teams[1:]
    matches = []

    for r in range(n - 1):
        cur = [fixed] + list(rot)
        for i in range(n // 2):
            h = cur[i]
            a = cur[n - 1 - i]
            if h is None or a is None:
                continue  # BYE match
            matches.append({
                "category": category,
                "group": group,
                "phase": "group",
                "team_home_id": h,
                "team_away_id": a,
                "duration": dur,
                "round": r,
            })
        # Rotate: move last element to front
        last = rot[-1]
        rot = [last] + rot[:-1]

    return matches


# ─── Rest Optimization ──────────────────────────────────────────────────────


def _optimize_rest(matches: list[dict], min_rest: int) -> list[dict]:
    """Reorder matches to maximize rest between same-team appearances.

    Direct port of store.js optimizeRest().
    """
    if len(matches) <= 1:
        return matches

    ordered = []
    remaining = list(matches)
    recent: list = []

    while remaining:
        best_idx = -1
        best_score = -1

        for i, m in enumerate(remaining):
            h = m["team_home_id"]
            a = m["team_away_id"]
            h_idx = recent.index(h) if h in recent else -1
            a_idx = recent.index(a) if a in recent else -1
            h_ok = h_idx == -1
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
        recent.append(m["team_home_id"])
        recent.append(m["team_away_id"])
        while len(recent) > min_rest * 2:
            recent.pop(0)

    return ordered


# ─── Auto-Generate Pools ────────────────────────────────────────────────────


def auto_generate_pools(category) -> dict:
    """Auto-generate balanced pools for a category.

    Tries to separate teams from the same club into different pools.
    Returns {"warnings": [...], "pools": [...]}
    """
    from apps.teams.models import Group, Team

    teams = list(Team.objects.filter(category=category).order_by("name"))
    if len(teams) < 2:
        return {"warnings": [f"{category.name}: moins de 2 équipes"], "pools": []}

    # Delete existing pools and related matches for this category
    old_pools = Group.objects.filter(category=category)
    Match.objects.filter(category=category).delete()
    old_pools.delete()

    n = len(teams)
    k = category.number_of_pools
    if k and k > 0:
        k = min(k, n // 2)
    else:
        if n <= 5:
            k = 1
        elif n <= 8:
            k = 2
        elif n <= 12:
            k = 3
        elif n <= 16:
            k = 4
        else:
            k = max(1, -(-n // 4))  # ceil(n/4)
    k = max(1, k)

    # Group teams by club name
    club_groups: dict[str, list] = {}
    for t in teams:
        key = (t.name.rsplit(" ", 1)[0] if hasattr(t, "name") else "").strip().lower()
        # Use coach_name or a club-related field if available
        # For simplicity, we group by name prefix (before last space)
        club_groups.setdefault(key, []).append(t)

    sorted_clubs = sorted(club_groups.items(), key=lambda x: -len(x[1]))
    pools: list[list] = [[] for _ in range(k)]
    warnings = []

    for club_key, club_teams in sorted_clubs:
        for team in club_teams:
            # Find pool without a team from same club
            avail = [
                (i, p) for i, p in enumerate(pools)
                if not any(
                    (t.name.rsplit(" ", 1)[0] if hasattr(t, "name") else "").strip().lower() == club_key
                    for t in p
                )
            ]
            avail.sort(key=lambda x: len(x[1]))
            if avail:
                avail[0][1].append(team)
            else:
                # Forced: put in smallest pool
                pools_sorted = sorted(enumerate(pools), key=lambda x: len(x[1]))
                pools_sorted[0][1].append(team)
                warnings.append(f"⚠️ {category.name}: {team.name} même poule qu'un coéquipier")

    created_pools = []
    for idx, pool_teams in enumerate(pools):
        if not pool_teams:
            continue
        group = Group.objects.create(
            category=category,
            name=f"Poule {chr(65 + idx)}",
            display_order=idx,
        )
        group.teams.set(pool_teams)
        created_pools.append(group)

    return {"warnings": warnings, "pools": created_pools}


# ─── Schedule Across Days (core algorithm from store.js) ─────────────────────


def _schedule_across_days(
    all_matches: list[dict],
    tournament,
    categories: list,
    fields: list,
    days: list,
    warnings: list[str],
) -> dict:
    """Place matches across days using slot-based parallel scheduling.

    Direct port of store.js scheduleAcrossDays().
    """
    scheduled = []

    # Pre-optimize rest per category
    by_cat: dict[int, list[dict]] = {}
    for cat in categories:
        cat_matches = [m for m in all_matches if m["category"].id == cat.id]
        min_rest = cat.min_rest_matches if cat.min_rest_matches is not None else tournament.default_min_rest_matches
        by_cat[cat.id] = _optimize_rest(cat_matches, min_rest)

    # Assign categories to days
    # Use object identity as key so virtual days (id=None) stay distinct.
    cats_by_day: dict[int, list] = {id(d): [] for d in days}
    unassigned = []
    for cat in categories:
        assigned = False
        if cat.day_id:
            for d in days:
                if getattr(d, "id", None) == cat.day_id:
                    cats_by_day[id(d)].append(cat)
                    assigned = True
                    break
        if not assigned:
            unassigned.append(cat)

    d_idx = 0
    for cat in unassigned:
        cats_by_day[id(days[d_idx % len(days)])].append(cat)
        d_idx += 1

    global_slot = 0

    for day in days:
        day_cats = cats_by_day[id(day)]
        if not day_cats:
            continue

        # Build day match list
        day_matches: list[dict] = []
        if tournament.scheduling_mode == "INTERLEAVE":
            arrs = [by_cat.get(c.id, []) for c in day_cats]
            idx = 0
            has_more = True
            while has_more:
                has_more = False
                for a in arrs:
                    if idx < len(a):
                        day_matches.append(a[idx])
                        has_more = True
                idx += 1
        else:
            # CATEGORY_BLOCK
            for cat in day_cats:
                day_matches.extend(by_cat.get(cat.id, []))

        # Day time boundaries
        start_min = _parse_hhmm(day.start_time)
        end_min = _parse_hhmm(day.end_time)

        lunch_start = _parse_hhmm(day.lunch_start) if day.lunch_start else None
        lunch_end = _parse_hhmm(day.lunch_end) if day.lunch_end else None

        cur_time = start_min
        team_last_slot: dict = {}
        team_consec: dict = {}

        while day_matches:
            # Skip lunch
            if lunch_start and cur_time >= lunch_start and cur_time < lunch_end:
                cur_time = lunch_end
                continue

            # Sample duration from first match
            sample_cat = day_matches[0]["category"]
            dur = _round_to_5(sample_cat.effective_match_duration)

            # Skip if match would overlap lunch
            if lunch_start and cur_time + dur > lunch_start and cur_time < lunch_start:
                cur_time = lunch_end
                continue

            # Check if we exceed day
            if cur_time + dur > end_min:
                return {
                    "success": False,
                    "matches": scheduled,
                    "warnings": warnings,
                    "error": (
                        f"{day.label or day.date}: {len(day_matches)} match(s) ne tiennent pas. "
                        f"Terrains: {len(fields)}, horaires: {day.start_time}–{day.end_time}"
                    ),
                }

            # Candidates: try to fill all fields simultaneously
            candidates = []
            for i, m in enumerate(day_matches):
                if len(candidates) >= len(fields) * 5:
                    break
                candidates.append({"m": m, "idx": i})

            used_teams = set()
            placed = set()
            slot_matches = []

            for fi in range(len(fields)):
                if not candidates:
                    break
                for c in candidates:
                    if c["idx"] in placed:
                        continue
                    m = c["m"]
                    cat = m["category"]

                    min_rest = cat.min_rest_matches if cat.min_rest_matches is not None else tournament.default_min_rest_matches
                    max_consec = cat.max_consecutive_matches if cat.max_consecutive_matches is not None else tournament.max_consecutive_matches

                    h_id = m["team_home_id"]
                    a_id = m["team_away_id"]

                    h_rest = 999 if h_id not in team_last_slot else global_slot - team_last_slot[h_id]
                    a_rest = 999 if a_id not in team_last_slot else global_slot - team_last_slot[a_id]

                    h_consec = team_consec.get(h_id, 0)
                    a_consec = team_consec.get(a_id, 0)

                    if (
                        h_rest >= min_rest
                        and a_rest >= min_rest
                        and h_consec < max_consec
                        and a_consec < max_consec
                        and h_id not in used_teams
                        and a_id not in used_teams
                    ):
                        m_dur = _round_to_5(cat.effective_match_duration)
                        slot_match = {
                            **m,
                            "field": fields[fi],
                            "scheduled_time": _fmt_time(cur_time),
                            "day": day,
                            "slot_index": global_slot,
                            "duration": m_dur,
                        }
                        slot_matches.append(slot_match)
                        used_teams.add(h_id)
                        used_teams.add(a_id)

                        # Update consecutive tracking
                        if h_rest == 1:
                            team_consec[h_id] = h_consec + 1
                        else:
                            team_consec[h_id] = 1
                        if a_rest == 1:
                            team_consec[a_id] = a_consec + 1
                        else:
                            team_consec[a_id] = 1

                        team_last_slot[h_id] = global_slot
                        team_last_slot[a_id] = global_slot
                        placed.add(c["idx"])
                        break

            if placed:
                # Remove placed from day_matches (in reverse order)
                for i in sorted(placed, reverse=True):
                    day_matches.pop(i)
                scheduled.extend(slot_matches)
            else:
                # Constraint relaxation: force place the first match
                m = day_matches[0]
                cat = m["category"]
                m_dur = _round_to_5(cat.effective_match_duration)

                forced = {
                    **m,
                    "field": fields[0],
                    "scheduled_time": _fmt_time(cur_time),
                    "day": day,
                    "slot_index": global_slot,
                    "duration": m_dur,
                }
                h_id = m["team_home_id"]
                a_id = m["team_away_id"]
                team_consec[h_id] = team_consec.get(h_id, 0) + 1
                team_consec[a_id] = team_consec.get(a_id, 0) + 1
                team_last_slot[h_id] = global_slot
                team_last_slot[a_id] = global_slot
                scheduled.append(forced)
                day_matches.pop(0)
                warnings.append("⚠️ Contrainte relaxée (repos/consécutif)")

            # Reset consecutive for teams not in this slot
            for tid in list(team_consec.keys()):
                if tid not in used_teams and team_last_slot.get(tid) != global_slot:
                    team_consec[tid] = 0

            # Advance time
            max_dur = max(
                (sm["duration"] for sm in slot_matches),
                default=tournament.default_match_duration,
            ) if slot_matches else tournament.default_match_duration

            max_chg = max(
                (
                    sm["category"].effective_transition_time
                    for sm in slot_matches
                ),
                default=tournament.default_transition_time,
            ) if slot_matches else tournament.default_transition_time

            cur_time += _round_to_5(max_dur) + max_chg
            global_slot += 1

    return {"success": True, "matches": scheduled, "warnings": warnings}


# ─── Feasibility Check ──────────────────────────────────────────────────────


def calculate_feasibility(tournament) -> dict:
    """Quick feasibility check before scheduling.

    Port of store.js calculateFeasibility().
    """
    from apps.tournaments.models import Category, Day, Field

    categories = list(Category.objects.filter(tournament=tournament).order_by("display_order"))
    fields = list(Field.objects.filter(tournament=tournament, is_active=True))
    days = list(Day.objects.filter(tournament=tournament).order_by("order"))

    # If no explicit Days, create virtual days from tournament date range
    if not days:
        from datetime import timedelta as td
        current = tournament.start_date
        virtual_days = []
        order = 0
        while current <= tournament.end_date:
            virtual_days.append(type("VDay", (), {
                "id": None, "date": current, "label": str(current),
                "start_time": "08:00", "end_time": "19:00",
                "lunch_start": "12:00", "lunch_end": "13:00",
                "order": order,
                "playable_minutes": lambda self=None, st="08:00", et="19:00", ls="12:00", le="13:00": (
                    _parse_hhmm(et) - _parse_hhmm(st) - (_parse_hhmm(le) - _parse_hhmm(ls))
                ),
            })())
            current += td(days=1)
            order += 1
        days = virtual_days

    groups = list(Group.objects.filter(category__tournament=tournament).prefetch_related("teams"))
    group_by_cat: dict[int, list] = defaultdict(list)
    for g in groups:
        group_by_cat[g.category_id].append(g)

    total_matches = 0
    cat_details = []

    for cat in categories:
        cm = 0
        for grp in group_by_cat.get(cat.id, []):
            n = grp.teams.count()
            cm += n * (n - 1) // 2
        dur = cat.effective_match_duration
        chg = cat.effective_transition_time
        cat_details.append({"cat": cat, "match_count": cm, "duration": dur, "changeover": chg})
        total_matches += cm

    # Assign categories to days
    cats_by_day: dict = {}
    for d in days:
        cats_by_day[id(d)] = []
    unassigned_ids = []
    for cat in categories:
        assigned = False
        if cat.day_id:
            for d in days:
                if hasattr(d, 'id') and d.id == cat.day_id:
                    cats_by_day[id(d)].append(cat.id)
                    assigned = True
                    break
        if not assigned:
            unassigned_ids.append(cat.id)

    di = 0
    for cid in unassigned_ids:
        cats_by_day[id(days[di % len(days)])].append(cid)
        di += 1

    day_details = []
    total_slots = 0

    for day in days:
        playable = day.playable_minutes() if hasattr(day, 'playable_minutes') and callable(day.playable_minutes) else _calc_playable(day)
        day_cat_ids = cats_by_day.get(id(day), [])
        dcd = [cd for cd in cat_details if cd["cat"].id in day_cat_ids]

        day_mc = sum(cd["match_count"] for cd in dcd)
        avg_dur = tournament.default_match_duration
        avg_chg = tournament.default_transition_time
        if dcd:
            avg_dur = sum(cd["duration"] for cd in dcd) / len(dcd)
            avg_chg = sum(cd["changeover"] for cd in dcd) / len(dcd)

        avg_slot = avg_dur + avg_chg
        spd = int(playable // avg_slot) if avg_slot > 0 else 0
        ps = spd * len(fields)
        total_slots += ps

        day_details.append({
            "day": getattr(day, "label", str(getattr(day, "date", ""))),
            "playable_min": playable,
            "slots_per_day": spd,
            "parallel_slots": ps,
            "day_match_count": day_mc,
            "feasible": ps >= day_mc,
        })

    return {
        "total_matches": total_matches,
        "total_available_slots": total_slots,
        "feasible": len(days) > 0 and all(d["feasible"] for d in day_details),
        "utilization": round(total_matches / total_slots * 100) if total_slots > 0 else 0,
        "cat_details": [
            {"name": cd["cat"].name, "match_count": cd["match_count"]}
            for cd in cat_details
        ],
        "day_details": day_details,
        "fields_count": len(fields),
        "days_count": len(days),
    }


def _calc_playable(day) -> int:
    """Fallback playable minutes calc for virtual days."""
    start = _parse_hhmm(day.start_time)
    end = _parse_hhmm(day.end_time)
    lunch = 0
    if day.lunch_start and day.lunch_end:
        lunch = _parse_hhmm(day.lunch_end) - _parse_hhmm(day.lunch_start)
    return max(0, end - start - lunch)


# ─── Main Generate Schedule ─────────────────────────────────────────────────


@transaction.atomic
def generate_schedule(tournament) -> dict:
    """Generate full schedule for a tournament.

    Port of store.js generateSchedule().
    Returns {"success": bool, "warnings": [...], "stats": {...}} or {"success": False, "error": "..."}
    """
    from apps.tournaments.models import Category, Day, Field

    categories = list(Category.objects.filter(tournament=tournament).order_by("display_order"))
    fields = list(Field.objects.filter(tournament=tournament, is_active=True).order_by("display_order"))
    days = list(Day.objects.filter(tournament=tournament).order_by("order"))
    warnings: list[str] = []

    if not categories:
        return {"success": False, "error": "Aucune catégorie"}
    if not fields:
        return {"success": False, "error": "Aucun terrain"}
    if not days:
        current = tournament.start_date
        order = 0
        virtual_days = []
        while current <= tournament.end_date:
            virtual_days.append(type("VDay", (), {
                "id": None,
                "pk": None,
                "date": current,
                "label": str(current),
                "start_time": "08:00",
                "end_time": "19:00",
                "lunch_start": "12:00",
                "lunch_end": "13:00",
                "order": order,
            })())
            current += timedelta(days=1)
            order += 1
        days = virtual_days
        warnings.append(
            "⚠️ Aucune journée configurée: génération sur les dates du tournoi (08:00–19:00)."
        )

    groups = list(Group.objects.filter(category__tournament=tournament).prefetch_related("teams"))
    group_by_cat: dict[int, list] = defaultdict(list)
    for g in groups:
        group_by_cat[g.category_id].append(g)

    # Validate: each category must have pools with ≥2 teams
    for cat in categories:
        cat_groups = group_by_cat.get(cat.id, [])
        if not cat_groups:
            return {"success": False, "error": f"{cat.name}: aucune poule"}
        for grp in cat_groups:
            if grp.teams.count() < 2:
                return {"success": False, "error": f"{cat.name} {grp.name}: <2 équipes"}

    # Delete existing scheduled matches
    cat_ids = [c.id for c in categories]
    Match.objects.filter(category_id__in=cat_ids, is_locked=False).delete()

    # Generate round-robin matches for all pools
    all_matches: list[dict] = []
    for cat in categories:
        for grp in group_by_cat.get(cat.id, []):
            team_ids = list(grp.teams.values_list("id", flat=True))
            all_matches.extend(gen_round_robin(team_ids, grp, cat, tournament))

    # Reset pool team standings will happen via standings service when matches finish

    # Schedule across days
    result = _schedule_across_days(all_matches, tournament, categories, fields, days, warnings)

    if not result["success"]:
        return result

    # Create Match objects
    match_objects = []
    for sm in result["matches"]:
        match_objects.append(Match(
            tournament=tournament,
            category=sm["category"],
            group=sm["group"],
            phase=sm["phase"],
            team_home_id=sm["team_home_id"],
            team_away_id=sm["team_away_id"],
            field=sm["field"],
            start_time=_build_datetime(sm["day"].date, sm["scheduled_time"]),
            duration_minutes=sm["duration"],
            status=Match.Status.SCHEDULED,
            day=sm["day"] if hasattr(sm["day"], "pk") and sm["day"].pk else None,
            slot_index=sm["slot_index"],
        ))

    if match_objects:
        Match.objects.bulk_create(match_objects)

    tournament.status = "pools_generated"
    tournament.save(update_fields=["status"])

    return {
        "success": True,
        "warnings": warnings,
        "stats": {
            "total_matches": len(match_objects),
            "total_pools": sum(len(group_by_cat.get(c.id, [])) for c in categories),
        },
    }


def _build_datetime(date, time_str: str) -> datetime:
    """Build a timezone-aware datetime from a date and HH:MM string."""
    h, m = map(int, time_str.split(":"))
    return datetime(date.year, date.month, date.day, h, m, tzinfo=UTC)


# ─── Generate Finals ────────────────────────────────────────────────────────


@transaction.atomic
def generate_finals(category) -> dict:
    """Generate knockout/finals matches for a category after pool phase.

    Port of store.js generateFinals().
    Returns {"success": bool, "match_count": int} or {"success": False, "error": "..."}
    """
    from apps.standings.services import compute_group_standings
    from apps.tournaments.models import Day, Field

    tournament = category.tournament
    groups = list(
        Group.objects.filter(category=category)
        .order_by("display_order")
        .prefetch_related("teams")
    )

    if not groups:
        return {"success": False, "error": "Aucune poule"}

    # Check all pool matches are finished
    pool_matches = Match.objects.filter(category=category, phase=Match.Phase.GROUP)
    incomplete = pool_matches.exclude(status=Match.Status.FINISHED).count()
    if incomplete > 0:
        return {"success": False, "error": f"{incomplete} match(s) non terminé(s)"}

    # Delete existing knockout matches for this category
    Match.objects.filter(category=category).exclude(phase=Match.Phase.GROUP).delete()

    dur = _round_to_5(category.effective_match_duration)

    # Get rankings per pool
    rankings = []
    for grp in groups:
        standings = compute_group_standings(grp.id, bypass_cache=True)
        rankings.append(standings)

    finals_matches = []

    if len(groups) == 1:
        # Single pool: 1st vs 2nd
        r = rankings[0]
        if len(r) >= 2:
            finals_matches.append({
                "phase": Match.Phase.FINAL,
                "team_home_id": r[0]["team_id"],
                "team_away_id": r[1]["team_id"],
                "placeholder_home": f"1er {groups[0].name}",
                "placeholder_away": f"2e {groups[0].name}",
                "round": 0,
                "source_home": None,
                "source_away": None,
                "source_home_type": "",
                "source_away_type": "",
            })

    elif len(groups) == 2:
        # 2 pools: semi-finals + third-place + final
        s1_data = {
            "phase": Match.Phase.SEMI,
            "team_home_id": rankings[0][0]["team_id"] if rankings[0] else None,
            "team_away_id": rankings[1][1]["team_id"] if len(rankings[1]) > 1 else None,
            "placeholder_home": f"1er {groups[0].name}",
            "placeholder_away": f"2e {groups[1].name}",
            "round": 0,
        }
        s2_data = {
            "phase": Match.Phase.SEMI,
            "team_home_id": rankings[1][0]["team_id"] if rankings[1] else None,
            "team_away_id": rankings[0][1]["team_id"] if len(rankings[0]) > 1 else None,
            "placeholder_home": f"1er {groups[1].name}",
            "placeholder_away": f"2e {groups[0].name}",
            "round": 0,
        }
        finals_matches.append(s1_data)
        finals_matches.append(s2_data)

        # Third place and final will reference semis (source_home/away set after creation)
        finals_matches.append({
            "phase": Match.Phase.THIRD_PLACE,
            "team_home_id": None,
            "team_away_id": None,
            "placeholder_home": "Perdant D1",
            "placeholder_away": "Perdant D2",
            "round": 1,
            "_source_home_idx": 0,  # index in finals_matches
            "_source_away_idx": 1,
            "_source_home_type": "loser",
            "_source_away_type": "loser",
        })
        finals_matches.append({
            "phase": Match.Phase.FINAL,
            "team_home_id": None,
            "team_away_id": None,
            "placeholder_home": "Vainqueur D1",
            "placeholder_away": "Vainqueur D2",
            "round": 1,
            "_source_home_idx": 0,
            "_source_away_idx": 1,
            "_source_home_type": "winner",
            "_source_away_type": "winner",
        })

    else:
        # 3+ pools: qualified teams
        qual = []
        for i, grp in enumerate(groups):
            if rankings[i]:
                qual.append({
                    "team": rankings[i][0],
                    "pool_name": grp.name,
                    "rank": 1,
                })
            if category.finals_format != "TOP1_FINAL" and len(rankings[i]) > 1:
                qual.append({
                    "team": rankings[i][1],
                    "pool_name": grp.name,
                    "rank": 2,
                })

        if len(qual) >= 4:
            s1_data = {
                "phase": Match.Phase.SEMI,
                "team_home_id": qual[0]["team"]["team_id"],
                "team_away_id": qual[-1]["team"]["team_id"],
                "placeholder_home": f"1er {qual[0]['pool_name']}",
                "placeholder_away": f"{qual[-1]['pool_name']}",
                "round": 0,
            }
            s2_data = {
                "phase": Match.Phase.SEMI,
                "team_home_id": qual[1]["team"]["team_id"],
                "team_away_id": qual[-2]["team"]["team_id"],
                "placeholder_home": f"{qual[1]['pool_name']}",
                "placeholder_away": f"{qual[-2]['pool_name']}",
                "round": 0,
            }
            finals_matches.append(s1_data)
            finals_matches.append(s2_data)
            finals_matches.append({
                "phase": Match.Phase.FINAL,
                "team_home_id": None,
                "team_away_id": None,
                "placeholder_home": "V. D1",
                "placeholder_away": "V. D2",
                "round": 1,
                "_source_home_idx": 0,
                "_source_away_idx": 1,
                "_source_home_type": "winner",
                "_source_away_type": "winner",
            })
        elif len(qual) >= 2:
            finals_matches.append({
                "phase": Match.Phase.FINAL,
                "team_home_id": qual[0]["team"]["team_id"],
                "team_away_id": qual[1]["team"]["team_id"],
                "placeholder_home": f"{qual[0]['pool_name']}",
                "placeholder_away": f"{qual[1]['pool_name']}",
                "round": 0,
            })

    if not finals_matches:
        return {"success": False, "error": "Pas assez d'équipes qualifiées"}

    # Determine scheduling for finals slots
    last_pool = (
        Match.objects.filter(category=category, phase=Match.Phase.GROUP)
        .order_by("-slot_index")
        .first()
    )
    slot = (last_pool.slot_index or 0) + 2 if last_pool else 0
    last_time = last_pool.start_time if last_pool else None

    if last_time:
        cur_minutes = last_time.hour * 60 + last_time.minute + (last_pool.duration_minutes or 10) + 10
    else:
        cur_minutes = 9 * 60  # 09:00 fallback

    fields_list = list(Field.objects.filter(tournament=tournament, is_active=True).order_by("display_order"))
    day_obj = last_pool.day if last_pool else None
    date = last_pool.start_time.date() if last_pool and last_pool.start_time else tournament.start_date

    # Create Match objects in order, tracking created IDs for source references
    created_matches = []
    by_round: dict[int, list] = defaultdict(list)
    for idx, fm in enumerate(finals_matches):
        by_round[fm.get("round", 0)].append((idx, fm))

    created_db_matches: list[Match | None] = [None] * len(finals_matches)

    for r in sorted(by_round.keys()):
        fi = 0
        for idx, fm in by_round[r]:
            # Resolve source references
            source_home = None
            source_away = None
            source_home_type = fm.get("_source_home_type", "")
            source_away_type = fm.get("_source_away_type", "")

            if "_source_home_idx" in fm:
                source_home = created_db_matches[fm["_source_home_idx"]]
            if "_source_away_idx" in fm:
                source_away = created_db_matches[fm["_source_away_idx"]]

            match = Match(
                tournament=tournament,
                category=category,
                phase=fm["phase"],
                team_home_id=fm.get("team_home_id"),
                team_away_id=fm.get("team_away_id"),
                placeholder_home=fm.get("placeholder_home", ""),
                placeholder_away=fm.get("placeholder_away", ""),
                field=fields_list[fi % len(fields_list)] if fields_list else None,
                start_time=_build_datetime(date, _fmt_time(cur_minutes)),
                duration_minutes=dur,
                status=Match.Status.SCHEDULED,
                day=day_obj,
                slot_index=slot,
                source_home=source_home,
                source_away=source_away,
                source_home_type=source_home_type,
                source_away_type=source_away_type,
            )
            match.save()
            created_db_matches[idx] = match
            fi += 1

        cur_minutes += dur + 5
        slot += 1

    return {
        "success": True,
        "match_count": len([m for m in created_db_matches if m is not None]),
    }


# ─── Propagate Winner (for knockout bracket) ────────────────────────────────


def propagate_winner(match: Match) -> int:
    """After a knockout match finishes, propagate winner/loser to next round.

    Port of store.js propagateWinner().
    Returns number of matches updated.
    """
    if match.score_home is None or match.score_away is None:
        return 0

    if match.score_home > match.score_away:
        winner_id = match.team_home_id
        loser_id = match.team_away_id
    elif match.score_away > match.score_home:
        winner_id = match.team_away_id
        loser_id = match.team_home_id
    elif match.penalty_score_home is not None and match.penalty_score_away is not None:
        if match.penalty_score_home > match.penalty_score_away:
            winner_id = match.team_home_id
            loser_id = match.team_away_id
        else:
            winner_id = match.team_away_id
            loser_id = match.team_home_id
    else:
        return 0  # Draw with no penalties — can't propagate

    updated = 0
    # Find matches referencing this match as source
    next_matches = Match.objects.filter(
        category=match.category,
    ).exclude(phase=Match.Phase.GROUP).filter(
        models_q_source_home_or_away(match.id)
    )

    for nm in next_matches:
        changed = False
        if nm.source_home_id == match.id:
            if nm.source_home_type == "winner":
                nm.team_home_id = winner_id
            else:
                nm.team_home_id = loser_id
            changed = True
        if nm.source_away_id == match.id:
            if nm.source_away_type == "winner":
                nm.team_away_id = winner_id
            else:
                nm.team_away_id = loser_id
            changed = True
        if changed:
            nm.save(update_fields=["team_home_id", "team_away_id", "updated_at"])
            updated += 1

    return updated


def models_q_source_home_or_away(match_id):
    """Build a Q filter for matches referencing this match as source."""
    from django.db.models import Q
    return Q(source_home_id=match_id) | Q(source_away_id=match_id)
