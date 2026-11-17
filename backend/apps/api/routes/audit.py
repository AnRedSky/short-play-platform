from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.deps import Principal, require_permission
from apps.api.models.audit import AuditLog
from apps.api.schemas.common import envelope

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("")
def list_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    action: str | None = Query(default=None),
    principal: Principal = Depends(require_permission("audit:read")),
    db: Session = Depends(get_db),
) -> dict:
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    rows = db.scalars(
        query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    total = int(db.scalar(count_query) or 0)
    return envelope(
        [
            {
                "id": str(log.id),
                "actor_user_id": str(log.actor_user_id) if log.actor_user_id else None,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "result": log.result,
                "request_id": log.request_id,
                "details": log.details,
                "created_at": log.created_at.isoformat(),
            }
            for log in rows
        ],
        {"page": page, "page_size": page_size, "total": total},
    )
