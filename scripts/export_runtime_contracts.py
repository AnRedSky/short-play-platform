#!/usr/bin/env python3
"""Export runtime API and SQLAlchemy/Alembic inventories for CI review."""
from __future__ import annotations

import argparse
import importlib
import json
import re
from pathlib import Path
from typing import Any

from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi.routing import APIRoute

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


def _permission_codes(dependant: Any) -> list[str]:
    found: set[str] = set()
    pending = list(dependant.dependencies)
    while pending:
        dependency = pending.pop()
        call = dependency.call
        for cell in getattr(call, "__closure__", ()) or ():
            try:
                value = cell.cell_contents
            except ValueError:
                continue
            if isinstance(value, str) and ":" in value:
                found.add(value)
        pending.extend(dependency.dependencies)
    return sorted(found)


def _route_inventory(app: Any) -> list[dict[str, Any]]:
    rows = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        rows.append(
            {
                "path": route.path,
                "methods": sorted(route.methods or ()),
                "name": route.name,
                "tags": sorted(route.tags or ()),
                "include_in_schema": route.include_in_schema,
                "declared_permissions": _permission_codes(route.dependant),
            }
        )
    return sorted(
        rows,
        key=lambda item: (item["path"], item["methods"][0] if item["methods"] else ""),
    )


def _normalize_path(path: str) -> str:
    path = path.split("?", 1)[0]
    path = re.sub(r"\$\{[^}]+\}", "{param}", path)
    path = re.sub(r"\{[^}]+\}", "{param}", path)
    return path.rstrip("/") or "/"


def _frontend_api_inventory(routes: list[dict[str, Any]]) -> dict[str, Any]:
    call_pattern = re.compile(
        r"\bapi(Get|Post|Patch|Put|Delete)\s*(?:<[^()]*>)?\s*\(\s*(['\"\x60])([^'\"\x60]+)\2"
    )
    route_keys = {
        (method, _normalize_path(route["path"]))
        for route in routes
        for method in route["methods"]
    }
    calls = []
    for source in sorted(Path("web/src/api").glob("*.ts")):
        content = source.read_text(encoding="utf-8")
        for match in call_pattern.finditer(content):
            verb, _quote, raw_path = match.groups()
            method = verb.upper()
            normalized = _normalize_path(raw_path)
            calls.append(
                {
                    "file": source.as_posix(),
                    "method": method,
                    "path": raw_path,
                    "normalized_path": normalized,
                    "matched_backend_route": (method, normalized) in route_keys,
                }
            )
    used = {
        (call["method"], call["normalized_path"])
        for call in calls
        if call["matched_backend_route"]
    }
    route_keys_sorted = sorted(route_keys)
    return {
        "frontend_call_count": len(calls),
        "matched_call_count": sum(call["matched_backend_route"] for call in calls),
        "unmatched_frontend_calls": [call for call in calls if not call["matched_backend_route"]],
        "backend_routes_without_api_client": [
            {"method": method, "path": route_path}
            for method, route_path in route_keys_sorted
            if (method, route_path) not in used
        ],
        "calls": calls,
    }


def _duplicate_route_methods(routes: list[dict[str, Any]]) -> list[dict[str, str]]:
    seen: set[tuple[str, str]] = set()
    duplicates = []
    for route in routes:
        for method in route["methods"]:
            key = (method, route["path"])
            if key in seen:
                duplicates.append({"method": method, "path": route["path"]})
            seen.add(key)
    return duplicates


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
    routes = _route_inventory(app)
    frontend_map = _frontend_api_inventory(routes)
    duplicate_routes = _duplicate_route_methods(routes)
    schema_paths = set(openapi.get("paths", {}))
    registered_paths = {
        route["path"] for route in routes if route["include_in_schema"]
    }
    if schema_paths != registered_paths:
        missing_from_schema = sorted(registered_paths - schema_paths)
        missing_from_router = sorted(schema_paths - registered_paths)
        raise RuntimeError(
            "OpenAPI/router path mismatch: "
            f"not_in_openapi={missing_from_schema}, not_registered={missing_from_router}"
        )
    (args.output_dir / "openapi.json").write_text(
        json.dumps(openapi, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "route-permissions.json").write_text(
        json.dumps(routes, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "frontend-api-map.json").write_text(
        json.dumps(frontend_map, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "duplicate-routes.json").write_text(
        json.dumps(duplicate_routes, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "database-schema.json").write_text(
        json.dumps(schema, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        f"Exported OpenAPI ({len(openapi.get('paths', {}))} paths) and "
        f"SQLAlchemy schema inventory ({schema['table_count']} tables) and "
        f"route permission annotations ({len(routes)} routes), "
        f"frontend API map ({frontend_map['matched_call_count']}/{frontend_map['frontend_call_count']} calls matched), "
        f"and {len(duplicate_routes)} duplicate method/path pairs "
        f"to {args.output_dir}"
    )


if __name__ == "__main__":
    main()
