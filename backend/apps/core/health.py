import logging
import os

from django.conf import settings
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

# Deployed image SHA — set via IMAGE_TAG env var in docker-compose.prod.yml
_DEPLOYED_SHA = os.environ.get("IMAGE_TAG", "dev")


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "status": "ok",
                "version": _DEPLOYED_SHA,
                "timestamp": timezone.now().isoformat(),
            }
        )


class HealthDBView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        checks = {"database": False}
        try:
            from django.db import connection

            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            checks["database"] = True
        except Exception:
            pass

        all_ok = all(checks.values())
        return Response(
            {
                "status": "ok" if all_ok else "degraded",
                "checks": checks,
                "timestamp": timezone.now().isoformat(),
            },
            status=200 if all_ok else 503,
        )


class HealthRedisView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        ok = False
        try:
            from django.core.cache import cache

            cache.set("_health_check", "1", timeout=5)
            ok = cache.get("_health_check") == "1"
        except Exception:
            logger.exception("Redis health check failed")

        return Response(
            {
                "status": "ok" if ok else "degraded",
                "checks": {"redis": ok},
                "timestamp": timezone.now().isoformat(),
            },
            status=200 if ok else 503,
        )


class HealthCeleryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        ok = False
        try:
            from kickoff.celery import app as celery_app

            inspector = celery_app.control.inspect(timeout=2.0)
            active = inspector.active_queues()
            ok = active is not None and len(active) > 0
        except Exception:
            logger.exception("Celery health check failed")

        return Response(
            {
                "status": "ok" if ok else "degraded",
                "checks": {"celery": ok},
                "timestamp": timezone.now().isoformat(),
            },
            status=200 if ok else 503,
        )


class HealthFullView(APIView):
    """Aggregate health check for all subsystems."""

    permission_classes = [AllowAny]

    def get(self, request):
        checks = {
            "database": False,
            "redis": False,
            "celery": False,
        }

        # Database
        try:
            from django.db import connection

            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            checks["database"] = True
        except Exception:
            pass

        # Redis
        try:
            from django.core.cache import cache

            cache.set("_health_full", "1", timeout=5)
            checks["redis"] = cache.get("_health_full") == "1"
        except Exception:
            pass

        # Celery
        try:
            from kickoff.celery import app as celery_app

            inspector = celery_app.control.inspect(timeout=2.0)
            active = inspector.active_queues()
            checks["celery"] = active is not None and len(active) > 0
        except Exception:
            pass

        all_ok = all(checks.values())
        return Response(
            {
                "status": "ok" if all_ok else "degraded",
                "checks": checks,
                "timestamp": timezone.now().isoformat(),
            },
            status=200 if all_ok else 503,
        )
