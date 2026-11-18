"""Audit log data access."""

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.audit.models import AuditLog
from app.domains.organizations.models import OrganizationMember


def add_log(
    db: Session,
    *,
    actor_user_id: UUID | None,
    action: str,
    resource_type: str,
    resource_id: str | None,
    result: str = "success",
    request_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    log = AuditLog(
        actor_user_id=actor_user_id,
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
    db: Session, *, organization_id: UUID, action: str | None, pagination: PaginationParams
) -> tuple[list[AuditLog], int]:
    query = (
        select(AuditLog)
        .join(OrganizationMember, OrganizationMember.user_id == AuditLog.actor_user_id)
        .where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.is_active.is_(True),
        )
    )
    count_query = (
        select(func.count(AuditLog.id))
        .join(OrganizationMember, OrganizationMember.user_id == AuditLog.actor_user_id)
        .where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.is_active.is_(True),
        )
    )
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    rows = db.scalars(
        query.order_by(AuditLog.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()
    total = int(db.scalar(count_query) or 0)
    return list(rows), total
