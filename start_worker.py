"""Local worker / beat entry point.

    python start_worker.py            # worker
    python start_worker.py --beat     # beat scheduler
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from app.workers.celery_app import celery_app  # noqa: E402


def main(argv: list[str] | None = None) -> None:
    argv = list(sys.argv[1:] if argv is None else argv)
    if "--beat" in argv:
        argv.remove("--beat")
        argv = ["beat", "--loglevel=INFO", "-s", "celerybeat-schedule", *argv]
    else:
        argv = ["worker", "--loglevel=INFO", "--pool=solo", *argv]
    celery_app.worker_main(argv)


if __name__ == "__main__":
    main()
