"""Permission catalog: the single source of truth for RBAC codes."""

PERMISSION_CATALOG: dict[str, str] = {
    "users:read": "Read users of the organization",
    "users:write": "Create, update and deactivate users",
    "roles:read": "Read roles and permissions",
    "roles:write": "Create roles and assign permissions or roles",
    "organizations:read": "Read organizations, departments and members",
    "organizations:write": "Manage organization structure",
    "projects:read": "Read projects and project resources",
    "projects:write": "Create and update projects",
    "projects:manage": "Manage project members and project lifecycle",
    "audit:read": "Read audit records",
}

ALL_PERMISSIONS: frozenset[str] = frozenset(PERMISSION_CATALOG)

ROLE_TEMPLATES: dict[str, dict[str, object]] = {
    "administrator": {"name": "Administrator", "permissions": sorted(ALL_PERMISSIONS)},
    "producer": {
        "name": "Producer",
        "permissions": [
            "audit:read",
            "organizations:read",
            "projects:manage",
            "projects:read",
            "projects:write",
            "users:read",
        ],
    },
    "writer": {
        "name": "Writer",
        "permissions": ["projects:read", "projects:write"],
    },
    "artist": {
        "name": "Artist",
        "permissions": ["projects:read"],
    },
    "editor": {
        "name": "Editor",
        "permissions": ["projects:read"],
    },
    "reviewer": {
        "name": "Reviewer",
        "permissions": ["projects:read"],
    },
}
