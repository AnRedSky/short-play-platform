"""Minimal administrative CLI for a private deployment."""

import argparse
import sys

from apps.api.db.session import SessionLocal
from apps.api.services.auth import bootstrap_first_administrator


def create_admin(args: argparse.Namespace) -> int:
    with SessionLocal() as db:
        bootstrap_first_administrator(
            db,
            email=args.email,
            password=args.password,
            full_name=args.name,
            organization_name=args.organization,
        )
        db.commit()
    print("administrator created")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="apps.api.cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    admin = subparsers.add_parser("create-admin", help="bootstrap the first administrator")
    admin.add_argument("--email", required=True)
    admin.add_argument("--password", required=True)
    admin.add_argument("--name", required=True)
    admin.add_argument("--organization", required=True)
    admin.set_defaults(handler=create_admin)

    args = parser.parse_args(argv)
    return int(args.handler(args))


if __name__ == "__main__":
    sys.exit(main())
