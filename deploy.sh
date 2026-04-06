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
        --email "${SSL_EMAIL:-admin@kickoff.app}"
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
sleep 10

if $COMPOSE exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/public/health/')" 2>/dev/null; then
    echo "✓ Backend healthy"
else
    echo "⚠ Backend health check failed — check logs with: $COMPOSE logs backend"
fi

# ── Cleanup ──────────────────────────────────────
echo "→ Pruning old images..."
docker image prune -f

echo ""
echo "✓ Deployment complete"
echo "  Logs:    $COMPOSE logs -f"
echo "  Status:  $COMPOSE ps"
echo "  Stop:    $COMPOSE down"
