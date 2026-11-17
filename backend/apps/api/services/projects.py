from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from apps.api.errors import not_found, permission_denied
from apps.api.models.project import Project, ProjectMember


def get_project(db: Session, project_id: UUID) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise not_found("Project not found")
    return project


def is_project_member(db: Session, project_id: UUID, user_id: UUID) -> bool:
    return (
        db.scalar(
            select(ProjectMember.id).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
                ProjectMember.is_active.is_(True),
            )
        )
        is not None
    )


def project_role(db: Session, project_id: UUID, user_id: UUID) -> str | None:
    return db.scalar(
        select(ProjectMember.project_role).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
            ProjectMember.is_active.is_(True),
        )
    )


def assert_project_access(
    db: Session,
    project: Project,
    *,
    user_id: UUID,
    permissions: frozenset[str],
    permission_needed: str = "projects:read",
) -> None:
    """Server-side project authorization: membership, project role and IDOR guard."""
    if permission_needed not in permissions:
        raise permission_denied(f"Permission '{permission_needed}' is required")
    if "projects:manage" in permissions:
        return
    role = project_role(db, project.id, user_id)
    if role is None:
        # Missing membership is reported as 403 so project existence does not leak.
        raise permission_denied("You are not a member of this project")
    if permission_needed == "projects:write" and role not in ("owner", "producer", "writer"):
        raise permission_denied(f"Project role '{role}' cannot modify this project")


def add_member(db: Session, *, project_id: UUID, user_id: UUID, project_role: str) -> ProjectMember:
    existing = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
        )
    )
    if existing is not None:
        existing.project_role = project_role
        existing.is_active = True
        db.flush()
        return existing
    member = ProjectMember(project_id=project_id, user_id=user_id, project_role=project_role)
    db.add(member)
    db.flush()
    return member


def count_projects(db: Session, organization_id: UUID, user_id: UUID, *, manage: bool) -> int:
    query = select(func.count(Project.id)).where(Project.organization_id == organization_id)
    if not manage:
        query = query.join(ProjectMember, ProjectMember.project_id == Project.id).where(
            ProjectMember.user_id == user_id, ProjectMember.is_active.is_(True)
        )
    return int(db.scalar(query) or 0)
