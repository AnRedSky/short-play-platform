"""Notification inbox HTTP contract."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams
from app.domains.audit import service as audit_service
from app.domains.notifications import service as notifications_service
from app.public.schemas import envelope

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _pagination(page: int, page_size: int, limit: int | None) -> PaginationParams:
    """Accept the page contract and the UI's ``limit`` shorthand."""
    if limit is not None:
        return PaginationParams(page=1, page_size=limit)
    return PaginationParams(page=page, page_size=page_size)


@router.get("")
def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    limit: int | None = Query(default=None, ge=1, le=100),
    project: str | None = Query(default=None, max_length=80),
    unread: bool | None = Query(default=None),
    state: str | None = Query(default=None, max_length=20),
    type: str | None = Query(default=None, max_length=40),
    q: str | None = Query(default=None, max_length=120),
    principal: Principal = Depends(require_permission("notify.handle")),
    db: Session = Depends(get_db),
) -> dict:
    if principal.organization_id is None:
        return envelope([], {"page": 1, "page_size": 0, "total": 0})
    pagination = _pagination(page, page_size, limit)
    rows, total = notifications_service.list_for_user(
        db,
        organization_id=principal.organization_id,
        recipient_user_id=principal.user.id,
        project=project,
        unread=unread,
        state=state,
        notification_type=type,
        query_text=q,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return envelope(
        [notifications_service.serialize(row) for row in rows],
        pagination.meta(total),
    )


@router.post("/read-all")
def read_all_notifications(
    request: Request,
    project: str | None = Query(default=None, max_length=80),
    type: str | None = Query(default=None, max_length=40),
    principal: Principal = Depends(require_permission("notify.handle")),
    db: Session = Depends(get_db),
) -> dict:
    if principal.organization_id is None:
        return envelope({"updated": 0})
    updated = notifications_service.mark_all_read(
        db,
        organization_id=principal.organization_id,
        recipient_user_id=principal.user.id,
        actor_user_id=principal.user.id,
        project=project,
        notification_type=type,
    )
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="notification.read_all",
        resource_type="notification",
        resource_id=None,
        request_id=getattr(request.state, "request_id", None) if request else None,
        details={"updated": updated, "project": project, "type": type},
    )
    db.commit()
    return envelope({"updated": updated})


@router.post("/{notification_id}/read")
def read_notification(
    notification_id: UUID,
    request: Request,
    principal: Principal = Depends(require_permission("notify.handle")),
    db: Session = Depends(get_db),
) -> dict:
    if principal.organization_id is None:
        from app.public.exceptions import not_found

        raise not_found("Notification not found")
    notification = notifications_service.mark_read(
        db,
        notification_id=notification_id,
        organization_id=principal.organization_id,
        recipient_user_id=principal.user.id,
        actor_user_id=principal.user.id,
    )
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="notification.read",
        resource_type="notification",
        resource_id=str(notification.id),
        request_id=getattr(request.state, "request_id", None),
        details={"object_key": notification.object_key},
    )
    db.commit()
    db.refresh(notification)
    return envelope(notifications_service.serialize(notification))
