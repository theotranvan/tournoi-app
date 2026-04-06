"""
Security tests — ensure all protected endpoints require authentication
and that unauthenticated requests are rejected.
"""

import uuid

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from tests.factories import (
    CategoryFactory,
    ClubFactory,
    FieldFactory,
    MatchFactory,
    TeamFactory,
    TournamentFactory,
    UserFactory,
)


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def setup_data(db):
    """Create a full tournament hierarchy for endpoint tests."""
    user = UserFactory()
    club = ClubFactory(owner=user)
    tournament = TournamentFactory(club=club)
    category = CategoryFactory(tournament=tournament)
    field = FieldFactory(tournament=tournament)
    team = TeamFactory(tournament=tournament, category=category)
    match = MatchFactory(tournament=tournament, category=category)
    return {
        "user": user,
        "club": club,
        "tournament": tournament,
        "category": category,
        "field": field,
        "team": team,
        "match": match,
    }


# ─── Parametrized: All protected endpoints must return 401 for anon ─────────

PROTECTED_ENDPOINTS = [
    # Tournaments CRUD
    ("get", "/api/v1/tournaments/", None),
    ("post", "/api/v1/tournaments/", {"name": "Test", "start_date": "2025-01-01", "end_date": "2025-01-02"}),
    # Auth: me
    ("get", "/api/v1/auth/me/", None),
    # Notifications
    ("get", "/api/v1/notifications/", None),
    # Subscriptions
    ("get", "/api/v1/subscriptions/status/", None),
    ("post", "/api/v1/subscriptions/checkout/", {"plan": "monthly"}),
    ("post", "/api/v1/subscriptions/portal/", {}),
]


@pytest.mark.parametrize("method,url,payload", PROTECTED_ENDPOINTS)
def test_anon_gets_401_or_403(anon_client, method, url, payload, db):
    """Unauthenticated requests to protected endpoints must return 401 or 403."""
    fn = getattr(anon_client, method)
    if payload is not None:
        resp = fn(url, data=payload, format="json")
    else:
        resp = fn(url)
    assert resp.status_code in (
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    ), (
        f"{method.upper()} {url} returned {resp.status_code}, expected 401 or 403"
    )


# ─── Parametrized: Tournament-nested endpoints need auth ────────────────────

def _nested_endpoints(tid, cid, mid, team_pk, fid):
    """Return list of (method, url, payload) for nested tournament endpoints."""
    base = f"/api/v1/tournaments/{tid}"
    return [
        # Categories
        ("get", f"{base}/categories/", None),
        ("post", f"{base}/categories/", {"name": "U12"}),
        # Fields
        ("get", f"{base}/fields/", None),
        ("post", f"{base}/fields/", {"name": "Terrain X"}),
        # Teams
        ("get", f"{base}/teams/", None),
        ("post", f"{base}/teams/", {"name": "Team X", "category": str(cid)}),
        # Matches
        ("get", f"{base}/matches/", None),
        # Match actions
        ("post", f"{base}/matches/{mid}/start/", {}),
        ("post", f"{base}/matches/{mid}/score/", {"score_home": 1, "score_away": 0}),
        # Schedule
        ("get", f"{base}/schedule/", None),
        ("post", f"{base}/schedule/generate/", {"strategy": "default"}),
        # Tournament actions
        ("post", f"{base}/publish/", {}),
        ("post", f"{base}/start/", {}),
        ("post", f"{base}/finish/", {}),
        ("post", f"{base}/duplicate/", {}),
    ]


def test_nested_endpoints_require_auth(anon_client, setup_data):
    """All tournament-nested endpoints must reject unauthenticated requests."""
    d = setup_data
    endpoints = _nested_endpoints(
        d["tournament"].id,
        d["category"].id,
        d["match"].id,
        d["team"].pk,
        d["field"].pk,
    )
    for method, url, payload in endpoints:
        fn = getattr(anon_client, method)
        if payload is not None:
            resp = fn(url, data=payload, format="json")
        else:
            resp = fn(url)
        assert resp.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        ), (
            f"{method.upper()} {url} returned {resp.status_code}, expected 401 or 403"
        )


# ─── Public endpoints should remain accessible ─────────────────────────────

PUBLIC_ENDPOINTS = [
    ("get", "/api/v1/health/"),
    ("get", "/api/v1/health/db/"),
    ("post", "/api/v1/auth/register/"),
    ("post", "/api/v1/auth/login/"),
    ("post", "/api/v1/auth/team-access/"),
    ("post", "/api/v1/auth/refresh/"),
]


@pytest.mark.parametrize("method,url", PUBLIC_ENDPOINTS)
def test_public_endpoints_dont_require_auth(anon_client, method, url, db):
    """Public endpoints should not return 401 (may return 400/422 for missing data)."""
    fn = getattr(anon_client, method)
    resp = fn(url, data={}, format="json")
    assert resp.status_code != status.HTTP_401_UNAUTHORIZED, (
        f"{method.upper()} {url} returned 401 — should be publicly accessible"
    )


# ─── Access code not leaked in serializers ──────────────────────────────────

def test_access_code_not_in_public_tournament(anon_client, setup_data):
    """Public tournament endpoint must NOT expose team access codes."""
    tournament = setup_data["tournament"]
    tournament.status = "published"
    tournament.save(update_fields=["status"])

    resp = anon_client.get(f"/api/v1/public/tournaments/{tournament.slug}/")
    if resp.status_code == 200:
        data = resp.json()
        _assert_no_access_code(data)


def _assert_no_access_code(data):
    """Recursively check that no 'access_code' key appears in the response."""
    if isinstance(data, dict):
        assert "access_code" not in data, "access_code leaked in public API response!"
        for v in data.values():
            _assert_no_access_code(v)
    elif isinstance(data, list):
        for item in data:
            _assert_no_access_code(item)


# ─── Rate limiting smoke test ───────────────────────────────────────────────

def test_team_access_rate_limit(anon_client, db):
    """TeamAccessView should be throttled (returns 429 after many requests)."""
    # Send many requests rapidly — at least one should be throttled
    responses = []
    for _ in range(25):
        resp = anon_client.post(
            "/api/v1/auth/team-access/",
            data={"access_code": "INVALID1"},
            format="json",
        )
        responses.append(resp.status_code)
        if resp.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            break

    assert status.HTTP_429_TOO_MANY_REQUESTS in responses, (
        "TeamAccessView should be rate-limited but no 429 was returned"
    )
