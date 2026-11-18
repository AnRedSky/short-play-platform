"""Create the first administrator for a private deployment.

    uv run python scripts/create_superuser.py --email admin@example.com \
        --password 'CorrectHorseBattery1' --name Admin --organization Studio
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from app.domains.auth import service as auth_service  # noqa: E402
from app.infrastructure.db import session_scope  # noqa: E402


def create_admin(args: argparse.Namespace) -> int:
    with session_scope() as db:
        auth_service.bootstrap_first_administrator(
            db,
            email=args.email,
            password=args.password,
            full_name=args.name,
            organization_name=args.organization,
        )
    print("administrator created")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="scripts.create_superuser")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--organization", required=True)
    return create_admin(parser.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
