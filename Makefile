# ─── Kickoff / Footix — Dev & Ops Commands ──────────────────
COMPOSE = docker compose -f docker-compose.yml -f docker-compose.prod.yml

# ── Dev ──────────────────────────────────────────────────────
.PHONY: dev backend-dev frontend-dev test lint

dev:
	docker compose up --build

backend-dev:
	cd backend && DJANGO_SETTINGS_MODULE=kickoff.settings.dev python manage.py runserver 8000

frontend-dev:
	cd frontend && npm run dev

test:
	cd backend && python -m pytest -x -q

lint:
	cd backend && ruff check . && ruff format --check .
	cd frontend && npm run lint

# ── Prod ─────────────────────────────────────────────────────
.PHONY: deploy deploy-build logs status health backup restore

deploy:
	./deploy.sh

deploy-build:
	./deploy.sh --build --migrate

deploy-tag:
	@test -n "$(TAG)" || (echo "ERROR: TAG is required. Usage: make deploy-tag TAG=abc123" && exit 1)
	./deploy.sh --image-tag $(TAG)

rollback:
	@test -n "$(SHA)" || (echo "ERROR: SHA is required. Usage: make rollback SHA=abc123" && exit 1)
	./scripts/rollback.sh $(SHA)

version:
	@echo "Deployed: $$(cat .deployed_sha 2>/dev/null || echo 'unknown')"
	@echo "Git HEAD: $$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

logs:
	$(COMPOSE) logs -f --tail=100

status:
	$(COMPOSE) ps

health:
	curl -s http://localhost:8000/api/v1/health/full/ | python -m json.tool

backup:
	./scripts/backup.sh

backup-db:
	./scripts/backup.sh --db-only

backup-verify:
	./scripts/backup.sh --verify

backup-test-restore:
	./scripts/backup.sh --test-restore

restore:
	@echo "Usage: make restore FILE=backups/db_kickoff_YYYYMMDD.sql.gz"
	@test -n "$(FILE)" || (echo "ERROR: FILE is required" && exit 1)
	./scripts/backup.sh --restore $(FILE)

restore-media:
	@echo "Usage: make restore-media FILE=backups/media_YYYYMMDD.tar.gz"
	@test -n "$(FILE)" || (echo "ERROR: FILE is required" && exit 1)
	./scripts/backup.sh --restore-media $(FILE)

# ── Maintenance ──────────────────────────────────────────────
.PHONY: prune shell shell-db migrate

prune:
	docker image prune -f
	docker volume prune -f

shell:
	$(COMPOSE) exec backend python manage.py shell

shell-db:
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-kickoff} $${POSTGRES_DB:-kickoff}

migrate:
	$(COMPOSE) exec backend python manage.py migrate --noinput
