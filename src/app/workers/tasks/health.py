"""Health and heartbeat tasks for the worker process.

``system.ping`` keeps its historical name so existing operational checks and
monitoring call the same task id.
"""

from app.config.logging import get_logger
from app.workers.celery_app import celery_app

logger = get_logger(__name__)

PING_TASK = "system.ping"
HEARTBEAT_TASK = "system.heartbeat"


@celery_app.task(name=PING_TASK)
def ping() -> dict:
    return {"status": "ok"}


@celery_app.task(name=HEARTBEAT_TASK)
def heartbeat() -> dict:
    logger.info("worker heartbeat")
    return {"status": "ok"}
