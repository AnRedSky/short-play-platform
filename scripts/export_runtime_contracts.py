#!/usr/bin/env python3
"""Export runtime API and SQLAlchemy/Alembic inventories for CI review."""
from __future__ import annotations

import argparse
import importlib
import json
from pathlib import Path
from typing import Any

from alembic.config import Config
from alembic.script import ScriptDirectory

MODEL_MODULES = (
    "app.domains.assets.models",
    "app.domains.audit.models",
    "app.domains.auth.models",
    "app.domains.creation.models",
    "app.domains.generation.models",
    "app.domains.organizations.models",
    "app.domains.projects.models",
    "app.domains.roles.models",
    "app.domains.users.models",
    "app.domains.workflow.models",
)


def _schema_inventory() -> dict[str, Any]:
    for module in MODEL_MODULES:
        importlib.import_module(module)
    from app.infrastructure.db import metadata

    tables = []
    for table in sorted(metadata.sorted_tables, key=lambda item: item.fullname):
        indexes = [
            {
                "name": index.name,
                "columns": [column.name for column in index.columns],
                "unique": index.unique,
            }
            for index in table.indexes
        ]
        tables.append(
            {
                "name": table.fullname,
                "columns": [
                    {
                        "name": column.name,
                        "type": str(column.type),
                        "nullable": column.nullable,
                        "primary_key": column.primary_key,
                    }
                    for column in table.columns
                ],
                "foreign_keys": sorted(
                    f"{fk.parent.name}->{fk.target_fullname}" for fk in table.foreign_keys
                ),
                "indexes": sorted(indexes, key=lambda item: item["name"] or ""),
            }
        )

    scripts = ScriptDirectory.from_config(Config("alembic.ini"))
    revisions = [
        {
            "revision": revision.revision,
            "down_revision": revision.down_revision,
            "branch_labels": sorted(revision.branch_labels or ()),
            "depends_on": revision.dependencies,
        }
        for revision in scripts.walk_revisions()
    ]
    return {
        "table_count": len(tables),
        "tables": tables,
        "migration_heads": sorted(scripts.get_heads()),
        "migration_revisions": revisions,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    from app.main import app

    openapi = app.openapi()
    schema = _schema_inventory()
    (args.output_dir / "openapi.json").write_text(
        json.dumps(openapi, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "database-schema.json").write_text(
        json.dumps(schema, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        f"Exported OpenAPI ({len(openapi.get('paths', {}))} paths) and "
        f"SQLAlchemy schema inventory ({schema['table_count']} tables) "
        f"to {args.output_dir}"
    )


if __name__ == "__main__":
    main()
