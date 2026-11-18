"""Celery broker connector.

The broker URL comes from settings only (``CELERY_BROKER_URL``, falling back to
the shared Redis instance). Nothing else in the code base builds a broker URL.
"""

from typing import Any

from app.config.settings import get_settings


def broker_url() -> str:
    return get_settings().broker_url


def result_backend_url() -> str:
    return get_settings().result_backend_url


def is_redis_transport() -> bool:
    return broker_url().startswith(("redis://", "rediss://"))


def broker_transport_options() -> dict[str, Any]:
    """Visibility timeout keeps an in-flight task from being redelivered too early."""
    if is_redis_transport():
        return {"visibility_timeout": 3600, "socket_connect_timeout": 5, "socket_timeout": 5}
    return {}


def broker_connection() -> object:
    """Create a Kombu connection for health checks (caller closes it)."""
    from kombu import Connection  # imported lazily: only workers need kombu

    return Connection(broker_url())
