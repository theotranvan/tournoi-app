import logging

import requests
from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

FFF_API_URL = "https://api-dofa.fff.fr/api/clubs"
CACHE_TTL = 60 * 60  # 1 hour


class ClubSearchFFFView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response([])

        cache_key = f"fff_club_{q.lower()}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            resp = requests.get(
                FFF_API_URL,
                params={"clNom": q},
                headers={"Accept": "application/json"},
                timeout=5,
            )
            resp.raise_for_status()
        except (requests.RequestException, ValueError):
            logger.warning("FFF API request failed for query=%s", q)
            return Response([])

        try:
            data = resp.json()
        except ValueError:
            return Response([])

        # The API may return {"hydra:member": [...]} or a plain list
        clubs_raw = data.get("hydra:member", data) if isinstance(data, dict) else data
        if not isinstance(clubs_raw, list):
            return Response([])

        results = []
        for club in clubs_raw:
            results.append(
                {
                    "fff_id": club.get("cl_cod"),
                    "name": club.get("name"),
                    "short_name": club.get("shortName") or club.get("short_name"),
                    "city": club.get("location"),
                    "postal_code": club.get("postal_code") or club.get("cp"),
                    "logo": club.get("logo"),
                    "colors": club.get("colors"),
                    "latitude": club.get("latitude"),
                    "longitude": club.get("longitude"),
                }
            )

        cache.set(cache_key, results, CACHE_TTL)
        return Response(results)
