"""Audit log data access."""

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.audit.models import AuditLog


def add_log(
    db: Session,
    *,
    actor_user_id: UUID | None,
    action: str,
    resource_type: str,
    resource_id: str | None,
    organization_id: UUID | None = None,
    result: str = "success",
    request_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    log = AuditLog(
        actor_user_id=actor_user_id,
        organization_id=organization_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        result=result,
        request_id=request_id,
        details=details or {},
    )
    db.add(log)
    db.flush()
    return log


def find_by_action_and_resource(
    db: Session, *, action: str, resource_type: str, resource_id: str
) -> AuditLog | None:
    return db.scalar(
        select(AuditLog).where(
            AuditLog.action == action,
            AuditLog.resource_type == resource_type,
            AuditLog.resource_id == resource_id,
        )
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
    filters = [AuditLog.organization_id == organization_id]
    if action:
        filters.append(AuditLog.action == action)
    if resource_type:
        filters.append(AuditLog.resource_type == resource_type)
    if result:
        filters.append(AuditLog.result == result)
    if query_text:
        pattern = f"%{query_text.strip()}%"
        filters.append(
            AuditLog.action.ilike(pattern)
            | AuditLog.resource_type.ilike(pattern)
            | AuditLog.resource_id.ilike(pattern)
        )
    query = select(AuditLog).where(*filters)
    count_query = select(func.count(AuditLog.id)).where(*filters)
    rows = db.scalars(
        query.order_by(AuditLog.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()
    total = int(db.scalar(count_query) or 0)
    return list(rows), total
