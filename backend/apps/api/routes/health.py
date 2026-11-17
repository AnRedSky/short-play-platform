import logging

import redis
from fastapi import APIRouter, Response
from sqlalchemy import text

from apps.api.config import get_settings
from apps.api.db.session import engine

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health", summary="Application liveness")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def probe_postgresql() -> str:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        logger.warning("Readiness probe failed for PostgreSQL", exc_info=True)
        return "unavailable"
    return "ok"


def probe_redis() -> str:
    try:
        client = redis.Redis.from_url(
            get_settings().redis_url,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        client.ping()
    except Exception:
        logger.warning("Readiness probe failed for Redis", exc_info=True)
        return "unavailable"
    return "ok"


@router.get("/health/ready", summary="Dependency readiness")
def readiness(response: Response) -> dict[str, object]:
    components = {
        "postgresql": probe_postgresql(),
        "redis": probe_redis(),
    }
    ready = all(value == "ok" for value in components.values())
    if not ready:
        response.status_code = 503
    return {"status": "ok" if ready else "degraded", "components": components}
