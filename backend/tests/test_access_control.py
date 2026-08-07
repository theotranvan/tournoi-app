"""Object-level access control (multi-tenant isolation).

Regression tests for the IDOR class of bugs: role-based permissions
(``IsOrganizer``) let *any* organizer through, so nested resources must also be
scoped to the tournament the requester actually owns. These assert that a second
organizer ("org B") cannot read or mutate the first organizer's ("org A")
resources even though the tournament UUID is public.

Covers: C1 (qr-code no longer AllowAny), C2 (nested ViewSets scoped),
C3 (group generation scoped to the owned tournament's category).
"""

import pytest
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIClient, APIRequestFactory

from apps.accounts.authentication import KickoffJWTAuthentication
from apps.accounts.tokens import generate_team_token
from apps.teams.models import Team
from tests.factories import (
    CategoryFactory,
    ClubFactory,
    FieldFactory,
    GroupFactory,
    MatchFactory,
    TeamFactory,
    TournamentFactory,
    UserFactory,
)

DENIED = (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)


@pytest.fixture
def org_a(db):
    """A complete tournament hierarchy owned by user A."""
    user = UserFactory()
    club = ClubFactory(owner=user)
    tournament = TournamentFactory(club=club)
    category = CategoryFactory(tournament=tournament)
    field = FieldFactory(tournament=tournament)
    team = TeamFactory(tournament=tournament, category=category)
    match = MatchFactory(tournament=tournament, category=category)
    return {
        "user": user,
        "tournament": tournament,
        "category": category,
        "field": field,
        "team": team,
        "match": match,
    }


@pytest.fixture
def client_b(db):
    """An authenticated organizer with no relationship to org A."""
    client = APIClient()
    client.force_authenticate(user=UserFactory())
    return client


def _cross_tenant_requests(a):
    tid = a["tournament"].id
    base = f"/api/v1/tournaments/{tid}"
    return [
        ("get", f"{base}/teams/", None),
        ("get", f"{base}/teams/{a['team'].pk}/", None),
        ("delete", f"{base}/teams/{a['team'].pk}/", None),
        ("get", f"{base}/teams/{a['team'].pk}/qr-code/", None),  # C1
        ("get", f"{base}/categories/", None),
        ("get", f"{base}/fields/", None),
        ("patch", f"{base}/fields/{a['field'].pk}/", {"name": "hacked"}),
        ("get", f"{base}/matches/", None),
        ("post", f"{base}/matches/{a['match'].id}/start/", {}),
        ("post", f"{base}/matches/{a['match'].id}/score/", {"score_home": 9, "score_away": 0}),
    ]


def test_org_b_cannot_read_or_mutate_org_a(client_b, org_a):
    """C2 — every nested endpoint denies a non-owning organizer."""
    for method, url, payload in _cross_tenant_requests(org_a):
        fn = getattr(client_b, method)
        resp = fn(url, data=payload, format="json") if payload is not None else fn(url)
        assert resp.status_code in DENIED, f"{method.upper()} {url} -> {resp.status_code}, expected 403/404"

    # And nothing was actually changed.
    org_a["match"].refresh_from_db()
    org_a["field"].refresh_from_db()
    assert org_a["match"].score_home is None
    assert org_a["field"].name != "hacked"
    assert org_a["team"].__class__.objects.filter(pk=org_a["team"].pk).exists()


def test_c3_org_b_cannot_wipe_org_a_pools(client_b, org_a):
    """C3 — generate-balanced on someone else's category is denied and non-destructive."""
    GroupFactory(category=org_a["category"])
    before = org_a["category"].groups.count()
    url = f"/api/v1/tournaments/{org_a['tournament'].id}/categories/{org_a['category'].id}/groups/generate-balanced/"
    resp = client_b.post(url, data={"num_groups": 2}, format="json")
    assert resp.status_code in DENIED
    assert org_a["category"].groups.count() == before  # pools untouched


def test_c1_qr_code_requires_ownership(org_a):
    """C1 — qr-code is no longer anonymous and is owner-only."""
    url = f"/api/v1/tournaments/{org_a['tournament'].id}/teams/{org_a['team'].pk}/qr-code/"

    anon = APIClient()
    assert anon.get(url).status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    other = APIClient()
    other.force_authenticate(user=UserFactory())
    assert other.get(url).status_code in DENIED

    owner = APIClient()
    owner.force_authenticate(user=org_a["user"])
    resp = owner.get(url)
    assert resp.status_code == status.HTTP_200_OK
    assert resp["Content-Type"] == "image/png"


def test_owner_still_has_full_access(org_a):
    """Positive control — the legitimate owner is unaffected by the scoping."""
    owner = APIClient()
    owner.force_authenticate(user=org_a["user"])
    tid = org_a["tournament"].id
    for path in ("teams", "categories", "fields", "matches"):
        resp = owner.get(f"/api/v1/tournaments/{tid}/{path}/")
        assert resp.status_code == status.HTTP_200_OK, f"owner GET {path} -> {resp.status_code}"


def test_h4_standings_scoped_to_owner(client_b, org_a):
    """H4 — a non-owning organizer cannot read another tournament's standings."""
    url = f"/api/v1/categories/{org_a['category'].id}/standings/"
    assert client_b.get(url).status_code in DENIED

    owner = APIClient()
    owner.force_authenticate(user=org_a["user"])
    assert owner.get(url).status_code == status.HTTP_200_OK


def test_h2_team_token_revoked_after_regenerate(db):
    """H2 — bumping token_version invalidates previously issued team JWTs."""
    team = TeamFactory()
    token = generate_team_token(team)
    auth = KickoffJWTAuthentication()
    request = APIRequestFactory().get("/", HTTP_AUTHORIZATION=f"Bearer {token}")

    # Valid while the version matches.
    user, _ = auth.authenticate(request)
    assert user.team_id == team.id

    # Simulate regenerate-code bumping the version.
    Team.objects.filter(pk=team.pk).update(token_version=team.token_version + 1)

    # The old token is now rejected.
    with pytest.raises(AuthenticationFailed):
        auth.authenticate(request)
