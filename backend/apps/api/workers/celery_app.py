from celery import Celery

from apps.api.config import get_settings

settings = get_settings()
celery_app = Celery(
    "short_play_platform",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["apps.api.workers.tasks"],
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)
