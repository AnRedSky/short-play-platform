"""Cross-module dependencies: database session, authentication, pagination."""

from app.dependencies.auth import (
    Principal,
    get_current_active_user,
    get_current_user,
    get_principal,
    require_permission,
)
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, get_pagination

__all__ = [
    "PaginationParams",
    "Principal",
    "get_current_active_user",
    "get_current_user",
    "get_db",
    "get_pagination",
    "get_principal",
    "require_permission",
]
