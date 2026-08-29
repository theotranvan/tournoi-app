# CLAUDE.md — Working notes for Footix (tournoi-app)

Guidance for Claude Code and developers working in this repo. Full setup is in
[README.md](README.md); this file captures the **non-obvious** things that
otherwise cost time.

## What this is

Footix — a football tournament management platform. Organizers create tournaments
(categories, teams, fields), auto-generate pools + a schedule, run live scoring,
and publish a public spectator page. Coaches get a per-team access code;
spectators use a public tournament code.

## Backend apps (`backend/apps/`)

`accounts` (auth: JWT users **and** team tokens) · `clubs` · `tournaments`
(Tournament, Category, Field, Day) · `teams` (Team, Group) · `matches` ·
`scheduling` (slot-based engine + `generate`) · `standings` · `subscriptions`
(Stripe) · `notifications` (web push) · `public` (unauthenticated read API) ·
`realtime` (WebSocket consumers + JWT middleware) · `core` (mixins, permissions,
validators, health, exception handler).

## Running locally — no Docker, no Redis, no Celery

Dev deliberately needs **neither Redis nor Celery**: `settings/dev.py` uses an
in-memory channel layer and schedule generation runs **synchronously** in the
request. Two processes are enough:

```bash
# Backend → http://localhost:8000
cd backend
DJANGO_SETTINGS_MODULE=kickoff.settings.dev python manage.py migrate
DJANGO_SETTINGS_MODULE=kickoff.settings.dev python manage.py runserver 8000

# Frontend → http://localhost:3000  (another terminal)
cd frontend && npm run dev
```

⚠️ **`frontend/.env.local` is required for local dev**, or the frontend falls back
to the *deployed* backend URL (see `src/lib/capacitor.ts::getApiUrl`):

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

Local test organizer account (dev SQLite DB): `organisateur` / `Footix2026!`.

## Testing — read before running

### Frontend e2e (Playwright)

Run **serialized**: `npx playwright test --workers=1`. Full parallelism overwhelms
the Turbopack dev server so every `page.goto` times out (dozens of *false*
failures). CI already forces `workers: 1` + a production `next start`. The specs
mock the API (`page.route`), so no backend is needed for e2e.

### Backend (pytest)

- `pytest` runs **with coverage** by default (pyproject `addopts`). Under disk
  pressure, run without it: `pytest -o addopts=""`.
- `TestCreateCheckoutView` needs `STRIPE_SECRET_KEY` set — a guard returns 503
  otherwise. CI sets dummy Stripe vars; the local `.env` sets them too.
- Tests use SQLite; CI uses PostgreSQL.

## CI (`.github/workflows/`)

- `backend.yml`: ruff, ruff-format, **mypy** (non-blocking — ~130 pre-existing
  errors), **bandit** (blocking, medium+ severity, currently clean), pytest with
  `--cov-fail-under=70`.
- `frontend.yml`: **eslint** (non-blocking — pre-existing React-Compiler debt),
  `tsc --noEmit`, `next build`, Playwright e2e.

`mypy`/`eslint` are `continue-on-error`: pay the debt down incrementally, then
re-enable blocking. Note: Next 16 removed the `eslint` config key and `next build`
no longer runs eslint — do **not** add `eslint: {...}` to `next.config.ts`
(it fails the typed config now that `typescript.ignoreBuildErrors` is off).

## Security architecture — do not regress this

Access control is **object-level**, not just role-level (`IsOrganizer` gates the
role, never resource ownership; tournament UUIDs are exposed by the public API).

- **`apps/core/mixins.py::TournamentScopedMixin`** is the core pattern: it scopes
  every nested ViewSet's queryset **and** serializer context to the URL tournament
  *after* verifying ownership via `_get_tournament_for_nested` (owner or club
  member). Applied to Team, Group, Category, Field, SchedulingConstraint, Day and
  Match ViewSets — so `get_object` (retrieve/update/destroy + custom actions) is
  owner-scoped.
- Serializer FK fields (`category`, `field`, `team_ids`) are scoped to the
  tournament via context, so a foreign pk in the request body returns 400
  (prevents cross-tenant FK injection).
- Team access tokens embed `Team.token_version`; `regenerate-code` bumps it,
  revoking previously issued tokens.
- WebSocket consumers require owner/member for **private** tournaments.
- Standings read endpoints allow the owner **or** a team member of that
  tournament; the refresh endpoint is organizer-only + throttled.

Regression tests: `backend/tests/test_access_control.py` and
`test_access_control_residual.py` (matrix: owner / other-organizer / team-token /
anon). **When adding endpoints, keep object-level scoping** — a role check alone
is not access control.

## Conventions

- Backend: ruff (lint + format, 120 cols); mypy with django-stubs/drf-stubs.
- Commits: conventional (`fix(security):`, `test(frontend/e2e):`, `docs:` …).
- UI strings in French; code and identifiers in English.

## Quick reference

```bash
# backend
cd backend && ruff check . && ruff format --check . && pytest -o addopts=""
# frontend
cd frontend && npm run lint && npx tsc --noEmit && npx playwright test --workers=1
```
