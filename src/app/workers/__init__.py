"""Workers package: Celery app, task registry, beat schedule and infra tasks."""

from app.workers.celery_app import celery_app

__all__ = ["celery_app"]
