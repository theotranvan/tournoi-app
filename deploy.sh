#!/usr/bin/env bash
set -euo pipefail

# Kickoff — Production deploy script
# Usage: ./deploy.sh [--build] [--migrate] [--ssl] [--image-tag SHA]

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_PREFIX="${IMAGE_PREFIX:-theotranvan/tournoi-app}"

# ── Parse args ───────────────────────────────────
BUILD=false
MIGRATE=false
SSL=false
IMAGE_TAG=""
NEXT_IS_TAG=false
for arg in "$@"; do
    if [ "$NEXT_IS_TAG" = true ]; then
        IMAGE_TAG="$arg"
        NEXT_IS_TAG=false
        continue
    fi
    case $arg in
        --build)     BUILD=true ;;
        --migrate)   MIGRATE=true ;;
        --ssl)       SSL=true ;;
        --image-tag) NEXT_IS_TAG=true ;;
        *)           echo "Unknown arg: $arg"; exit 1 ;;
    esac
done

# ── Checks ───────────────────────────────────────
if [ ! -f .env.production ]; then
    echo "ERROR: .env.production not found. Copy .env.production.example and configure it."
    exit 1
fi

echo "✓ Loading .env.production"
export $(grep -v '^#' .env.production | xargs)

# ── Image tag resolution ─────────────────────────
if [ -z "$IMAGE_TAG" ]; then
    IMAGE_TAG=$(git rev-parse HEAD 2>/dev/null || echo "latest")
fi
export IMAGE_TAG REGISTRY IMAGE_PREFIX

# Warn if building locally (bypasses CI gates)
if [ "$BUILD" = true ]; then
    echo ""
    echo "⚠ WARNING: --build builds images locally, bypassing CI test gates."
    echo "  Only use this for initial setup or emergencies."
    echo "  For normal deploys, push to main and let CI handle it."
    echo ""
    read -rp "  Continue with local build? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 0
    fi
fi

# Save previous version for rollback
PREV_TAG=""
if [ -f .deployed_sha ]; then
    PREV_TAG=$(cat .deployed_sha)
    cp .deployed_sha .deployed_sha.prev
fi
echo "→ Deploying image tag: $IMAGE_TAG"
if [ -n "$PREV_TAG" ]; then
    echo "  Previous version: $PREV_TAG"
fi

# ── Pre-deploy backup ────────────────────────────
echo "→ Creating pre-deploy database backup..."
BACKUP_FILE="./backups/pre_deploy_$(date +%Y%m%d_%H%M%S).sql.gz"
mkdir -p ./backups
if $COMPOSE exec -T postgres pg_dump -U "${POSTGRES_USER:-kickoff}" "${POSTGRES_DB:-kickoff}" \
    --no-owner --no-acl | gzip > "$BACKUP_FILE" 2>/dev/null; then
    echo "✓ Pre-deploy backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
    echo "⚠ Pre-deploy backup skipped (no running database)"
fi

# ── SSL setup (Let's Encrypt via certbot) ────────
if [ "$SSL" = true ]; then
    echo "→ Setting up SSL certificates..."
    mkdir -p nginx/ssl
    docker run --rm -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
        -p 80:80 certbot/certbot certonly \
        --standalone \
        --agree-tos \
        --no-eff-email \
        -d "${ALLOWED_HOSTS%%,*}" \
        --email "${SSL_EMAIL:-admin@footix.app}"
    cp nginx/ssl/live/*/fullchain.pem nginx/ssl/fullchain.pem
    cp nginx/ssl/live/*/privkey.pem nginx/ssl/privkey.pem
    echo "✓ SSL certificates obtained"
fi

# ── Build ────────────────────────────────────────
if [ "$BUILD" = true ]; then
    echo "→ Building Docker images..."
    $COMPOSE build --no-cache
    echo "✓ Images built"
fi

# ── Manual migration ─────────────────────────────
if [ "$MIGRATE" = true ]; then
    echo "→ Running migrations..."
    $COMPOSE run --rm backend python manage.py migrate --noinput
    echo "✓ Migrations complete"
fi

# ── Deploy ───────────────────────────────────────
echo "→ Starting services..."
if [ "$BUILD" = true ]; then
    $COMPOSE --env-file .env.production up -d --remove-orphans --build
else
    $COMPOSE --env-file .env.production pull backend frontend || true
    $COMPOSE --env-file .env.production up -d --remove-orphans
fi

echo "→ Waiting for health check..."
RETRIES=0
MAX_RETRIES=6
while [ $RETRIES -lt $MAX_RETRIES ]; do
    if $COMPOSE exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health/full/')" 2>/dev/null; then
        echo "✓ Backend healthy (full check: db + redis + celery)"
        echo "$IMAGE_TAG" > .deployed_sha
        echo "✓ Deployed version saved: $IMAGE_TAG"
        break
    fi
    RETRIES=$((RETRIES + 1))
    echo "  Waiting... ($RETRIES/$MAX_RETRIES)"
    sleep 5
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
    echo "✗ Backend health check failed after ${MAX_RETRIES} attempts"
    if [ -n "$PREV_TAG" ]; then
        echo "→ Auto-rolling back to $PREV_TAG..."
        export IMAGE_TAG="$PREV_TAG"
        $COMPOSE --env-file .env.production pull backend frontend || true
        $COMPOSE --env-file .env.production up -d --remove-orphans
        echo "✗ Rolled back to $PREV_TAG. Check logs: $COMPOSE logs backend"
    else
        echo "  No previous version to rollback to. Check logs: $COMPOSE logs backend"
        $COMPOSE down
    fi
    exit 1
fi

# ── Cleanup ──────────────────────────────────────
echo "→ Pruning old images..."
docker image prune -f

# ── Smoke test ───────────────────────────────────
if [ -f scripts/smoke-test.sh ]; then
    echo "→ Running smoke tests..."
    bash scripts/smoke-test.sh http://localhost || echo "⚠ Some smoke tests failed (non-blocking)"
fi

echo ""
echo "✓ Deployment complete"
echo "  Logs:    $COMPOSE logs -f"
echo "  Status:  $COMPOSE ps"
echo "  Stop:    $COMPOSE down"
