"""Scheduling domain types — immutable value objects where possible."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import StrEnum
from typing import Any


class Strategy(StrEnum):
    BALANCED = "balanced"
    COMPACT = "compact"
    CATEGORY_PRIORITY = "category_priority"


@dataclass(frozen=True)
class ProvisionalMatch:
    """Match à placer, pas encore en DB."""

    provisional_id: str
    category_id: int
    group_id: int | None
    phase: str  # "group" | "r16" | "quarter" | "semi" | "third" | "final"
    team_home_id: int | None
    team_away_id: int | None
    placeholder_home: str = ""
    placeholder_away: str = ""
    duration: int = 15
    transition: int = 5
    rest_needed: int = 20
    forced_date: date | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "provisional_id": self.provisional_id,
            "category_id": self.category_id,
            "group_id": self.group_id,
            "phase": self.phase,
            "team_home_id": self.team_home_id,
            "team_away_id": self.team_away_id,
            "placeholder_home": self.placeholder_home,
            "placeholder_away": self.placeholder_away,
            "duration": self.duration,
            "transition": self.transition,
            "rest_needed": self.rest_needed,
            "forced_date": self.forced_date.isoformat() if self.forced_date else None,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ProvisionalMatch:
        d = dict(data)
        if isinstance(d.get("forced_date"), str):
            d["forced_date"] = date.fromisoformat(d["forced_date"])
        return cls(**d)


@dataclass(frozen=True)
class Slot:
    field_id: int
    start: datetime
    end: datetime


@dataclass
class Placement:
    match: ProvisionalMatch
    field_id: int
    start_time: datetime
    score: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "match": self.match.to_dict(),
            "field_id": self.field_id,
            "start_time": self.start_time.isoformat(),
            "score": round(self.score, 2),
        }


@dataclass(frozen=True)
class Conflict:
    type: str  # "no_valid_slot", "hard_constraint_violated"
    match_id: str
    reason: str
    severity: str  # "hard" | "soft"

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "match_id": self.match_id,
            "reason": self.reason,
            "severity": self.severity,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Conflict:
        return cls(**data)


@dataclass(frozen=True)
class SoftWarning:
    type: str  # "long_wait", "unbalanced_field", "short_rest"
    message: str
    affected_team_id: int | None = None
    affected_match_id: str | None = None
    suggested_fix: dict[str, Any] | None = field(default=None)

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "message": self.message,
            "affected_team_id": self.affected_team_id,
            "affected_match_id": self.affected_match_id,
        }


@dataclass(frozen=True)
class SchedulingReport:
    placed_count: int
    total_count: int
    score: float  # 0-100
    hard_conflicts: list[Conflict]
    soft_warnings: list[SoftWarning]
    execution_time_ms: int
    strategy_used: Strategy

    def to_dict(self) -> dict[str, Any]:
        return {
            "placed_count": self.placed_count,
            "total_count": self.total_count,
            "score": round(self.score, 1),
            "hard_conflicts": [c.to_dict() for c in self.hard_conflicts],
            "soft_warnings": [w.to_dict() for w in self.soft_warnings],
            "execution_time_ms": self.execution_time_ms,
            "strategy_used": self.strategy_used.value,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SchedulingReport:
        return cls(
            placed_count=data["placed_count"],
            total_count=data["total_count"],
            score=data["score"],
            hard_conflicts=[Conflict.from_dict(c) for c in data["hard_conflicts"]],
            soft_warnings=[],
            execution_time_ms=data["execution_time_ms"],
            strategy_used=Strategy(data["strategy_used"]),
        )
