from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.deps import Principal, require_permission
from apps.api.errors import conflict
from apps.api.models.project import Project, ProjectMember
from apps.api.schemas.common import envelope
from apps.api.schemas.project import (
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberRead,
    ProjectRead,
    ProjectUpdate,
)
from apps.api.services import audit as audit_service
from apps.api.services.projects import add_member, assert_project_access, get_project

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
def list_projects(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    query = select(Project).where(Project.organization_id == principal.organization_id)
    if "projects:manage" not in principal.permissions:
        query = query.join(ProjectMember, ProjectMember.project_id == Project.id).where(
            ProjectMember.user_id == principal.user.id, ProjectMember.is_active.is_(True)
        )
    rows = db.scalars(
        query.order_by(Project.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    from apps.api.services.projects import count_projects

    total = count_projects(
        db,
        principal.organization_id,
        principal.user.id,
        manage="projects:manage" in principal.permissions,
    )
    return envelope(
        [ProjectRead.model_validate(project).model_dump(mode="json") for project in rows],
        {"page": page, "page_size": page_size, "total": total},
    )


@router.post("", status_code=201)
def create_project(
    payload: ProjectCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:write")),
    db: Session = Depends(get_db),
) -> dict:
    exists = db.scalar(
        select(Project).where(
            Project.organization_id == principal.organization_id, Project.code == payload.code
        )
    )
    if exists is not None:
        raise conflict("Project code already exists", {"code": payload.code})
    project = Project(
        organization_id=principal.organization_id,
        code=payload.code,
        title=payload.title,
        summary=payload.summary,
    )
    db.add(project)
    db.flush()
    # The creator is always an owner so the project is reachable without a second write.
    add_member(db, project_id=project.id, user_id=principal.user.id, project_role="owner")
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
    project = get_project(db, project_id)
    assert_project_access(db, project, user_id=principal.user.id, permissions=principal.permissions)
    return envelope(ProjectRead.model_validate(project).model_dump(mode="json"))


@router.patch("/{project_id}")
def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    project = get_project(db, project_id)
    assert_project_access(
        db,
        project,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="projects:write",
    )
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(project, field, value)
    db.flush()
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
    project = get_project(db, project_id)
    assert_project_access(db, project, user_id=principal.user.id, permissions=principal.permissions)
    rows = db.scalars(
        select(ProjectMember)
        .where(ProjectMember.project_id == project.id)
        .order_by(ProjectMember.created_at)
    ).all()
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
    project = get_project(db, project_id)
    assert_project_access(db, project, user_id=principal.user.id, permissions=principal.permissions)
    member = add_member(
        db,
        project_id=project.id,
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
