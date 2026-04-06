"""Debug endpoints — only available when DEBUG=True."""

import logging

from django.conf import settings
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class DebugWSGroupsView(APIView):
    """GET /api/v1/debug/ws-groups/ — List active WebSocket channel groups."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        if not settings.DEBUG:
            return Response({"error": "Only available in DEBUG mode"}, status=403)

        try:
            from channels.layers import get_channel_layer

            layer = get_channel_layer()
            info = {
                "backend": type(layer).__name__,
                "config": str(getattr(layer, "hosts", "N/A")),
            }
        except Exception as e:
            info = {"error": str(e)}

        return Response(info)


class DebugCeleryQueueView(APIView):
    """GET /api/v1/debug/celery-queue/ — Inspect Celery workers and queues."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        if not settings.DEBUG:
            return Response({"error": "Only available in DEBUG mode"}, status=403)

        try:
            from kickoff.celery import app as celery_app

            inspector = celery_app.control.inspect(timeout=3.0)
            data = {
                "active": inspector.active() or {},
                "reserved": inspector.reserved() or {},
                "scheduled": inspector.scheduled() or {},
                "stats": inspector.stats() or {},
            }
        except Exception as e:
            data = {"error": str(e)}

        return Response(data)
