"""Health business rules: liveness and dependency readiness probes."""

from app.config.logging import get_logger
from app.infrastructure import db as db_infra
from app.infrastructure import redis as redis_infra

logger = get_logger(__name__)


def liveness() -> str:
    return "ok"


def probe_postgresql() -> str:
    status = db_infra.check_connection()
    if status != "ok":
        logger.warning("Readiness probe failed for PostgreSQL")
    return status


def probe_redis() -> str:
    status = redis_infra.check_connection()
    if status != "ok":
        logger.warning("Readiness probe failed for Redis")
    return status


def readiness() -> tuple[str, dict[str, str], bool]:
    """Returns ``(status, components, ready)``."""
    components = {"postgresql": probe_postgresql(), "redis": probe_redis()}
    ready = all(value == "ok" for value in components.values())
    return ("ok" if ready else "degraded"), components, ready
