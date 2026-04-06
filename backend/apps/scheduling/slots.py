"""Enumerate time slots from field availability."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

from apps.scheduling.types import Slot


def parse_time(s: str) -> time:
    parts = s.split(":")
    return time(int(parts[0]), int(parts[1]))


def parse_date(s: str) -> date:
    return date.fromisoformat(s)


def enumerate_field_slots(
    field_id: int,
    availability: list[dict],
    granularity_minutes: int = 5,
) -> list[Slot]:
    """Generate fine-grained slots for a field based on its availability windows."""
    slots: list[Slot] = []
    delta = timedelta(minutes=granularity_minutes)
    for avail in availability:
        day = parse_date(avail["date"])
        start_dt = datetime.combine(day, parse_time(avail["start"]))
        end_dt = datetime.combine(day, parse_time(avail["end"]))
        current = start_dt
        while current < end_dt:
            slots.append(Slot(field_id=field_id, start=current, end=current + delta))
            current += delta
    return slots
