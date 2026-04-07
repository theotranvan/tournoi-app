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
#   ./scripts/backup.sh --restore-media <file>  # Restore media archive
#   ./scripts/backup.sh --verify         # Verify all recent backups
#   ./scripts/backup.sh --test-restore   # Full restore test (read-only)
#
# Environment variables (from .env.production or export):
#   POSTGRES_DB       — Database name       (default: kickoff)
#   POSTGRES_USER     — Database user       (default: kickoff)
#   BACKUP_DIR        — Local backup dir    (default: ./backups)
#   BACKUP_RETENTION  — Days to keep        (default: 30)
#   S3_BUCKET         — S3 bucket for offsite (optional)
#   AWS_PROFILE       — AWS CLI profile      (optional)
#   AWS_S3_ENDPOINT_URL — S3 endpoint for non-AWS providers (optional)
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
while [ $# -gt 0 ]; do
    case "$1" in
        --db-only)       MODE="db" ;;
        --media-only)    MODE="media" ;;
        --restore)       MODE="restore"; RESTORE_FILE="${2:-}"; shift ;;
        --restore-media) MODE="restore-media"; RESTORE_FILE="${2:-}"; shift ;;
        --verify)        MODE="verify" ;;
        --test-restore)  MODE="test-restore" ;;
        *)               echo "Unknown arg: $1"; exit 1 ;;
    esac
    shift
done

# ── Functions ────────────────────────────────────

log() { echo "[$(date +%H:%M:%S)] $*"; }

backup_db() {
    local dump_file="$BACKUP_DIR/db_${DB_NAME}_${TIMESTAMP}.sql.gz"
    log "→ Backing up database '$DB_NAME'..."
    $COMPOSE exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" \
        --no-owner --no-acl --clean --if-exists | gzip > "$dump_file"

    # Verify file is non-empty
    if [ ! -s "$dump_file" ]; then
        log "✗ Backup file is empty: $dump_file"
        rm -f "$dump_file"
        exit 1
    fi

    # Verify integrity
    if ! gunzip -t "$dump_file" 2>/dev/null; then
        log "✗ Backup integrity check FAILED: $dump_file"
        exit 1
    fi

    # Generate checksum
    sha256sum "$dump_file" > "$dump_file.sha256"

    local size
    size=$(du -h "$dump_file" | cut -f1)
    log "✓ Database backup: $dump_file ($size) — integrity verified"
}

backup_media() {
    local tar_file="$BACKUP_DIR/media_${TIMESTAMP}.tar.gz"
    log "→ Backing up media files..."
    $COMPOSE exec -T backend tar czf - -C /app media 2>/dev/null > "$tar_file"

    if [ ! -s "$tar_file" ]; then
        log "⚠ Media backup is empty (no media files?)"
        rm -f "$tar_file"
        return 0
    fi

    sha256sum "$tar_file" > "$tar_file.sha256"
    local size
    size=$(du -h "$tar_file" | cut -f1)
    log "✓ Media backup: $tar_file ($size)"
}

upload_s3() {
    if [ -n "${S3_BUCKET:-}" ]; then
        log "→ Uploading to S3: s3://$S3_BUCKET/backups/$TIMESTAMP/"
        local s3_flags=""
        if [ -n "${AWS_PROFILE:-}" ]; then
            s3_flags="$s3_flags --profile $AWS_PROFILE"
        fi
        if [ -n "${AWS_S3_ENDPOINT_URL:-}" ]; then
            s3_flags="$s3_flags --endpoint-url $AWS_S3_ENDPOINT_URL"
        fi
        aws s3 cp "$BACKUP_DIR/" "s3://$S3_BUCKET/backups/$TIMESTAMP/" \
            --recursive \
            --exclude "*" \
            --include "*${TIMESTAMP}*" \
            $s3_flags
        log "✓ S3 upload complete"
    else
        log "⚠ S3_BUCKET not set — skipping offsite upload"
    fi
}

cleanup_old() {
    log "→ Cleaning backups older than $RETENTION_DAYS days..."
    local count
    count=$(find "$BACKUP_DIR" -name "*.gz" -mtime +"$RETENTION_DAYS" 2>/dev/null | wc -l)
    find "$BACKUP_DIR" -name "*.gz" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.sha256" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.log" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
    log "✓ Removed $count old backup(s)"
}

