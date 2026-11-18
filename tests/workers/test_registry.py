"""Worker infrastructure: task registration completeness."""

import sys
from pathlib import Path

from app.workers import registry


def test_every_registered_module_is_imported():
    for module in registry.TASK_MODULES:
        assert module.__name__ in sys.modules


def test_known_tasks_are_registered():
    from app.workers.celery_app import celery_app

    registered = set(celery_app.tasks)
    for name in (
        "system.ping",
        "system.heartbeat",
        "cleanup.expired_sessions",
        "cleanup.temp_files",
        "workflow.recover",
        "workflow.run.dispatch",
        "users.send_welcome_email",
    ):
        assert name in registered, f"{name} is not registered"


def test_no_domain_tasks_module_is_forgotten():
    repo_root = Path(__file__).resolve().parents[2]
    on_disk = {path.parent.name for path in (repo_root / "src/app/domains").glob("*/tasks.py")}
    registered = {
        module.__name__.split(".")[2]
        for module in registry.TASK_MODULES
        if ".domains." in module.__name__
    }
    assert on_disk == registered
