"""Project business rules: access control, creation and membership."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.organizations import repository as organizations_repo
from app.domains.projects import repository as projects_repo
from app.domains.projects.constants import PROJECT_WRITE_ROLES
from app.domains.projects.models import Project, ProjectMember
from app.public.exceptions import conflict, not_found, permission_denied


def get_project_or_404(db: Session, project_id: UUID) -> Project:
    project = projects_repo.get_project(db, project_id)
    if project is None:
        raise not_found("Project not found")
    return project


def is_project_member(db: Session, project_id: UUID, user_id: UUID) -> bool:
    return projects_repo.member_role(db, project_id, user_id) is not None


def project_role(db: Session, project_id: UUID, user_id: UUID) -> str | None:
    return projects_repo.member_role(db, project_id, user_id)


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
    if permission_needed == "projects:write" and role not in PROJECT_WRITE_ROLES:
        raise permission_denied(f"Project role '{role}' cannot modify this project")


def get_accessible_project(
    db: Session,
    project_id: UUID,
    *,
    user_id: UUID,
    permissions: frozenset[str],
    permission_needed: str = "projects:read",
) -> Project:
    """Resolve a project and enforce access in one step for every entry point."""
    project = get_project_or_404(db, project_id)
    assert_project_access(
        db,
        project,
        user_id=user_id,
        permissions=permissions,
        permission_needed=permission_needed,
    )
    return project


def create_project(
    db: Session,
    *,
    organization_id: UUID,
    code: str,
    title: str,
    summary: str,
    owner_user_id: UUID | None,
) -> Project:
    if projects_repo.get_project_by_code(db, organization_id, code) is not None:
        raise conflict("Project code already exists", {"code": code})
    project = projects_repo.create_project_row(
        db, organization_id=organization_id, code=code, title=title, summary=summary
    )
    if owner_user_id is not None:
        # The creator is always an owner so the project is reachable without a second write.
        add_member(
            db,
            project_id=project.id,
            organization_id=organization_id,
            user_id=owner_user_id,
            project_role="owner",
        )
    return project


def update_project(db: Session, project: Project, changes: dict) -> Project:
    for field, value in changes.items():
        setattr(project, field, value)
    db.flush()
    return project


def list_projects(
    db: Session,
    *,
    organization_id: UUID,
    user_id: UUID,
    permissions: frozenset[str],
    pagination: PaginationParams,
) -> tuple[list[Project], int]:
    manage = "projects:manage" in permissions
    return projects_repo.list_projects(
        db, organization_id, user_id=user_id, manage=manage, pagination=pagination
    )


def list_members(db: Session, project_id: UUID) -> list[ProjectMember]:
    return projects_repo.list_members(db, project_id)


def add_member(
    db: Session, *, project_id: UUID, organization_id: UUID, user_id: UUID, project_role: str
) -> ProjectMember:
    if not organizations_repo.is_active_member(db, organization_id, user_id):
        raise not_found("User not found in this organization")
    existing = projects_repo.find_member(db, project_id, user_id)
    if existing is not None:
        existing.project_role = project_role
        existing.is_active = True
        db.flush()
        return existing
    return projects_repo.add_member_row(
        db, project_id=project_id, user_id=user_id, project_role=project_role
    )


def remove_member(db: Session, *, project_id: UUID, user_id: UUID) -> ProjectMember:
    member = projects_repo.find_member(db, project_id, user_id)
    if member is None or not member.is_active:
        raise not_found("Project member not found")
    if member.project_role == "owner":
        raise conflict("Project owner cannot be removed")
    member.is_active = False
    db.flush()
    return member
