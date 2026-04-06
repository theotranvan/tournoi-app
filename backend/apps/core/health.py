from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "status": "ok",
                "version": "1.0.0",
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
