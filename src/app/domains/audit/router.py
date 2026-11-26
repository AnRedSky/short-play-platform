"""Audit log HTTP contract: read-only, append-only records."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, get_pagination
from app.domains.audit import service as audit_service
from app.domains.audit.models import AuditLog
from app.domains.audit.schemas import AuditLogRead
from app.public.schemas import envelope

router = APIRouter(prefix="/audit-logs", tags=["audit"])

_RESOURCE_LABELS = {
    "project": "项目",
    "user": "员工",
    "role": "角色",
    "notification": "通知",
    "department": "部门",
    "generation_task": "任务",
    "asset": "资产",
    "delivery": "交付",
}


_RESULT_LABELS = {
    "success": "成功",
    "failure": "失败",
}


def _serialize(log: AuditLog) -> dict:
    details = log.details or {}
    resource_label = _RESOURCE_LABELS.get(log.resource_type, log.resource_type)
    business_id = details.get("code") or details.get("project_code") or log.resource_id or ""
    object_label = f"{resource_label} {business_id}".strip()
    actor_name = log.actor.full_name if log.actor is not None else "系统"
    return AuditLogRead(
        id=log.id,
        actor_user_id=log.actor_user_id,
        action=log.action,
        resource_type=log.resource_type,
        resource_id=log.resource_id,
        result=_RESULT_LABELS.get(log.result, log.result),
        result_code=log.result,
        request_id=log.request_id,
        details=details,
        created_at=log.created_at,
        time=log.created_at,
        actor=actor_name,
        object=object_label,
        src=details.get("src") or log.request_id or "api",
        link=details.get("link"),
    ).model_dump(mode="json")


@router.get("")
def list_audit_logs(
    pagination: PaginationParams = Depends(get_pagination),
    action: str | None = Query(default=None, max_length=80),
    resource_type: str | None = Query(default=None, max_length=60),
    result: str | None = Query(default=None, max_length=20),
    q: str | None = Query(default=None, max_length=120),
    principal: Principal = Depends(require_permission("audit.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows, total = audit_service.list_logs(
        db,
        organization_id=principal.organization_id,
        action=action,
        resource_type=resource_type,
        result=result,
        query_text=q,
        pagination=pagination,
    )
    return envelope([_serialize(log) for log in rows], pagination.meta(total))
