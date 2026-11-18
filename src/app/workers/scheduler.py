"""Beat schedule: the single table of periodic jobs.

Keep this file to names, schedules and arguments only; the task bodies live in
their domain ``tasks.py`` modules.
"""

from celery.schedules import crontab, schedule

from app.domains.workflow.tasks import RECOVERY_TASK_NAME
from app.workers.tasks.cleanup import EXPIRED_SESSIONS_TASK, TEMP_FILES_TASK
from app.workers.tasks.health import HEARTBEAT_TASK

BEAT_SCHEDULE: dict[str, dict] = {
    "workflow-recovery": {
        "task": RECOVERY_TASK_NAME,
        "schedule": schedule(run_every=60.0),
    },
    "session-cleanup": {
        "task": EXPIRED_SESSIONS_TASK,
        "schedule": crontab(minute=15),
    },
    "temp-file-cleanup": {
        "task": TEMP_FILES_TASK,
        "schedule": crontab(minute=45, hour="*/6"),
    },
    "worker-heartbeat": {
        "task": HEARTBEAT_TASK,
        "schedule": schedule(run_every=300.0),
    },
}

__all__ = ["BEAT_SCHEDULE"]
