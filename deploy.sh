#!/usr/bin/env bash
set -euo pipefail

# Kickoff — Production deploy script
# Usage: ./deploy.sh [--build] [--migrate] [--ssl]

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

# ── Parse args ───────────────────────────────────
BUILD=false
MIGRATE=false
SSL=false
for arg in "$@"; do
    case $arg in
        --build)   BUILD=true ;;
        --migrate) MIGRATE=true ;;
        --ssl)     SSL=true ;;
        *)         echo "Unknown arg: $arg"; exit 1 ;;
    esac
done

# ── Checks ───────────────────────────────────────
if [ ! -f .env.production ]; then
    echo "ERROR: .env.production not found. Copy .env.production.example and configure it."
    exit 1
fi

echo "✓ Loading .env.production"
export $(grep -v '^#' .env.production | xargs)

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
$COMPOSE --env-file .env.production up -d --remove-orphans

echo "→ Waiting for health check..."
RETRIES=0
MAX_RETRIES=6
while [ $RETRIES -lt $MAX_RETRIES ]; do
    if $COMPOSE exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health/full/')" 2>/dev/null; then
        echo "✓ Backend healthy (full check: db + redis + celery)"
        break
    fi
    RETRIES=$((RETRIES + 1))
    echo "  Waiting... ($RETRIES/$MAX_RETRIES)"
    sleep 5
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
    echo "✗ Backend health check failed after ${MAX_RETRIES} attempts"
    echo "  Rolling back to previous images..."
    $COMPOSE down
    echo "  Check logs: $COMPOSE logs backend"
    exit 1
fi

# ── Cleanup ──────────────────────────────────────
echo "→ Pruning old images..."
docker image prune -f

echo ""
echo "✓ Deployment complete"
echo "  Logs:    $COMPOSE logs -f"
echo "  Status:  $COMPOSE ps"
echo "  Stop:    $COMPOSE down"
