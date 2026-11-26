"""B-07 quality report and rule HTTP contract."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, get_pagination
from app.domains.projects import repository as projects_repo
from app.domains.projects import service as projects_service
from app.domains.quality import repository as quality_repo
from app.domains.quality import service as quality_service
from app.domains.quality.constants import QUALITY_ENGINE, QUALITY_LEVELS
from app.domains.quality.schemas import QualityRunRequest
from app.public.exceptions import not_found
from app.public.schemas import envelope

router = APIRouter(tags=["quality"])

LEVEL_OBJECTS = {
    "资产级": "角色、场景、道具与成片资产",
    "镜头级": "单镜头首帧、口型与安全区",
    "单集级": "单集成片完整性、音画与字幕",
    "整剧级": "跨集连续性、总规格与合规终审",
}


def _accessible_ids(db: Session, principal: Principal) -> list[UUID]:
    return projects_repo.list_accessible_project_ids(
        db,
        principal.organization_id,
        user_id=principal.user.id,
        manage="project.manage" in principal.permissions,
    )


def _project_filter(db: Session, principal: Principal, project: str | None) -> UUID | None:
    if not project:
        return None
    try:
        project_id = UUID(project)
    except ValueError:
        row = projects_repo.get_project_by_code(db, principal.organization_id, project)
        if row is None:
            raise not_found("Project not found") from None
        project_id = row.id
    if project_id not in _accessible_ids(db, principal):
        raise not_found("Project not found")
    return project_id


@router.get("/quality-levels")
def quality_levels(
    principal: Principal = Depends(require_permission("quality.read")),
) -> dict:
    return envelope(
        [
            {"level": level, "object": LEVEL_OBJECTS[level], "engine": QUALITY_ENGINE}
            for level in QUALITY_LEVELS
        ]
    )


@router.get("/quality/rules")
def quality_rules(
    level: str | None = None,
    principal: Principal = Depends(require_permission("quality.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows = quality_repo.list_rules(db, level)
    return envelope([quality_service.serialize_rule(row) for row in rows], {"total": len(rows)})


@router.get("/quality-reports")
def list_reports(
    project: str | None = None,
    level: str | None = None,
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("quality.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows, total = quality_repo.list_reports(
        db,
        project_ids=_accessible_ids(db, principal),
        project_id=_project_filter(db, principal, project),
        level=level,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return envelope([quality_service.serialize_report(row) for row in rows], pagination.meta(total))


@router.get("/quality-issues")
def list_issues(
    report: str | None = None,
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("quality.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows, total = quality_repo.list_issues(
        db,
        project_ids=_accessible_ids(db, principal),
        report_code=report,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return envelope([quality_service.serialize_issue(row) for row in rows], pagination.meta(total))


@router.post("/projects/{project_id}/quality/runs", status_code=201)
def run_quality(
    project_id: UUID,
    payload: QualityRunRequest,
    principal: Principal = Depends(require_permission("quality.operate")),
    db: Session = Depends(get_db),
) -> dict:
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="quality.operate",
        for_update=True,
    )
    report = quality_service.run_quality(
        db,
        project=project,
        level=payload.level,
        version=payload.version,
        object_label=payload.object,
        checks=[check.model_dump() for check in payload.checks],
        note=payload.note,
        permissions=principal.permissions,
        actor_user_id=principal.user.id,
    )
    db.commit()
    db.refresh(report)
    return envelope(quality_service.serialize_report(report))
