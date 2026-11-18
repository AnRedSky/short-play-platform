"""Organization business rules: structure, departments and members."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.organizations import repository as organizations_repo
from app.domains.organizations.models import (
    Department,
    Organization,
    OrganizationMember,
)
from app.public.exceptions import conflict, not_found
from app.utils.string import slugify


def get_organization_or_404(db: Session, organization_id: UUID) -> Organization:
    organization = organizations_repo.get_organization(db, organization_id)
    if organization is None:
        raise not_found("Organization not found")
    return organization


def get_organization_for_member_or_404(
    db: Session, organization_id: UUID, user_id: UUID
) -> Organization:
    organization = get_organization_or_404(db, organization_id)
    if not organizations_repo.is_active_member(db, organization_id, user_id):
        raise not_found("Organization not found")
    return organization


def create_organization(db: Session, *, name: str) -> Organization:
    return organizations_repo.create_organization(db, name=name, slug=slugify(name))


def list_user_organizations(db: Session, user_id: UUID) -> list[Organization]:
    return organizations_repo.list_organizations_for_user(db, user_id)


def list_departments(
    db: Session, organization_id: UUID, pagination: PaginationParams
) -> tuple[list[Department], int]:
    return organizations_repo.list_departments(db, organization_id, pagination)


def create_department(
    db: Session, *, organization_id: UUID, name: str, parent_id: UUID | None
) -> Department:
    if organizations_repo.find_department_by_name(db, organization_id, name) is not None:
        raise conflict("Department name already exists", {"name": name})
    if parent_id is not None:
        parent = organizations_repo.get_department(db, parent_id)
        if parent is None or parent.organization_id != organization_id:
            raise not_found("Parent department not found")
    return organizations_repo.create_department_row(
        db, organization_id=organization_id, name=name, parent_id=parent_id
    )


def list_members(
    db: Session, organization_id: UUID, pagination: PaginationParams
) -> tuple[list[OrganizationMember], int]:
    return organizations_repo.list_members(db, organization_id, pagination)


def add_member(
    db: Session, *, organization_id: UUID, user_id: UUID, department_id: UUID | None = None
) -> OrganizationMember:
    if department_id is not None:
        department = organizations_repo.get_department(db, department_id)
        if department is None or department.organization_id != organization_id:
            raise not_found("Department not found")
    return organizations_repo.add_member(
        db, organization_id=organization_id, user_id=user_id, department_id=department_id
    )


def primary_organization_id(db: Session, user_id: UUID) -> UUID | None:
    return organizations_repo.primary_organization_id(db, user_id)


def has_active_membership(db: Session, user_id: UUID) -> bool:
    return organizations_repo.has_active_membership(db, user_id)
