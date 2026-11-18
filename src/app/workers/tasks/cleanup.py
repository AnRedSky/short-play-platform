"""Cross-domain cleanup tasks: no business rules, only housekeeping.

Both tasks are idempotent: running them twice removes nothing extra and reports
zero work the second time.
"""

from app.config.logging import get_logger
from app.domains.auth import service as auth_service
from app.infrastructure.db import session_scope
from app.infrastructure.storage import purge_temp_files
from app.workers.celery_app import celery_app

logger = get_logger(__name__)

EXPIRED_SESSIONS_TASK = "cleanup.expired_sessions"
TEMP_FILES_TASK = "cleanup.temp_files"


@celery_app.task(name=EXPIRED_SESSIONS_TASK)
def purge_expired_sessions() -> dict:
    with session_scope() as db:
        removed = auth_service.purge_expired_sessions(db)
    if removed:
        logger.info("purged expired sessions count=%s", removed)
    return {"removed": removed}


@celery_app.task(name=TEMP_FILES_TASK)
def purge_temp_storage() -> dict:
    removed = purge_temp_files()
    if removed:
        logger.info("purged temporary files count=%s", removed)
    return {"removed": removed}