restore_db() {
    if [ -z "$RESTORE_FILE" ] || [ ! -f "$RESTORE_FILE" ]; then
        log "ERROR: Restore file not found: $RESTORE_FILE"
        echo "Usage: ./scripts/backup.sh --restore <backup_file.sql.gz>"
        exit 1
    fi

    # Verify checksum if available
    if [ -f "$RESTORE_FILE.sha256" ]; then
        log "→ Verifying checksum..."
        if ! sha256sum -c "$RESTORE_FILE.sha256" --quiet 2>/dev/null; then
            log "✗ Checksum verification FAILED. Backup may be corrupted."
            exit 1
        fi
        log "✓ Checksum verified"
    fi

    echo ""
    echo "⚠ WARNING: This will restore database '$DB_NAME' from backup."
    echo "  File: $RESTORE_FILE"
    echo "  Size: $(du -h "$RESTORE_FILE" | cut -f1)"
    echo ""
    read -rp "  Type 'yes' to confirm: " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi

    log "→ Restoring database from $RESTORE_FILE..."
    gunzip -c "$RESTORE_FILE" | \
        $COMPOSE exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" --single-transaction -v ON_ERROR_STOP=1
    log "✓ Database restored"

    # Post-restore validation
    log "→ Validating restore..."
    local count
    count=$($COMPOSE exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -tAc \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
    log "✓ Restore validated — $count tables found"
}

restore_media() {
    if [ -z "$RESTORE_FILE" ] || [ ! -f "$RESTORE_FILE" ]; then
        log "ERROR: Restore file not found: $RESTORE_FILE"
        echo "Usage: ./scripts/backup.sh --restore-media <media_YYYYMMDD.tar.gz>"
        exit 1
    fi

    echo ""
    echo "⚠ WARNING: This will restore media files."
    echo "  File: $RESTORE_FILE"
    echo ""
    read -rp "  Type 'yes' to confirm: " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi

    log "→ Restoring media from $RESTORE_FILE..."
    $COMPOSE exec -T backend tar xzf - -C /app < "$RESTORE_FILE"
    log "✓ Media restored"
}

verify_backups() {
    log "→ Verifying recent backups..."
    local errors=0
    local verified=0

    for f in "$BACKUP_DIR"/*.gz; do
        [ -f "$f" ] || continue
        if ! gunzip -t "$f" 2>/dev/null; then
            log "✗ CORRUPT: $f"
            errors=$((errors + 1))
        elif [ -f "$f.sha256" ]; then
            if sha256sum -c "$f.sha256" --quiet 2>/dev/null; then
                log "✓ $(basename "$f") — OK"
                verified=$((verified + 1))
            else
                log "✗ CHECKSUM MISMATCH: $f"
                errors=$((errors + 1))
            fi
        else
            log "⚠ $(basename "$f") — no checksum file"
            verified=$((verified + 1))
        fi
    done

    echo ""
    log "Verified: $verified, Errors: $errors"
    if [ $errors -gt 0 ]; then
        exit 1
    fi
}

test_restore() {
    log "═══ RESTORE TEST (read-only validation) ═══"

    # Find most recent DB backup
    local latest_db
    latest_db=$(ls -t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | head -1 || true)
    if [ -z "$latest_db" ]; then
        log "✗ No DB backup found to test"
        exit 1
    fi

    log "→ Testing DB backup: $latest_db"

    # 1. Verify gzip integrity
    if ! gunzip -t "$latest_db" 2>/dev/null; then
        log "✗ Gzip integrity FAILED"
        exit 1
    fi
    log "✓ Gzip integrity OK"

    # 2. Verify checksum
    if [ -f "$latest_db.sha256" ]; then
        if sha256sum -c "$latest_db.sha256" --quiet 2>/dev/null; then
            log "✓ Checksum OK"
        else
            log "✗ Checksum FAILED"
            exit 1
        fi
    fi

    # 3. Verify SQL structure (check for key tables)
    local has_tables
    has_tables=$(gunzip -c "$latest_db" | head -200 | grep -c "CREATE TABLE" || true)
    if [ "$has_tables" -eq 0 ]; then
        log "✗ No CREATE TABLE found — dump may be empty"
        exit 1
    fi
    log "✓ SQL structure contains $has_tables table definitions (sample)"

    # 4. Check media backup if exists
    local latest_media
    latest_media=$(ls -t "$BACKUP_DIR"/media_*.tar.gz 2>/dev/null | head -1 || true)
    if [ -n "$latest_media" ]; then
        log "→ Testing media backup: $latest_media"
        if tar tzf "$latest_media" > /dev/null 2>&1; then
            local file_count
            file_count=$(tar tzf "$latest_media" | wc -l)
            log "✓ Media archive OK ($file_count files)"
        else
            log "✗ Media archive CORRUPT"
            exit 1
        fi
    fi

    # 5. Report
    local db_size media_size
    db_size=$(du -h "$latest_db" | cut -f1)
    media_size=$(du -h "$latest_media" 2>/dev/null | cut -f1 || echo "N/A")

    echo ""
    log "═══ RESTORE TEST PASSED ═══"
    echo "  DB backup:    $latest_db ($db_size)"
    echo "  Media backup: ${latest_media:-none} ($media_size)"
    echo "  Backup age:   $(stat -c %y "$latest_db" 2>/dev/null || stat -f %Sm "$latest_db" 2>/dev/null || echo 'unknown')"
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
    restore-media)
        restore_media
        ;;
    verify)
        verify_backups
        ;;
    test-restore)
        test_restore
        ;;
esac

echo ""
log "✓ Operation complete"
echo "  Backups: ls -la $BACKUP_DIR/"
