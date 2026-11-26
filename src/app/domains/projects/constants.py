"""Projects domain constants."""

from app.domains.projects.state_machine import PROJECT_STATUSES

PROJECT_ROLES = ("owner", "producer", "writer", "director", "artist", "editor", "reviewer")

# Project roles allowed to modify a project when the caller is not an org manager.
PROJECT_WRITE_ROLES = ("owner", "producer", "writer")

PROJECT_MANAGE_PERMISSION = "project.manage"
PROJECT_READ_PERMISSION = "project.read"
PROJECT_CREATE_PERMISSION = "project.create"
PROJECT_CODE_CONFLICT = "Project code already exists"

__all__ = [
    "PROJECT_STATUSES",
    "PROJECT_ROLES",
    "PROJECT_WRITE_ROLES",
    "PROJECT_MANAGE_PERMISSION",
    "PROJECT_READ_PERMISSION",
    "PROJECT_CREATE_PERMISSION",
    "PROJECT_CODE_CONFLICT",
]
