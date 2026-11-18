"""Seed reference data: permission catalog and role templates per organization.

Idempotent: re-running only refreshes what is missing.

    uv run python scripts/seed_db.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from app.domains.organizations import repository as organizations_repo  # noqa: E402
from app.domains.roles import service as roles_service  # noqa: E402
from app.infrastructure.db import session_scope  # noqa: E402


def seed() -> dict[str, int]:
    with session_scope() as db:
        permissions = roles_service.sync_permission_catalog(db)
        organizations = organizations_repo.list_organizations(db)
        for organization in organizations:
            for template_code in roles_service.ROLE_TEMPLATES:
                roles_service.provision_role_template(db, organization.id, template_code)
        return {
            "permissions": len(permissions),
            "organizations": len(organizations),
            "role_templates": len(roles_service.ROLE_TEMPLATES),
        }


if __name__ == "__main__":
    print(seed())
