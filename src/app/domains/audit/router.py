"""Audit log HTTP contract."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, get_pagination
from app.domains.audit import service as audit_service
from app.domains.audit.schemas import AuditLogRead
from app.public.schemas import envelope

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("")
def list_audit_logs(
    pagination: PaginationParams = Depends(get_pagination),
    action: str | None = Query(default=None),
    principal: Principal = Depends(require_permission("audit:read")),
    db: Session = Depends(get_db),
) -> dict:
    rows, total = audit_service.list_logs(
        db, organization_id=principal.organization_id, action=action, pagination=pagination
    )
    return envelope(
        [AuditLogRead.model_validate(log).model_dump(mode="json") for log in rows],
        pagination.meta(total),
    )
