"""Explicit task registration.

Celery does not scan packages: every domain that defines tasks must be imported
here, otherwise ``celery -A app.workers.celery_app worker`` starts without it.
Adding a domain with tasks means adding one line below.
"""

from app.domains.users import tasks as users_tasks  # noqa: F401
from app.domains.workflow import tasks as workflow_tasks  # noqa: F401
from app.workers.tasks import (
    cleanup,  # noqa: F401
    health,  # noqa: F401
)

TASK_MODULES = (
    users_tasks,
    workflow_tasks,
    cleanup,
    health,
)


def register_all_tasks() -> tuple[str, ...]:
    """Touch every task module (imports above already register the tasks)."""
    return tuple(module.__name__ for module in TASK_MODULES)
