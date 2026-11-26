"""B-08 post-production and delivery HTTP contract."""

from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.domains.assets import service as assets_service
from app.domains.delivery import repository as delivery_repo
from app.domains.delivery import service as delivery_service
from app.domains.delivery.schemas import (
    DeliveryCreate,
    EpisodeOutputCreate,
    FinalReviewRequest,
    TimelineCreate,
)
from app.domains.projects import repository as projects_repo
from app.domains.projects import service as projects_service
from app.public.exceptions import not_found
from app.public.schemas import envelope

router = APIRouter(tags=["post-production"])


def _project(
    db: Session,
    principal: Principal,
    project_id: UUID,
    *,
    need: str = "project.read",
    for_update: bool = False,
):
    return projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed=need,
        for_update=for_update,
    )


@router.get("/projects/{project_id}/timelines")
def list_timelines(
    project_id: UUID,
    episode_number: int | None = None,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _project(db, principal, project_id)
    rows = delivery_repo.list_timelines(db, project_id, episode_number)
    return envelope(
        [delivery_service.serialize_timeline(row) for row in rows], {"total": len(rows)}
    )


@router.post("/projects/{project_id}/timelines", status_code=201)
def create_timeline(
    project_id: UUID,
    payload: TimelineCreate,
    principal: Principal = Depends(require_permission("post.write")),
    db: Session = Depends(get_db),
) -> dict:
    project = _project(db, principal, project_id, need="post.write", for_update=True)
    timeline = delivery_service.create_timeline(
        db, project=project, payload=payload, actor_user_id=principal.user.id
    )
    db.commit()
    db.refresh(timeline)
    return envelope(delivery_service.serialize_timeline(timeline))


@router.get("/timelines/{timeline_id}")
def read_timeline(
    timeline_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    timeline = delivery_service.require_timeline(db, timeline_id)
    _project(db, principal, timeline.project_id)
    return envelope(delivery_service.serialize_timeline(timeline))


@router.post("/timelines/{timeline_id}/freeze")
def freeze_timeline(
    timeline_id: UUID,
    principal: Principal = Depends(require_permission("post.write")),
    db: Session = Depends(get_db),
) -> dict:
    timeline = delivery_service.require_timeline(db, timeline_id)
    _project(db, principal, timeline.project_id, need="post.write", for_update=True)
    delivery_service.freeze_timeline(db, timeline=timeline, actor_user_id=principal.user.id)
    db.commit()
    db.refresh(timeline)
    return envelope(delivery_service.serialize_timeline(timeline))


@router.get("/projects/{project_id}/episode-outputs")
def list_outputs(
    project_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _project(db, principal, project_id)
    rows = delivery_repo.list_outputs(db, project_id)
    report = delivery_repo.latest_quality_report(db, project_id)
    quality = report.result if report is not None else None
    return envelope(
        [delivery_service.serialize_output(db, row, quality_result=quality) for row in rows],
        {"total": len(rows)},
    )


@router.post("/projects/{project_id}/episodes/{episode_number}/outputs", status_code=201)
def create_output(
    project_id: UUID,
    episode_number: int,
    payload: EpisodeOutputCreate,
    principal: Principal = Depends(require_permission("post.write")),
    db: Session = Depends(get_db),
) -> dict:
    project = _project(db, principal, project_id, need="post.write", for_update=True)
    timeline = delivery_service.require_timeline(db, payload.timeline_version_id)
    asset = assets_service.get_asset_or_404(db, payload.asset_id)
    output = delivery_service.create_output(
        db,
        project=project,
        episode_number=episode_number,
        timeline=timeline,
        asset=asset,
        note=payload.note,
        actor_user_id=principal.user.id,
    )
    db.commit()
    db.refresh(output)
    report = delivery_repo.latest_quality_report(db, project.id)
    return envelope(
        delivery_service.serialize_output(
            db, output, quality_result=report.result if report is not None else None
        )
    )


@router.get("/projects/{project_id}/reviews")
def list_reviews(
    project_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _project(db, principal, project_id)
    rows = delivery_repo.list_reviews(db, project_id)
    return envelope(
        [delivery_service.serialize_review(db, row) for row in rows], {"total": len(rows)}
    )


@router.post("/projects/{project_id}/reviews", status_code=201)
def create_review(
    project_id: UUID,
    payload: FinalReviewRequest,
    principal: Principal = Depends(require_permission("final.review")),
    db: Session = Depends(get_db),
) -> dict:
    project = _project(db, principal, project_id, need="final.review", for_update=True)
    review = delivery_service.create_final_review(
        db,
        project=project,
        payload=payload,
        permissions=principal.permissions,
        actor_user_id=principal.user.id,
    )
    db.commit()
    db.refresh(review)
    return envelope(delivery_service.serialize_review(db, review))


@router.get("/projects/{project_id}/delivery-checklist")
def delivery_checklist(
    project_id: UUID,
    principal: Principal = Depends(require_permission("delivery.read")),
    db: Session = Depends(get_db),
) -> dict:
    project = _project(db, principal, project_id, need="delivery.read")
    rows = delivery_service.delivery_checklist(db, project)
    return envelope(
        rows,
        {
            "total": len(rows),
            "ready": all(
                not row["required"] or row["status"] == "已就绪" for row in rows
            ),
        },
    )


def _accessible_project_ids(db: Session, principal: Principal) -> list[UUID]:
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
    if project_id not in _accessible_project_ids(db, principal):
        raise not_found("Project not found")
    return project_id


@router.get("/deliveries")
def list_deliveries(
    project: str | None = None,
    principal: Principal = Depends(require_permission("delivery.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows = delivery_repo.list_packages(
        db,
        _accessible_project_ids(db, principal),
        project_id=_project_filter(db, principal, project),
    )
    return envelope(
        [delivery_service.serialize_package(db, row) for row in rows], {"total": len(rows)}
    )


@router.post("/projects/{project_id}/deliveries", status_code=201)
def create_delivery(
    project_id: UUID,
    payload: DeliveryCreate,
    principal: Principal = Depends(require_permission("delivery.execute")),
    db: Session = Depends(get_db),
) -> dict:
    project = _project(db, principal, project_id, need="delivery.execute", for_update=True)
    package = delivery_service.create_delivery(
        db,
        project=project,
        payload=payload,
        permissions=principal.permissions,
        actor_user_id=principal.user.id,
    )
    db.commit()
    db.refresh(package)
    return envelope(delivery_service.serialize_package(db, package))


@router.get("/deliveries/{package_id}")
def read_delivery(
    package_id: UUID,
    principal: Principal = Depends(require_permission("delivery.read")),
    db: Session = Depends(get_db),
) -> dict:
    package = delivery_service.require_package(db, package_id)
    _project(db, principal, package.project_id, need="delivery.read")
    return envelope(delivery_service.serialize_package(db, package))


@router.get("/deliveries/{package_id}/download")
def download_delivery(
    package_id: UUID,
    principal: Principal = Depends(require_permission("delivery.read")),
    db: Session = Depends(get_db),
) -> FileResponse:
    package = delivery_service.require_package(db, package_id)
    _project(db, principal, package.project_id, need="delivery.read")
    path = delivery_service.verify_package_file(package)
    return FileResponse(
        path=path,
        media_type="application/zip",
        filename=f"{package.code}.zip",
    )
