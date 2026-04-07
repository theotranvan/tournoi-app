#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Kickoff — Database & Media Backup Script
#
# Usage:
#   ./scripts/backup.sh                  # Full backup (DB + media)
#   ./scripts/backup.sh --db-only        # Database only
#   ./scripts/backup.sh --media-only     # Media files only
#   ./scripts/backup.sh --restore <file> # Restore a DB backup
#
# Environment variables (from .env.production or export):
#   POSTGRES_DB       — Database name       (default: kickoff)
#   POSTGRES_USER     — Database user       (default: kickoff)
#   BACKUP_DIR        — Local backup dir    (default: ./backups)
#   BACKUP_RETENTION  — Days to keep        (default: 30)
#   S3_BUCKET         — S3 bucket for offsite (optional)
#   AWS_PROFILE       — AWS CLI profile      (optional)
# ─────────────────────────────────────────────────────────────────────────────

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
DB_NAME="${POSTGRES_DB:-kickoff}"
DB_USER="${POSTGRES_USER:-kickoff}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"

# ── Parse args ───────────────────────────────────
MODE="full"
RESTORE_FILE=""
for arg in "$@"; do
    case $arg in
        --db-only)    MODE="db" ;;
        --media-only) MODE="media" ;;
        --restore)    MODE="restore" ;;
        *)
            if [ "$MODE" = "restore" ] && [ -z "$RESTORE_FILE" ]; then
                RESTORE_FILE="$arg"
            else
                echo "Unknown arg: $arg"; exit 1
            fi
            ;;
    esac
done

# ── Functions ────────────────────────────────────

backup_db() {
    local dump_file="$BACKUP_DIR/db_${DB_NAME}_${TIMESTAMP}.sql.gz"
    echo "→ Backing up database '$DB_NAME'..."
    $COMPOSE exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" \
        --no-owner --no-acl | gzip > "$dump_file"
    local size
    size=$(du -h "$dump_file" | cut -f1)

    # Verify integrity
    if ! gunzip -t "$dump_file" 2>/dev/null; then
        echo "✗ Backup integrity check FAILED: $dump_file"
        exit 1
    fi

    # Generate checksum
    sha256sum "$dump_file" > "$dump_file.sha256"

    echo "✓ Database backup: $dump_file ($size) — integrity verified"
}

backup_media() {
    local tar_file="$BACKUP_DIR/media_${TIMESTAMP}.tar.gz"
    echo "→ Backing up media files..."
    $COMPOSE exec -T backend tar czf - -C /app media 2>/dev/null > "$tar_file"
    local size
    size=$(du -h "$tar_file" | cut -f1)
    echo "✓ Media backup: $tar_file ($size)"
}

upload_s3() {
    if [ -n "${S3_BUCKET:-}" ]; then
        echo "→ Uploading to S3: s3://$S3_BUCKET/backups/"
        local profile_flag=""
        if [ -n "${AWS_PROFILE:-}" ]; then
            profile_flag="--profile $AWS_PROFILE"
        fi
        aws s3 cp "$BACKUP_DIR/" "s3://$S3_BUCKET/backups/$TIMESTAMP/" \
            --recursive \
            --exclude "*" \
            --include "*${TIMESTAMP}*" \
            $profile_flag
        echo "✓ S3 upload complete"
    fi
}

cleanup_old() {
    echo "→ Cleaning backups older than $RETENTION_DAYS days..."
    local count
    count=$(find "$BACKUP_DIR" -name "*.gz" -mtime +"$RETENTION_DAYS" | wc -l)
    find "$BACKUP_DIR" -name "*.gz" -mtime +"$RETENTION_DAYS" -delete
    find "$BACKUP_DIR" -name "*.sha256" -mtime +"$RETENTION_DAYS" -delete
    echo "✓ Removed $count old backup(s)"
}

restore_db() {
    if [ -z "$RESTORE_FILE" ] || [ ! -f "$RESTORE_FILE" ]; then
        echo "ERROR: Restore file not found: $RESTORE_FILE"
        echo "Usage: ./scripts/backup.sh --restore <backup_file.sql.gz>"
        exit 1
    fi

    echo "⚠ WARNING: This will DROP and recreate the database '$DB_NAME'."
    echo "  Restore file: $RESTORE_FILE"
    read -rp "  Type 'yes' to confirm: " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi

    echo "→ Restoring database from $RESTORE_FILE..."
    gunzip -c "$RESTORE_FILE" | \
        $COMPOSE exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" --single-transaction
    echo "✓ Database restored"
}

# ── Main ─────────────────────────────────────────

case "$MODE" in
    full)
        backup_db
        backup_media
        upload_s3
        cleanup_old
        ;;
    db)
        backup_db
        upload_s3
        cleanup_old
        ;;
    media)
        backup_media
        upload_s3
        cleanup_old
        ;;
    restore)
        restore_db
        ;;
esac

echo ""
echo "✓ Backup operation complete"
echo "  Backups: ls -la $BACKUP_DIR/"
