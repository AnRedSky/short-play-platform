"""Operations HTTP contract: health, queues, logs, incidents and backups."""

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, get_pagination
from app.domains.audit import service as audit_service
from app.domains.ops import service as ops_service
from app.domains.ops.schemas import BackupTrigger
from app.public.schemas import envelope

router = APIRouter(prefix="/ops", tags=["ops"])


@router.get("/health")
def ops_health(
    principal: Principal = Depends(require_permission("platform.read")),
    db: Session = Depends(get_db),
) -> dict:
    if principal.organization_id is None:
        from app.public.exceptions import permission_denied

        raise permission_denied("Organization is required for operations health")
    return envelope(
        ops_service.health_snapshot(db, organization_id=principal.organization_id)
    )


@router.get("/overview")
def ops_overview(
    principal: Principal = Depends(require_permission("platform.read")),
    db: Session = Depends(get_db),
) -> dict:
    if principal.organization_id is None:
        from app.public.exceptions import permission_denied

        raise permission_denied("Organization is required for operations overview")
    return envelope(ops_service.overview(db, organization_id=principal.organization_id))


@router.get("/queues")
def ops_queues(
    principal: Principal = Depends(require_permission("platform.read")),
    db: Session = Depends(get_db),
) -> dict:
    if principal.organization_id is None:
        from app.public.exceptions import permission_denied

        raise permission_denied("Organization is required for queue depth")
    rows = ops_service.queues(db, organization_id=principal.organization_id)
    return envelope(rows, {"page": 1, "page_size": len(rows), "total": len(rows)})


@router.get("/logs")
def ops_logs(
    level: str | None = Query(default=None, max_length=10),
    source: str | None = Query(default=None, max_length=40),
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=50, ge=1, le=200),
    principal: Principal = Depends(require_permission("platform.read")),
    db: Session = Depends(get_db),
) -> dict:
    if principal.organization_id is None:
        return envelope([], {"page": 1, "page_size": 0, "total": 0})
    rows = ops_service.logs(
        db,
        organization_id=principal.organization_id,
        level=level,
        source=source,
        query_text=q,
        limit=limit,
    )
    return envelope(rows, {"page": 1, "page_size": limit, "total": len(rows)})


@router.get("/backups")
def list_backups(
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("platform.read")),
    db: Session = Depends(get_db),
) -> dict:
    if principal.organization_id is None:
        return envelope([], pagination.meta(0))
    rows, total = ops_service.list_backups(
        db, organization_id=principal.organization_id, pagination=pagination
    )
    return envelope([ops_service.serialize_backup(row) for row in rows], pagination.meta(total))


@router.post("/backups", status_code=201)
def trigger_backup(
    payload: BackupTrigger,
    request: Request,
    principal: Principal = Depends(require_permission("platform.config")),
    db: Session = Depends(get_db),
) -> dict:
    if principal.organization_id is None:
        from app.public.exceptions import permission_denied

        raise permission_denied("Organization is required to run a backup")
    run = ops_service.create_backup(
        db,
        organization_id=principal.organization_id,
        target=payload.target,
        requested_by=principal.user.id,
    )
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="ops.backup.trigger",
        resource_type="backup",
        resource_id=str(run.id),
        request_id=getattr(request.state, "request_id", None),
        details={"target": run.target, "status": run.status},
    )
    db.commit()
    db.refresh(run)
    return envelope(ops_service.serialize_backup(run))
