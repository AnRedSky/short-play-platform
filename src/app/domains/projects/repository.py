"""Project data access: rows, membership scoping and listings."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.projects.models import Project, ProjectMember, ProjectTransition


def get_project(db: Session, project_id: UUID) -> Project | None:
    return db.get(Project, project_id)


def get_project_for_update(db: Session, project_id: UUID) -> Project | None:
    """Row lock: serializes concurrent transitions for optimistic checking."""
    return db.scalar(
        select(Project).where(Project.id == project_id).with_for_update(of=Project)
    )


def find_transition(
    db: Session, project_id: UUID, idempotency_key: str
) -> ProjectTransition | None:
    return db.scalar(
        select(ProjectTransition).where(
            ProjectTransition.project_id == project_id,
            ProjectTransition.idempotency_key == idempotency_key,
        )
    )


def get_project_by_code(db: Session, organization_id: UUID, code: str) -> Project | None:
    return db.scalar(
        select(Project).where(Project.organization_id == organization_id, Project.code == code)
    )


def create_project_row(
    db: Session,
    *,
    organization_id: UUID,
    code: str,
    title: str,
    summary: str = "",
    owner_user_id: UUID | None = None,
    brief: dict | None = None,
) -> Project:
    brief = brief or {}
    project = Project(
        organization_id=organization_id,
        code=code,
        title=title,
        summary=summary,
        owner_user_id=owner_user_id,
        genre=brief.get("genre", ""),
        audience=brief.get("audience", ""),
        episodes=brief.get("episodes", 1),
        duration=brief.get("duration", ""),
        ratio=brief.get("ratio", ""),
        language=brief.get("language", ""),
        style=brief.get("style", ""),
        constraints=brief.get("constraints", ""),
        budget=brief.get("budget", 0),
        estimated=brief.get("estimated", 0),
    )
    db.add(project)
    db.flush()
    return project


def _scoped_query(organization_id: UUID, *, user_id: UUID | None, manage: bool):
    query = select(Project).where(Project.organization_id == organization_id)
    count_query = select(func.count(Project.id)).where(Project.organization_id == organization_id)
    if not manage and user_id is not None:
        member_conditions = (
            ProjectMember.user_id == user_id,
            ProjectMember.is_active.is_(True),
        )
        query = query.join(ProjectMember, ProjectMember.project_id == Project.id).where(
            *member_conditions
        )
        count_query = count_query.join(
            ProjectMember, ProjectMember.project_id == Project.id
        ).where(*member_conditions)
    return query, count_query


def list_projects(
    db: Session,
    organization_id: UUID,
    *,
    user_id: UUID | None,
    manage: bool,
    pagination: PaginationParams,
) -> tuple[list[Project], int]:
    query, count_query = _scoped_query(organization_id, user_id=user_id, manage=manage)
    rows = db.scalars(
        query.order_by(Project.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()
    total = int(db.scalar(count_query) or 0)
    return list(rows), total


def count_projects(
    db: Session, organization_id: UUID, *, user_id: UUID, manage: bool
) -> int:
    _, count_query = _scoped_query(organization_id, user_id=user_id, manage=manage)
    return int(db.scalar(count_query) or 0)


def list_accessible_project_ids(
    db: Session, organization_id: UUID, *, user_id: UUID, manage: bool
) -> list[UUID]:
    """Project ids the principal may read, reused by cross-project ledgers."""
    query = select(Project.id).where(Project.organization_id == organization_id)
    if not manage:
        query = query.join(ProjectMember, ProjectMember.project_id == Project.id).where(
            ProjectMember.user_id == user_id,
            ProjectMember.is_active.is_(True),
        )
    return list(db.scalars(query).all())


def list_members(db: Session, project_id: UUID) -> list[ProjectMember]:
    return list(
        db.scalars(
            select(ProjectMember)
            .where(ProjectMember.project_id == project_id)
            .order_by(ProjectMember.created_at)
        ).all()
    )


def find_member(db: Session, project_id: UUID, user_id: UUID) -> ProjectMember | None:
    return db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
        )
    )


def member_role(db: Session, project_id: UUID, user_id: UUID) -> str | None:
    return db.scalar(
        select(ProjectMember.project_role).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
            ProjectMember.is_active.is_(True),
        )
    )


def add_member_row(
    db: Session,
    *,
    project_id: UUID,
    user_id: UUID,
    project_role: str,
    granted_by: UUID | None = None,
    granted_at: datetime | None = None,
) -> ProjectMember:
    member = ProjectMember(
        project_id=project_id,
        user_id=user_id,
        project_role=project_role,
        granted_by=granted_by,
        granted_at=granted_at,
    )
    db.add(member)
    db.flush()
    return member


def list_owned_projects(db: Session, *, organization_id: UUID, user_id: UUID) -> list[Project]:
    return list(
        db.scalars(
            select(Project).where(
                Project.organization_id == organization_id,
                Project.owner_user_id == user_id,
            )
        ).all()
    )


def list_all_owned_projects_for_user(db: Session, user_id: UUID) -> list[Project]:
    return list(
        db.scalars(select(Project).where(Project.owner_user_id == user_id)).all()
    )


def list_authorizations_for_user(
    db: Session, *, organization_id: UUID, user_id: UUID
) -> list[tuple[ProjectMember, Project]]:
    rows = db.execute(
        select(ProjectMember, Project)
        .join(Project, Project.id == ProjectMember.project_id)
        .where(
            Project.organization_id == organization_id,
            ProjectMember.user_id == user_id,
        )
        .order_by(ProjectMember.created_at)
    ).all()
    return [(member, project) for member, project in rows]


def list_active_memberships(
    db: Session, *, organization_id: UUID, user_id: UUID
) -> list[ProjectMember]:
    return list(
        db.scalars(
            select(ProjectMember)
            .join(Project, Project.id == ProjectMember.project_id)
            .where(
                Project.organization_id == organization_id,
                ProjectMember.user_id == user_id,
                ProjectMember.is_active.is_(True),
            )
        ).all()
    )


def list_all_active_memberships_for_user(db: Session, user_id: UUID) -> list[ProjectMember]:
    return list(
        db.scalars(
            select(ProjectMember).where(
                ProjectMember.user_id == user_id,
                ProjectMember.is_active.is_(True),
            )
        ).all()
    )
