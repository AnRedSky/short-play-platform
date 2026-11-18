"""Projects domain constants."""

PROJECT_STATUSES = ("draft", "in_review", "approved", "rejected", "archived")
PROJECT_ROLES = ("owner", "producer", "writer", "director", "artist", "editor", "reviewer")

# Project roles allowed to modify a project when the caller is not an org manager.
PROJECT_WRITE_ROLES = ("owner", "producer", "writer")

PROJECT_MANAGE_PERMISSION = "projects:manage"
PROJECT_CODE_CONFLICT = "Project code already exists"
