#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Kickoff — Rollback to a specific version
#
# Usage:
#   ./scripts/rollback.sh                    # Rollback to previous deployed SHA
#   ./scripts/rollback.sh <sha>              # Rollback to a specific SHA
#   ./scripts/rollback.sh --restore-db       # Also restore pre-deploy DB backup
#   ./scripts/rollback.sh <sha> --restore-db # Rollback SHA + restore DB
#
# This script:
#   1. Reads the target SHA (arg or .deployed_sha.prev)
#   2. Pulls the SHA-tagged images from GHCR
#   3. Restarts services with the old images
#   4. Validates health
#   5. Optionally restores the pre-deploy DB backup
# ─────────────────────────────────────────────────────────────────────────────

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_PREFIX="${IMAGE_PREFIX:-theotranvan/tournoi-app}"

TARGET_SHA=""
RESTORE_DB=false

for arg in "$@"; do
    case $arg in
        --restore-db) RESTORE_DB=true ;;
        *)            TARGET_SHA="$arg" ;;
    esac
done

# ── Load env ─────────────────────────────────────
if [ -f .env.production ]; then
    export $(grep -v '^#' .env.production | xargs)
fi

# ── Resolve target SHA ───────────────────────────
CURRENT_SHA=""
if [ -f .deployed_sha ]; then
    CURRENT_SHA=$(cat .deployed_sha)
fi

if [ -z "$TARGET_SHA" ]; then
    echo "Usage: ./scripts/rollback.sh <sha>"
    echo ""
    echo "Current deployed version: ${CURRENT_SHA:-unknown}"
    echo ""
    echo "Recent git commits:"
    git log --oneline -10 2>/dev/null || true
    echo ""
    echo "Available images in GHCR:"
    echo "  Check: https://github.com/theotranvan/tournoi-app/pkgs/container/tournoi-app%2Fbackend"
    exit 1
fi

echo "═══════════════════════════════════════════════"
echo " ROLLBACK"
echo "═══════════════════════════════════════════════"
echo "  Current: ${CURRENT_SHA:-unknown}"
echo "  Target:  $TARGET_SHA"
echo "═══════════════════════════════════════════════"
read -rp "Confirm rollback? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled."
    exit 0
fi

# ── Restore DB if requested ──────────────────────
if [ "$RESTORE_DB" = true ]; then
    LATEST_PREBACKUP=$(ls -t backups/pre_deploy_*.sql.gz 2>/dev/null | head -1 || true)
    if [ -z "$LATEST_PREBACKUP" ]; then
        echo "✗ No pre-deploy backup found in backups/"
        exit 1
    fi
    echo "→ Restoring DB from $LATEST_PREBACKUP..."
    gunzip -c "$LATEST_PREBACKUP" | \
        $COMPOSE exec -T postgres psql -U "${POSTGRES_USER:-kickoff}" -d "${POSTGRES_DB:-kickoff}" --single-transaction
    echo "✓ Database restored"
fi

# ── Pull and deploy target SHA ───────────────────
export IMAGE_TAG="$TARGET_SHA"
export REGISTRY IMAGE_PREFIX

echo "→ Pulling images for $TARGET_SHA..."
$COMPOSE pull backend frontend

echo "→ Restarting services..."
$COMPOSE up -d --remove-orphans

# ── Health check ─────────────────────────────────
echo "→ Waiting for health check..."
for i in 1 2 3 4 5 6; do
    if curl -sf http://localhost:8000/api/v1/public/health/ > /dev/null 2>&1; then
        echo "✓ Backend healthy"
        echo "$TARGET_SHA" > .deployed_sha
        echo ""
        echo "═══════════════════════════════════════════════"
        echo " ✓ ROLLBACK SUCCESSFUL"
        echo "   Version: $TARGET_SHA"
        echo "═══════════════════════════════════════════════"
        exit 0
    fi
    echo "  Waiting... ($i/6)"
    sleep 10
done

echo "✗ Backend health check failed after rollback"
echo "  Check logs: $COMPOSE logs backend"
exit 1
