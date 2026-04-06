# Kickoff — Tournament Management Platform

Application web de gestion de tournois de football.
Django REST API + Next.js frontend, temps réel via WebSocket.

## Tech Stack

| Couche     | Technologie                         |
|------------|-------------------------------------|
| Backend    | Django 5.2, DRF, Channels, Celery   |
| Frontend   | Next.js 16, React 19, Tailwind v4   |
| Base       | PostgreSQL 16, Redis 7              |
| Infra      | Docker Compose, Nginx, GitHub Actions|

## Structure

```
├── backend/
│   ├── kickoff/          # Django project (settings, urls, asgi, wsgi, celery)
│   │   └── settings/     # base.py, dev.py, prod.py
│   ├── apps/             # Django apps (accounts, clubs, tournaments, teams, matches, standings, core, public)
│   ├── tests/            # Backend tests
│   ├── pyproject.toml    # Python dependencies (PEP 621)
│   └── Dockerfile
├── frontend/
│   ├── src/              # Next.js app (pages, components, hooks, stores, lib)
│   ├── tests/            # Frontend tests
│   ├── package.json
│   └── Dockerfile
├── nginx/                # Nginx reverse proxy config
├── docker-compose.yml    # Development stack
├── docker-compose.prod.yml  # Production overrides
└── .github/workflows/    # CI pipelines
```

## Démarrage rapide

```bash
# 1. Cloner et configurer
cp .env.example .env

# 2. Lancer avec Docker
docker compose up --build

# 3. Accéder
#    Frontend : http://localhost
#    API      : http://localhost/api/v1/
#    Admin    : http://localhost/admin/
```

## Développement local (sans Docker)

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # ou .venv\Scripts\activate sur Windows
pip install -e ".[dev]"
cp .env.example .env
python manage.py migrate
python manage.py runserver

# Frontend (dans un autre terminal)
cd frontend
npm install
npm run dev
```

## Variables d'environnement

Voir `.env.example` à la racine pour toutes les variables disponibles.

## Commandes utiles

```bash
# Linter + formatter backend
cd backend && ruff check . && ruff format .

# Type checking
cd backend && mypy apps/ --ignore-missing-imports

# Tests backend
cd backend && pytest

# Build frontend
cd frontend && npm run build
```
