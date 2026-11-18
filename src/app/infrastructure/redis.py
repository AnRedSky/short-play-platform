"""Redis client wrapper and cache dependency.

Celery's result backend points at the same Redis instance by default, so queue
results and application cache share one lifecycle and one connection pool.
"""

from functools import lru_cache

import redis

from app.config.settings import get_settings


@lru_cache
def get_redis_client() -> redis.Redis:
    """Process-wide Redis client with fail-fast timeouts for probes."""
    settings = get_settings()
    return redis.Redis.from_url(
        settings.result_backend_url,
        socket_connect_timeout=1,
        socket_timeout=1,
        decode_responses=True,
    )


def get_cache() -> redis.Redis:
    """FastAPI dependency for cache access."""
    return get_redis_client()


def check_connection() -> str:
    """Readiness probe for Redis: ``ok`` or ``unavailable``."""
    try:
        get_redis_client().ping()
    except Exception:  # noqa: BLE001 - a probe reports state, it never raises
        return "unavailable"
    return "ok"


def close_connection() -> None:
    get_redis_client().close()
    get_redis_client.cache_clear()
