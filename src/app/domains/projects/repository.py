"""Project data access: rows, membership scoping and listings."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.projects.models import Project, ProjectMember


def get_project(db: Session, project_id: UUID) -> Project | None:
    return db.get(Project, project_id)


def get_project_by_code(db: Session, organization_id: UUID, code: str) -> Project | None:
    return db.scalar(
        select(Project).where(Project.organization_id == organization_id, Project.code == code)
    )


def create_project_row(
    db: Session, *, organization_id: UUID, code: str, title: str, summary: str = ""
) -> Project:
    project = Project(organization_id=organization_id, code=code, title=title, summary=summary)
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
    db: Session, *, project_id: UUID, user_id: UUID, project_role: str
) -> ProjectMember:
    member = ProjectMember(project_id=project_id, user_id=user_id, project_role=project_role)
    db.add(member)
    db.flush()
    return member
