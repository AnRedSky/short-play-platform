"""Pure string helpers."""

import re


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def slugify(value: str, *, max_length: int = 100) -> str:
    """Lower-cased, dash separated slug used for organization identifiers."""
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-")
    return slug[:max_length] or "organization"
