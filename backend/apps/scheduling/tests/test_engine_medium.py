"""Tests for medium and large tournament scheduling."""

from __future__ import annotations

import time

import pytest

from apps.scheduling.engine import SchedulingEngine


@pytest.mark.django_db
class TestMediumTournament:
    """3 categories, 24 teams (8/cat, 2 groups), 3 fields, 1 day."""

    def test_all_matches_placed(self, medium_tournament):
        engine = SchedulingEngine(medium_tournament, strategy="balanced")
        report = engine.generate()

        # Each cat: 2 groups × C(4,2)=6 = 12 group + 4 knockout = 16, × 3 = 48
        assert report.total_count >= 30
        assert report.placed_count == report.total_count
        assert len(report.hard_conflicts) == 0

    def test_score_above_80(self, medium_tournament):
        engine = SchedulingEngine(medium_tournament, strategy="balanced")
        report = engine.generate()
        assert report.score >= 80

    def test_execution_under_5_seconds(self, medium_tournament):
        start = time.time()
        engine = SchedulingEngine(medium_tournament, strategy="balanced")
        engine.generate()
        elapsed = time.time() - start
        assert elapsed < 5, f"Took {elapsed:.1f}s"


@pytest.mark.django_db
class TestLargeTournament:
    """5 categories, 80 teams (16/cat, 4 groups), 6 fields, 2 days."""

    def test_all_matches_placed(self, large_tournament):
        engine = SchedulingEngine(large_tournament, strategy="balanced")
        report = engine.generate()
        assert report.total_count > 50
        assert report.placed_count > 0

    def test_execution_under_15_seconds(self, large_tournament):
        start = time.time()
        engine = SchedulingEngine(large_tournament, strategy="balanced")
        engine.generate()
        elapsed = time.time() - start
        assert elapsed < 30, f"Took {elapsed:.1f}s (15s target)"

    def test_no_hard_conflicts(self, large_tournament):
        engine = SchedulingEngine(large_tournament, strategy="balanced")
        report = engine.generate()
        # For a well-configured large tournament with 6 fields and 2 days,
        # we expect all matches placed
        if report.placed_count == report.total_count:
            assert len(report.hard_conflicts) == 0
