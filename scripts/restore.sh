#!/usr/bin/env bash
# Private-deployment restore: load a dump into a target database and unpack media storage.
# Usage: bash scripts/restore.sh <db-archive> [target-db] [infra-compose]
#        bash scripts/restore.sh --media <media-archive> [project-compose]
set -euo pipefail

INFRA_COMPOSE="${3:-docker/docker-compose.infra.yml}"
PROJECT_COMPOSE="${4:-docker-compose.yml}"
POSTGRES_USER="${POSTGRES_USER:-short_play}"

if [[ "${1:-}" == "--media" ]]; then
    MEDIA_ARCHIVE="${2:?media archive is required}"
    PROJECT_COMPOSE="${3:-docker-compose.yml}"
    [[ -s "$MEDIA_ARCHIVE" ]] || { echo "Media archive $2 is missing or empty." >&2; exit 1; }
    docker compose -f "$PROJECT_COMPOSE" exec -T api tar -xzf - -C /data < "$MEDIA_ARCHIVE"
    echo "Media storage restored from $MEDIA_ARCHIVE"
    exit 0
fi

DB_ARCHIVE="${1:?database archive is required}"
TARGET_DB="${2:-short_play}"
[[ -s "$DB_ARCHIVE" ]] || { echo "Database archive $DB_ARCHIVE is missing or empty." >&2; exit 1; }

echo "Restoring $DB_ARCHIVE into database $TARGET_DB"
gunzip -c "$DB_ARCHIVE" | docker compose -f "$INFRA_COMPOSE" exec -T postgres \
    pg_restore -U "$POSTGRES_USER" -d "$TARGET_DB" --clean --if-exists --no-owner

echo "Row counts after restore:"
docker compose -f "$INFRA_COMPOSE" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$TARGET_DB" -Atc \
    "select 'users=' || count(*) from users; select 'projects=' || count(*) from projects; select 'media_assets=' || count(*) from media_assets;"
