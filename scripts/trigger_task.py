"""Trigger a background task by name, for debugging without a beat schedule.

    uv run python scripts/trigger_task.py system.ping
    uv run python scripts/trigger_task.py workflow.recover
    uv run python scripts/trigger_task.py workflow.run.dispatch --kwargs '{"run_id": "<uuid>"}'

Add ``--eager`` to run the task in-process instead of publishing to the broker.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from app.workers.celery_app import celery_app  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="scripts.trigger_task")
    parser.add_argument("task_name")
    parser.add_argument("--args", default="[]", help="JSON array of positional arguments")
    parser.add_argument("--kwargs", default="{}", help="JSON object of keyword arguments")
    parser.add_argument("--eager", action="store_true", help="run locally in this process")
    args = parser.parse_args(argv)

    if args.task_name not in celery_app.tasks:
        print(f"unknown task {args.task_name!r}; registered: {sorted(celery_app.tasks)}")
        return 1

    positional = json.loads(args.args)
    keyword = json.loads(args.kwargs)
    if args.eager:
        celery_app.conf.task_always_eager = True
    result = celery_app.send_task(args.task_name, args=positional, kwargs=keyword)
    print(json.dumps({"task_id": result.id, "task": args.task_name}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
