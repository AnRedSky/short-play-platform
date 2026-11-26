"""Organization data access."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.organizations.models import (
    Department,
    OffboardingRecord,
    Organization,
    OrganizationMember,
)


def get_organization(db: Session, organization_id: UUID) -> Organization | None:
    return db.get(Organization, organization_id)


def is_active_member(db: Session, organization_id: UUID, user_id: UUID) -> bool:
    return db.scalar(
        select(OrganizationMember.id).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.is_active.is_(True),
        )
    ) is not None


def list_organizations_for_user(db: Session, user_id: UUID) -> list[Organization]:
    return list(
        db.scalars(
            select(Organization)
            .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
            .where(
                OrganizationMember.user_id == user_id,
                OrganizationMember.is_active.is_(True),
            )
            .order_by(Organization.created_at)
        ).all()
    )


def list_organizations(db: Session, *, limit: int | None = None) -> list[Organization]:
    statement = select(Organization).order_by(Organization.created_at)
    if limit is not None:
        statement = statement.limit(limit)
    return list(db.scalars(statement).all())


def create_organization(db: Session, *, name: str, slug: str) -> Organization:
    organization = Organization(name=name, slug=slug)
    db.add(organization)
    db.flush()
    return organization


def get_department(db: Session, department_id: UUID) -> Department | None:
    return db.get(Department, department_id)


def find_department_by_name(db: Session, organization_id: UUID, name: str) -> Department | None:
    return db.scalar(
        select(Department).where(
            Department.organization_id == organization_id, Department.name == name
        )
    )


def list_departments(
    db: Session,
    organization_id: UUID,
    pagination: PaginationParams,
    *,
    include_inactive: bool = False,
) -> tuple[list[Department], int]:
    conditions = [Department.organization_id == organization_id]
    if not include_inactive:
        conditions.append(Department.is_active.is_(True))
    rows = db.scalars(
        select(Department)
        .where(*conditions)
        .order_by(Department.name)
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()
    total = int(
        db.scalar(select(func.count(Department.id)).where(*conditions))
        or 0
    )
    return list(rows), total


def create_department_row(
    db: Session,
    *,
    organization_id: UUID,
    name: str,
    parent_id: UUID | None,
    manager_user_id: UUID | None = None,
) -> Department:
    department = Department(
        organization_id=organization_id,
        name=name,
        parent_id=parent_id,
        manager_user_id=manager_user_id,
    )
    db.add(department)
    db.flush()
    return department


def list_members(
    db: Session,
    organization_id: UUID,
    pagination: PaginationParams,
    *,
    department_id: UUID | None = None,
    include_inactive: bool = True,
) -> tuple[list[OrganizationMember], int]:
    conditions = [OrganizationMember.organization_id == organization_id]
    if department_id is not None:
        conditions.append(OrganizationMember.department_id == department_id)
    if not include_inactive:
        conditions.append(OrganizationMember.is_active.is_(True))
    rows = db.scalars(
        select(OrganizationMember)
        .where(*conditions)
        .order_by(OrganizationMember.created_at)
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()
    total = int(
        db.scalar(select(func.count(OrganizationMember.id)).where(*conditions)) or 0
    )
    return list(rows), total


def add_member(
    db: Session,
    *,
    organization_id: UUID,
    user_id: UUID,
    department_id: UUID | None = None,
) -> OrganizationMember:
    member = OrganizationMember(
        organization_id=organization_id, user_id=user_id, department_id=department_id
    )
    db.add(member)
    db.flush()
    return member


def primary_membership(db: Session, user_id: UUID) -> OrganizationMember | None:
    return db.scalar(
        select(OrganizationMember)
        .where(OrganizationMember.user_id == user_id, OrganizationMember.is_active.is_(True))
        .order_by(OrganizationMember.created_at)
    )


def primary_organization_id(db: Session, user_id: UUID) -> UUID | None:
    membership = primary_membership(db, user_id)
    return membership.organization_id if membership else None


def has_active_membership(db: Session, user_id: UUID) -> bool:
    return primary_membership(db, user_id) is not None


def count_other_active_memberships(
    db: Session, *, user_id: UUID, organization_id: UUID
) -> int:
    return int(
        db.scalar(
            select(func.count(OrganizationMember.id)).where(
                OrganizationMember.user_id == user_id,
                OrganizationMember.organization_id != organization_id,
                OrganizationMember.is_active.is_(True),
            )
        )
        or 0
    )


def list_active_memberships_for_user(db: Session, user_id: UUID) -> list[OrganizationMember]:
    return list(
        db.scalars(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user_id,
                OrganizationMember.is_active.is_(True),
            )
        ).all()
    )


def find_membership(
    db: Session, *, organization_id: UUID, user_id: UUID
) -> OrganizationMember | None:
    return db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
        )
    )


def active_members_in_department(db: Session, *, department_id: UUID) -> int:
    return int(
        db.scalar(
            select(func.count(OrganizationMember.id)).where(
                OrganizationMember.department_id == department_id,
                OrganizationMember.is_active.is_(True),
            )
        )
        or 0
    )


def list_child_department_ids(db: Session, *, department_id: UUID) -> list[UUID]:
    return list(
        db.scalars(
            select(Department.id).where(
                Department.parent_id == department_id, Department.is_active.is_(True)
            )
        ).all()
    )


def find_offboarding(
    db: Session, *, organization_id: UUID, user_id: UUID
) -> OffboardingRecord | None:
    return db.scalar(
        select(OffboardingRecord).where(
            OffboardingRecord.organization_id == organization_id,
            OffboardingRecord.user_id == user_id,
        )
    )


def list_offboarding(
    db: Session, organization_id: UUID, pagination: PaginationParams
) -> tuple[list[OffboardingRecord], int]:
    rows = db.scalars(
        select(OffboardingRecord)
        .where(OffboardingRecord.organization_id == organization_id)
        .order_by(OffboardingRecord.completed_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()
    total = int(
        db.scalar(
            select(func.count(OffboardingRecord.id)).where(
                OffboardingRecord.organization_id == organization_id
            )
        )
        or 0
    )
    return list(rows), total
