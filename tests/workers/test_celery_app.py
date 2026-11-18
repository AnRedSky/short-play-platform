"""Worker infrastructure: Celery configuration contract."""

from app.config.settings import get_settings
from app.infrastructure import broker
from app.workers.celery_app import celery_app


def test_broker_and_backend_come_from_settings():
    settings = get_settings()
    assert celery_app.conf.broker_url == broker.broker_url()
    assert celery_app.conf.result_backend == broker.result_backend_url()
    assert celery_app.conf.timezone == settings.celery_timezone


def test_reliability_flags():
    assert celery_app.conf.task_acks_late is True
    assert celery_app.conf.worker_prefetch_multiplier == 1
    assert celery_app.conf.task_serializer == "json"
    assert "json" in celery_app.conf.accept_content


def test_eager_mode_mirrors_the_setting():
    assert celery_app.conf.task_always_eager is get_settings().celery_task_always_eager


def test_beat_schedule_is_loaded():
    assert celery_app.conf.beat_schedule
    assert "workflow-recovery" in celery_app.conf.beat_schedule
