"""Users domain background tasks.

Tasks contain no business rules: they open a session, call the domain service and
stay idempotent so a redelivered message cannot duplicate side effects.
"""

from uuid import UUID

from app.config.logging import get_logger
from app.domains.users import constants, service
from app.infrastructure.db import session_scope
from app.workers.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name=constants.WELCOME_TASK_NAME, bind=True, max_retries=3, default_retry_delay=30)
def send_welcome_email(self, user_id: str) -> dict:  # noqa: ANN001 - celery binding
    """Deliver the welcome notification for a user exactly once."""
    with session_scope() as db:
        dispatched = service.dispatch_welcome_notification(db, UUID(user_id))
    if not dispatched:
        logger.info("welcome notification already delivered user_id=%s", user_id)
    return {"user_id": user_id, "dispatched": dispatched}
