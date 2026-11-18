"""Project HTTP contract."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
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
    ProjectRead,
    ProjectUpdate,
)
from app.public.schemas import envelope

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
def list_projects(
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("projects:read")),
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
        [ProjectRead.model_validate(project).model_dump(mode="json") for project in rows],
        pagination.meta(total),
    )


@router.post("", status_code=201)
def create_project(
    payload: ProjectCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:write")),
    db: Session = Depends(get_db),
) -> dict:
    project = projects_service.create_project(
        db,
        organization_id=principal.organization_id,
        code=payload.code,
        title=payload.title,
        summary=payload.summary,
        owner_user_id=principal.user.id,
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
    return envelope(ProjectRead.model_validate(project).model_dump(mode="json"))


@router.get("/{project_id}")
def read_project(
    project_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
    )
    return envelope(ProjectRead.model_validate(project).model_dump(mode="json"))


@router.patch("/{project_id}")
def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="projects:write",
    )
    changes = payload.model_dump(exclude_none=True)
    projects_service.update_project(db, project, changes)
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="project.updated",
        resource_type="project",
        resource_id=str(project.id),
        request_id=getattr(request.state, "request_id", None),
        details=payload.model_dump(exclude_none=True, mode="json"),
    )
    db.commit()
    return envelope(ProjectRead.model_validate(project).model_dump(mode="json"))


@router.get("/{project_id}/members")
def list_project_members(
    project_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
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
    principal: Principal = Depends(require_permission("projects:manage")),
    db: Session = Depends(get_db),
) -> dict:
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
    )
    member = projects_service.add_member(
        db,
        project_id=project.id,
        organization_id=project.organization_id,
        user_id=payload.user_id,
        project_role=payload.project_role
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
