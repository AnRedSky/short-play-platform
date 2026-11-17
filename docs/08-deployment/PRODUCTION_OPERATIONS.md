# Production Operations Runbook (Private Deployment)

This runbook covers the enterprise-internal deployment: Linux hosts, Docker Compose, no SaaS
exposure. It complements `docs/08-deployment/DEPLOYMENT.md` and does not replace it.

## 1. Stack layout

`docker-compose.prod.yml` defines the whole runtime:

| Service | Role | Exposure |
| --- | --- | --- |
| `postgres` | PostgreSQL 16 metadata store | internal only |
| `redis` | Celery broker and result backend, password protected | internal only |
| `api` | FastAPI application, runs Alembic then Uvicorn with 2 workers | internal only, fronted by nginx |
| `worker` | Celery workers executing generation and workflow nodes | internal only |
| `beat` | Celery beat, runs `workflow.recover` every 60 s | internal only |
| `nginx` | TLS termination, request-size limit, security headers | `443` |

File bodies never enter PostgreSQL: `api` and `worker` share the `media_storage` volume mounted
at `/data/storage`, and the database stores only `storage_key`, `checksum` and metadata.

## 2. First deployment

```bash
cp .env.example .env
# Required values: POSTGRES_PASSWORD, REDIS_PASSWORD, SECRET_KEY, CORS_ORIGINS
mkdir -p deploy/nginx/certs
openssl req -x509 -newkey rsa:4096 -days 365 -nodes \
  -keyout deploy/nginx/certs/server.key -out deploy/nginx/certs/server.crt \
  -subj "/CN=short-play.internal"
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
curl --cacert deploy/nginx/certs/server.crt https://short-play.internal/api/v1/health/ready
```

The API container applies `alembic upgrade head` on start and runs as the non-root user
`shortplay` (uid 10001) with an image-level healthcheck against `/api/v1/health/ready`.

Bootstrap the first administrator once, against an empty database:

```bash
docker compose -f docker-compose.prod.yml exec -T api \
  uv run --no-sync python -m apps.api.cli create-admin
```

## 3. Acceptance verification

`scripts/e2e_acceptance.py` exercises the delivered surface end to end and exits non-zero on any
failure: readiness, bootstrap, login, project creation, mock generation task, a persistent workflow
run actually completed by Celery, asset upload, FFmpeg export, MP4 download, audit trail, and
unauthenticated denial. CI runs it in the `e2e-acceptance` job against a freshly built stack, so
CI success means the flow ran, not that it was skipped.

```bash
python3 scripts/e2e_acceptance.py --base-url https://short-play.internal --timeout 300
```

## 4. Backup and restore

```bash
bash scripts/backup.sh docker-compose.prod.yml        # prints db and media archive paths
bash scripts/restore.sh <db.dump.gz> short_play docker-compose.prod.yml
bash scripts/restore.sh --media <media.tar.gz> docker-compose.prod.yml
```

The database archive is a `pg_dump --format=custom` stream; the media archive is a
`tar -czf` of `/data/storage`. CI restores the dump into a fresh database
(`short_play_restore`) and asserts a non-zero `users` count, so the restore path is verified
rather than assumed. Backup artifacts must be copied off the host; this runbook does not claim
off-site replication is configured.

## 5. Operational recovery

* Orphaned workflow nodes (worker crash) are reclaimed by the `workflow.recover` beat task
  through expired leases; an operator can force the sweep per run with
  `POST /api/v1/workflow-runs/{id}/recover`.
* Failed nodes retry with bounded exponential backoff until the attempt budget is exhausted, then
  the node and its run are recorded as `failed` with the provider error code.
* Duplicate Celery deliveries are safe: node execution is idempotent per attempt key
  (`wf:{run}:{node}:{attempt}`).

## 6. Known limits

* This repository is still **public**; making it private is an owner decision and has not been
  applied autonomously.
* No off-site backup replication, no external monitoring/alerting stack, and no HA PostgreSQL
  have been added. They belong to deployment hardening beyond the current milestone scope.
* Provider credentials for real third-party AI APIs are not wired into the runtime yet; the
  default provider remains the deterministic mock.
