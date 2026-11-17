from celery import Celery

from apps.api.config import get_settings

settings = get_settings()
celery_app = Celery(
    "short_play_platform",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["apps.api.workers.tasks", "apps.api.workers.workflow_tasks"],
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    # Orphaned leases are reclaimed on a fixed cadence; duplicate delivery is harmless.
    beat_schedule={
        "workflow-recovery": {
            "task": "workflow.recover",
            "schedule": 60.0,
        }
    },
)
