# Backend development

Requires Python 3.12+ and uv.

```bash
uv sync --all-groups
uv run alembic upgrade head
uv run uvicorn apps.api.main:app --reload
uv run celery -A apps.api.workers.celery_app:celery_app worker --loglevel=INFO
uv run pytest -q
uv run ruff check .
```

The liveness endpoint is `GET /api/v1/health`. PostgreSQL is the persistence layer and Redis is used as the Celery broker/backend.
