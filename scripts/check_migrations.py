"""Fail when the models and the migration history have drifted apart.

Used by CI before running the test suite so missing migrations are caught early.

    uv run python scripts/check_migrations.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from alembic.config import Config  # noqa: E402
from alembic.runtime.migration import MigrationContext  # noqa: E402
from alembic.script import ScriptDirectory  # noqa: E402

from app.infrastructure.db import engine, ensure_database_exists  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "migrations"))
    config.set_main_option("prepend_sys_path", str(ROOT / "src"))
    script = ScriptDirectory.from_config(config)
    head = script.get_current_head()

    # Mirrors the migration entry point: a missing database is provisioned here
    # too, so the check reports "no revision" instead of crashing with 3D000.
    if ensure_database_exists():
        print("database was missing and has been created; run: uv run alembic upgrade head")
        return 1

    with engine.connect() as connection:
        current = MigrationContext.configure(connection).get_current_revision()

    if current != head:
        print(f"database is at {current!r}, expected head {head!r}")
        print("run: uv run alembic upgrade head")
        return 1

    print(f"database is at head {head}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
