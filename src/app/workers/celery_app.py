"""Celery application instance.

The instance is created before any task module is imported: domain ``tasks.py``
modules import ``celery_app`` from here, so importing them earlier would be a
circular import.

CLI entry points::

    celery -A app.workers.celery_app:celery_app worker --loglevel=INFO
    celery -A app.workers.celery_app:celery_app beat --loglevel=INFO
"""

from celery import Celery

from app.config.settings import get_settings
from app.infrastructure import broker

_settings = get_settings()

celery_app = Celery(
    "short_play_platform",
    broker=broker.broker_url(),
    backend=broker.result_backend_url(),
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_hijack_root_logger=False,
    timezone=_settings.celery_timezone,
    enable_utc=True,
    task_always_eager=_settings.celery_task_always_eager,
    task_eager_propagates=_settings.celery_task_always_eager,
    broker_transport_options=broker.broker_transport_options(),
    broker_connection_retry_on_startup=True,
)

# Imported only after the instance exists (task modules import it back).
from app.workers import registry  # noqa: E402
from app.workers.scheduler import BEAT_SCHEDULE  # noqa: E402

registry.register_all_tasks()
celery_app.conf.beat_schedule = BEAT_SCHEDULE

__all__ = ["celery_app"]
