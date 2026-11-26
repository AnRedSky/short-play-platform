"""B-03 acceptance: 36 permission codes and the six-identity × 56-route matrix."""

import json
from pathlib import Path

from app.domains.roles.constants import ALL_PERMISSIONS, PERMISSION_CATALOG, ROLE_TEMPLATES

ROOT = Path(__file__).resolve().parents[3]
WEB = ROOT / "web"
IDENTITIES = {
    "i-ops": "ops",
    "i-admin": "admin",
    "i-dept": "dept",
    "i-owner": "owner",
    "i-staff": "staff",
    "i-auditor": "auditor",
}


def _json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_catalog_is_exactly_the_thirty_six_contract_codes():
    assert len(PERMISSION_CATALOG) == 36
    assert len(ALL_PERMISSIONS) == 36
    assert all(":" not in code for code in ALL_PERMISSIONS)


def test_identity_templates_match_frontend_mock_roles():
    roles = {
        row["code"]: set(row["perms"])
        for row in _json(WEB / "src/mock/seed.json")["entities"]["roles"]
    }
    for code in IDENTITIES.values():
        assert set(ROLE_TEMPLATES[code]["permissions"]) == roles[code]
        assert roles[code] <= ALL_PERMISSIONS


def test_every_route_permission_is_in_the_catalog():
    routes = _json(WEB / "src/mock/routes.json")
    referenced: set[str] = set()
    for route in routes:
        permission = route.get("permission")
        if isinstance(permission, list):
            referenced.update(permission)
        elif permission:
            referenced.add(permission)
    assert referenced <= ALL_PERMISSIONS


def test_six_identities_over_fifty_six_routes_match_the_frontend_snapshot():
    routes = _json(WEB / "src/mock/routes.json")
    snapshot = _json(
        WEB / "tests/e2e/__snapshots__/permission-matrix.spec.ts/permission-matrix.json"
    )
    assert len(routes) == 56

    decisions = 0
    mismatches: list[str] = []
    for identity_id, role_code in IDENTITIES.items():
        permissions = set(ROLE_TEMPLATES[role_code]["permissions"])
        expected_for_identity = snapshot[identity_id]
        assert len(expected_for_identity) == 56
        for route in routes:
            path = f"/{route['path']}"
            permission = route.get("permission")
            required = permission if isinstance(permission, list) else [permission]
            allowed = any(code in permissions for code in required if code)
            expected = expected_for_identity[path] == "allow"
            decisions += 1
            if allowed != expected:
                mismatches.append(f"{identity_id} {path}: computed={allowed} snapshot={expected}")

    assert decisions == 336
    assert not mismatches, "\n".join(mismatches)
