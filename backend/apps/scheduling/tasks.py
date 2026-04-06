"""Celery tasks for scheduling engine."""

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def generate_schedule_task(self, tournament_id: str, strategy: str = "balanced"):
    """Generate a full schedule asynchronously.

    Publishes progress updates via the task meta (polled by the status endpoint)
    AND via WebSocket (pushed to connected clients).
    On success, commits the schedule to DB in a single atomic transaction.
    """
    from apps.realtime.broadcasters import (
        broadcast_schedule_updated,
        broadcast_task_completed,
        broadcast_task_failed,
        broadcast_task_progress,
    )
    from apps.scheduling.engine import SchedulingEngine
    from apps.tournaments.models import Tournament

    task_id = self.request.id

    tournament = Tournament.objects.get(id=tournament_id)
    engine = SchedulingEngine(tournament, strategy=strategy)

    def _on_progress(pct: int, msg: str) -> None:
        self.update_state(state="PROGRESS", meta={"percent": pct, "message": msg})
        broadcast_task_progress(task_id, pct, msg)

    engine.set_progress_callback(_on_progress)

    try:
        report = engine.generate()

        # commit_to_db is @transaction.atomic — if bulk_create fails,
        # the DELETE is rolled back automatically.
        engine.commit_to_db()

        result = report.to_dict()
        result["status"] = "success"

        broadcast_task_completed(task_id, result)
        broadcast_schedule_updated(tournament)

        return result

    except Exception as exc:
        logger.exception("Schedule generation failed for tournament %s", tournament_id)
        # Transaction (if any) is already rolled back at this point.
        broadcast_task_failed(task_id, str(exc))
        raise self.retry(exc=exc, countdown=30)
