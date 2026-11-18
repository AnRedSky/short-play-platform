"""Audit business rules: one place that writes privileged-action records."""

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.audit import repository as audit_repo
from app.domains.audit.models import AuditLog


def record(
    db: Session,
    *,
    actor_user_id: UUID | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    result: str = "success",
    request_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    """Append one audit entry. The caller owns the surrounding transaction."""
    return audit_repo.add_log(
        db,
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        result=result,
        request_id=request_id,
        details=details,
    )


def list_logs(
    db: Session, *, action: str | None, pagination: PaginationParams
) -> tuple[list[AuditLog], int]:
    return audit_repo.list_logs(db, action=action, pagination=pagination)
