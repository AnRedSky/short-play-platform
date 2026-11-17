#!/usr/bin/env bash
# Private-deployment backup: PostgreSQL logical dump + media storage archive.
# Usage: bash scripts/backup.sh [compose-file]   (default: docker-compose.yml)
set -euo pipefail

COMPOSE_FILE="${1:-docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
POSTGRES_USER="${POSTGRES_USER:-short_play}"
POSTGRES_DB="${POSTGRES_DB:-short_play}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"

DB_ARCHIVE="$BACKUP_DIR/db-$STAMP.dump.gz"
MEDIA_ARCHIVE="$BACKUP_DIR/media-$STAMP.tar.gz"

echo "Backing up database $POSTGRES_DB to $DB_ARCHIVE"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom | gzip -9 > "$DB_ARCHIVE"

echo "Backing up media storage to $MEDIA_ARCHIVE"
docker compose -f "$COMPOSE_FILE" exec -T api \
    tar -czf - -C /data storage > "$MEDIA_ARCHIVE"

for archive in "$DB_ARCHIVE" "$MEDIA_ARCHIVE"; do
    if [[ ! -s "$archive" ]]; then
        echo "Backup artifact $archive is empty; refusing to report success." >&2
        exit 1
    fi
done

echo "$DB_ARCHIVE"
echo "$MEDIA_ARCHIVE"
