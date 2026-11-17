from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.deps import Principal, require_permission
from apps.api.errors import conflict, not_found
from apps.api.models.identity import Department, Organization, OrganizationMember
from apps.api.schemas.common import envelope
from apps.api.schemas.identity import (
    DepartmentCreate,
    DepartmentRead,
    MemberRead,
    OrganizationRead,
)
from apps.api.services import audit as audit_service

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("")
def list_organizations(
    principal: Principal = Depends(require_permission("organizations:read")),
    db: Session = Depends(get_db),
) -> dict:
    rows = db.scalars(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
        .where(OrganizationMember.user_id == principal.user.id)
        .order_by(Organization.created_at)
    ).all()
    return envelope(
        [
            OrganizationRead.model_validate(organization).model_dump(mode="json")
            for organization in rows
        ]
    )


@router.get("/departments")
def list_departments(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    principal: Principal = Depends(require_permission("organizations:read")),
    db: Session = Depends(get_db),
) -> dict:
    organization_id = principal.organization_id
    rows = db.scalars(
        select(Department)
        .where(Department.organization_id == organization_id)
        .order_by(Department.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    total = int(
        db.scalar(
            select(func.count(Department.id)).where(Department.organization_id == organization_id)
        )
        or 0
    )
    return envelope(
        [DepartmentRead.model_validate(department).model_dump(mode="json") for department in rows],
        {"page": page, "page_size": page_size, "total": total},
    )


@router.post("/departments", status_code=201)
def create_department(
    payload: DepartmentCreate,
    request: Request,
    principal: Principal = Depends(require_permission("organizations:write")),
    db: Session = Depends(get_db),
) -> dict:
    organization_id = principal.organization_id
    if db.scalar(
        select(Department).where(
            Department.organization_id == organization_id, Department.name == payload.name
        )
    ):
        raise conflict("Department name already exists", {"name": payload.name})
    if payload.parent_id is not None and db.get(Department, payload.parent_id) is None:
        raise not_found("Parent department not found")
    department = Department(
        organization_id=organization_id, name=payload.name, parent_id=payload.parent_id
    )
    db.add(department)
    db.flush()
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="department.created",
        resource_type="department",
        resource_id=str(department.id),
        request_id=getattr(request.state, "request_id", None),
        details={"name": department.name},
    )
    db.commit()
    return envelope(DepartmentRead.model_validate(department).model_dump(mode="json"))


@router.get("/members")
def list_members(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    principal: Principal = Depends(require_permission("organizations:read")),
    db: Session = Depends(get_db),
) -> dict:
    organization_id = principal.organization_id
    rows = db.scalars(
        select(OrganizationMember)
        .where(OrganizationMember.organization_id == organization_id)
        .order_by(OrganizationMember.created_at)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    total = int(
        db.scalar(
            select(func.count(OrganizationMember.id)).where(
                OrganizationMember.organization_id == organization_id
            )
        )
        or 0
    )
    return envelope(
        [MemberRead.model_validate(member).model_dump(mode="json") for member in rows],
        {"page": page, "page_size": page_size, "total": total},
    )


@router.get("/{organization_id}")
def get_organization(
    organization_id: UUID,
    principal: Principal = Depends(require_permission("organizations:read")),
    db: Session = Depends(get_db),
) -> dict:
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise not_found("Organization not found")
    return envelope(OrganizationRead.model_validate(organization).model_dump(mode="json"))
