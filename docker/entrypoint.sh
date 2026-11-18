#!/usr/bin/env sh
# Shared container entrypoint for api / worker / beat.
#   RUN_MIGRATIONS=1  -> apply migrations before the container's command starts
#   WAIT_ATTEMPTS     -> how long to wait for PostgreSQL to accept connections
set -eu

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  attempt=1
  max_attempts="${WAIT_ATTEMPTS:-30}"
  until uv run --no-sync alembic upgrade head; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "alembic upgrade head failed after ${attempt} attempts" >&2
      exit 1
    fi
    echo "database not ready (attempt ${attempt}/${max_attempts}), retrying in 2s" >&2
    attempt=$((attempt + 1))
    sleep 2
  done
fi

exec "$@"
