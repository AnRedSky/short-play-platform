"""Project HTTP contract."""

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, get_pagination
from app.domains.audit import service as audit_service
from app.domains.projects import service as projects_service
from app.domains.projects.schemas import (
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberRead,
    ProjectUpdate,
    TransitionRequest,
)
from app.public.schemas import envelope

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
def list_projects(
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows, total = projects_service.list_projects(
        db,
        organization_id=principal.organization_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        pagination=pagination,
    )
    return envelope(
        [projects_service.serialize_project(project) for project in rows],
        pagination.meta(total),
    )


@router.post("", status_code=201)
def create_project(
    payload: ProjectCreate,
    request: Request,
    principal: Principal = Depends(require_permission("project.create")),
    db: Session = Depends(get_db),
) -> dict:
    project = projects_service.create_project(
        db,
        organization_id=principal.organization_id,
        code=payload.code,
        title=payload.resolved_title,
        summary=payload.summary,
        owner_user_id=principal.user.id,
        brief={
            "genre": payload.genre,
            "audience": payload.audience,
            "episodes": payload.episodes,
            "duration": payload.duration,
            "ratio": payload.ratio,
            "language": payload.language,
            "style": payload.style,
            "constraints": payload.constraints,
            "budget": payload.budget,
        },
    )
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="project.created",
        resource_type="project",
        resource_id=str(project.id),
        request_id=getattr(request.state, "request_id", None),
        details={"code": project.code},
    )
    db.commit()
    db.refresh(project)
    return envelope(projects_service.serialize_project(project))


@router.get("/{project_id}")
def read_project(
    project_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="project.read",
    )
    return envelope(projects_service.serialize_project(project))


@router.patch("/{project_id}")
def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    request: Request,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="project.manage",
    )
    changes = payload.changes()
    projects_service.update_project(db, project, changes)
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="project.updated",
        resource_type="project",
        resource_id=str(project.id),
        request_id=getattr(request.state, "request_id", None),
        details=changes,
    )
    db.commit()
    db.refresh(project)
    return envelope(projects_service.serialize_project(project))


@router.post("/{project_id}/transitions")
def transition_project(
    project_id: UUID,
    payload: TransitionRequest,
    request: Request,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=128),
) -> dict:
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="project.read",
        for_update=True,
    )

    if idempotency_key:
        replay = projects_service.replay_transition(
            db, project_id=project.id, idempotency_key=idempotency_key
        )
        if replay is not None:
            return envelope(replay.result_payload)

    result = projects_service.transition_project(
        db,
        project,
        action=payload.action,
        reason=payload.reason,
        expected_state=payload.expected_state,
        permissions=principal.permissions,
        actor_user_id=principal.user.id,
        request_id=getattr(request.state, "request_id", None),
        idempotency_key=idempotency_key,
    )
    db.commit()
    return envelope(result)


@router.get("/{project_id}/members")
def list_project_members(
    project_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="project.read",
    )
    rows = projects_service.list_members(db, project.id)
    return envelope(
        [ProjectMemberRead.model_validate(member).model_dump(mode="json") for member in rows]
    )


@router.post("/{project_id}/members", status_code=201)
def add_project_member(
    project_id: UUID,
    payload: ProjectMemberAdd,
    request: Request,
    principal: Principal = Depends(require_permission("project.manage")),
    db: Session = Depends(get_db),
) -> dict:
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="project.manage",
    )
    member = projects_service.add_member(
        db,
        project_id=project.id,
        organization_id=project.organization_id,
        user_id=payload.user_id,
        project_role=payload.project_role,
    )
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="project.member_added",
        resource_type="project",
        resource_id=str(project.id),
        request_id=getattr(request.state, "request_id", None),
        details={"user_id": str(payload.user_id), "project_role": payload.project_role},
    )
    db.commit()
    return envelope(ProjectMemberRead.model_validate(member).model_dump(mode="json"))


@router.delete("/{project_id}/members/{user_id}", status_code=204)
def remove_project_member(
    project_id: UUID,
    user_id: UUID,
    request: Request,
    principal: Principal = Depends(require_permission("project.manage")),
    db: Session = Depends(get_db),
) -> Response:
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="project.manage",
    )
    projects_service.remove_member(db, project_id=project.id, user_id=user_id)
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="project.member_removed",
        resource_type="project",
        resource_id=str(project.id),
        request_id=getattr(request.state, "request_id", None),
        details={"user_id": str(user_id)},
    )
    db.commit()
    return Response(status_code=204)
