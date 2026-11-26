"""Organization and department HTTP contract."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, get_pagination
from app.domains.audit import service as audit_service
from app.domains.organizations import service as organizations_service
from app.domains.organizations.schemas import (
    DepartmentCreate,
    DepartmentRead,
    MemberRead,
    OrganizationRead,
)
from app.public.schemas import envelope

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("")
def list_organizations(
    principal: Principal = Depends(require_permission("org.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows = organizations_service.list_user_organizations(db, principal.user.id)
    payload = [
        OrganizationRead.model_validate(organization).model_dump(mode="json")
        for organization in rows
    ]
    return envelope(payload)


@router.get("/departments")
def list_departments(
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("org.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows, total = organizations_service.list_departments(
        db, principal.organization_id, pagination
    )
    return envelope(
        [DepartmentRead.model_validate(department).model_dump(mode="json") for department in rows],
        pagination.meta(total),
    )


@router.post("/departments", status_code=201)
def create_department(
    payload: DepartmentCreate,
    request: Request,
    principal: Principal = Depends(require_permission("org.manage")),
    db: Session = Depends(get_db),
) -> dict:
    department = organizations_service.create_department(
        db,
        organization_id=principal.organization_id,
        name=payload.name,
        parent_id=payload.parent_id,
    )
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
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("org.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows, total = organizations_service.list_members(db, principal.organization_id, pagination)
    return envelope(
        [MemberRead.model_validate(member).model_dump(mode="json") for member in rows],
        pagination.meta(total),
    )


@router.get("/{organization_id}")
def read_organization(
    organization_id: UUID,
    principal: Principal = Depends(require_permission("org.read")),
    db: Session = Depends(get_db),
) -> dict:
    organization = organizations_service.get_organization_for_member_or_404(
        db, organization_id, principal.user.id
    )
    return envelope(OrganizationRead.model_validate(organization).model_dump(mode="json"))
