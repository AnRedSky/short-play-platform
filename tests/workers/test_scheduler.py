"""Worker infrastructure: beat schedule sanity."""

from celery.schedules import crontab

from app.workers.celery_app import celery_app
from app.workers.scheduler import BEAT_SCHEDULE


def test_every_entry_declares_a_task_and_schedule():
    for name, entry in BEAT_SCHEDULE.items():
        assert entry["task"], f"{name} has no task"
        assert entry["schedule"] is not None, f"{name} has no schedule"


def test_task_names_are_unique():
    task_names = [entry["task"] for entry in BEAT_SCHEDULE.values()]
    assert len(task_names) == len(set(task_names))


def test_every_scheduled_task_is_registered():
    registered = set(celery_app.tasks)
    for entry in BEAT_SCHEDULE.values():
        assert entry["task"] in registered


def test_crontab_expressions_are_valid():
    for name, entry in BEAT_SCHEDULE.items():
        schedule = entry["schedule"]
        if isinstance(schedule, crontab):
            assert str(schedule), f"{name} produced an empty crontab expression"


def test_periodic_intervals_do_not_overlap():
    pairs = [(entry["task"], str(entry["schedule"])) for entry in BEAT_SCHEDULE.values()]
    assert len(pairs) == len(set(pairs))


def test_recovery_sweep_is_scheduled():
    assert BEAT_SCHEDULE["workflow-recovery"]["task"] == "workflow.recover"
