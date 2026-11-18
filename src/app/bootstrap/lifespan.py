"""Startup / shutdown hooks.

In split deployment mode (api / worker / beat as separate processes) nothing here
starts or stops a Celery worker or the beat scheduler: the API only reports its
own resources.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config.logging import configure_logging, get_logger
from app.config.settings import get_settings
from app.infrastructure import redis as redis_infra

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level, process="api")
    logger.info(
        "api starting env=%s debug=%s prefix=%s", settings.app_env, settings.debug,
        settings.api_v1_prefix,
    )
    try:
        yield
    finally:
        redis_infra.close_connection()
        logger.info("api stopped")
