# Production Operations Runbook (Private Deployment)

This runbook covers the enterprise-internal deployment: Linux hosts, Docker Compose, no SaaS
exposure. It complements `docs/08-deployment/DEPLOYMENT.md` and does not replace it.

## 1. Stack layout

Two compose projects run side by side:

- `docker/docker-compose.infra.yml` (`short-play-infra`): `postgres`, `redis`, `rabbitmq`. Own
  volumes, its own project name, reusable by other projects on the same host.
- `docker-compose.yml` (`short-play-platform`): `api`, `worker`, `beat`, `web`; joins the external
  network `short-play-infra`.
- `docker/docker-compose.prod.yml`: overlay for the project compose (restart policies, production
  env, TLS nginx).

| Service | Role | Exposure |
| --- | --- | --- |
| `postgres` | PostgreSQL 16 metadata store | internal only |
| `redis` | Cache and Celery result backend | internal only |
| `rabbitmq` | Optional Celery broker (`CELERY_BROKER_URL` switch) | internal only |
| `api` | FastAPI application, runs Alembic then Uvicorn with 2 workers | internal only, fronted by nginx |
| `worker` | Celery workers executing generation and workflow nodes | internal only |
| `beat` | Celery beat, runs `workflow.recover` every 60 s | internal only |
| `web` | Static Vue build served by nginx | internal only, fronted by nginx |
| `nginx` | TLS termination, request-size limit, security headers | `443` |

File bodies never enter PostgreSQL: `api` and `worker` share the `media_storage` volume mounted
at `/data/storage`, and the database stores only `storage_key`, `checksum` and metadata.

## 2. First deployment

```bash
cp .env.example .env
# Required values: POSTGRES_PASSWORD, REDIS_PASSWORD, SECRET_KEY, CORS_ORIGINS
docker compose -f docker/docker-compose.infra.yml up -d
mkdir -p docker/certs
openssl req -x509 -newkey rsa:4096 -days 365 -nodes \
  -keyout docker/certs/server.key -out docker/certs/server.crt \
  -subj "/CN=short-play.internal"
docker compose -f docker-compose.yml -f docker/docker-compose.prod.yml --env-file .env up -d --build
curl --cacert docker/certs/server.crt https://short-play.internal/api/v1/health/ready
```

The API container applies `alembic upgrade head` on start (`RUN_MIGRATIONS=1`, see
`docker/entrypoint.sh`) and runs as the non-root user `shortplay` (uid 10001) with an image-level
healthcheck against `/api/v1/health/ready`. The migration entry point creates the target database
when it does not exist yet, so a brand-new PostgreSQL host only needs valid credentials.

Bootstrap the first administrator once, against an empty database:

```bash
docker compose -f docker-compose.yml -f docker/docker-compose.prod.yml exec -T api \
  uv run --no-sync python scripts/create_superuser.py \
  --email admin@example.com --password 'CorrectHorseBattery1' \
  --name Admin --organization Studio
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
# prints db and media archive paths
bash scripts/backup.sh docker/docker-compose.infra.yml docker-compose.yml
bash scripts/restore.sh <db.dump.gz> short_play docker/docker-compose.infra.yml
bash scripts/restore.sh --media <media.tar.gz> docker-compose.yml
```

The database archive is a `pg_dump --format=custom` stream taken from the infra `postgres`
service; the media archive is a `tar -czf` of `/data/storage` taken from the project `api`
service. CI restores the dump into a fresh database (`short_play_restore`) and asserts a non-zero
`users` count, so the restore path is verified rather than assumed. Backup artifacts must be
copied off the host; this runbook does not claim off-site replication is configured.

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

## 2026-11-18 生产边界补充

本手册描述的是当前 Compose 运行拓扑，不代表所有业务域均已具备生产能力。生产启用真实生成前必须配置 Mork Provider 凭据、模型能力和外发策略；未配置应保持失败关闭，不允许 Mock 自动兜底。媒体导出当前已有图片序列基础实现，完整 Timeline 多轨渲染仍以 R6 交付为准。资产仅项目内可见；不得通过共享卷或静态文件 URL 绕过 API 项目授权。
