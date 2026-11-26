"""Audit business rules: one place that writes privileged-action records."""

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.audit import repository as audit_repo
from app.domains.audit.context import current_organization_id as audit_organization_id
from app.domains.audit.models import AuditLog
from app.domains.organizations import repository as organizations_repo


def _resolve_organization_id(
    db: Session, actor_user_id: UUID | None, organization_id: UUID | None
) -> UUID | None:
    """Keep audit rows tenant-scoped without threading org through every caller."""
    if organization_id is not None:
        return organization_id
    request_scope = audit_organization_id.get()
    if request_scope is not None:
        return request_scope
    if actor_user_id is None:
        return None
    return organizations_repo.primary_organization_id(db, actor_user_id)


def record(
    db: Session,
    *,
    actor_user_id: UUID | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    organization_id: UUID | None = None,
    result: str = "success",
    request_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    """Append one audit entry. The caller owns the surrounding transaction."""
    return audit_repo.add_log(
        db,
        actor_user_id=actor_user_id,
        organization_id=_resolve_organization_id(db, actor_user_id, organization_id),
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        result=result,
        request_id=request_id,
        details=details,
    )


def list_logs(
    db: Session,
    *,
    organization_id: UUID,
    action: str | None,
    resource_type: str | None,
    result: str | None,
    query_text: str | None,
    pagination: PaginationParams,
) -> tuple[list[AuditLog], int]:
    return audit_repo.list_logs(
        db,
        organization_id=organization_id,
        action=action,
        resource_type=resource_type,
        result=result,
        query_text=query_text,
        pagination=pagination,
    )
