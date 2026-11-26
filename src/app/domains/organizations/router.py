"""Organization, department, member and offboarding HTTP contract."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, get_pagination
from app.domains.audit import service as audit_service
from app.domains.organizations import service as organizations_service
from app.domains.organizations.schemas import (
    DepartmentCreate,
    DepartmentRead,
    DepartmentUpdate,
    MemberDetailRead,
    MemberRead,
    MemberUpdate,
    OffboardingRead,
    OffboardingRequest,
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
    include_inactive: bool = Query(default=False),
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("org.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows, total = organizations_service.list_departments(
        db,
        principal.organization_id,
        pagination,
        include_inactive=include_inactive,
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
        manager_user_id=payload.manager_user_id,
    )
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="department.created",
        resource_type="department",
        resource_id=str(department.id),
        request_id=getattr(request.state, "request_id", None),
        details={
            "name": department.name,
            "parent_id": str(department.parent_id) if department.parent_id else None,
            "manager_user_id": (
                str(department.manager_user_id) if department.manager_user_id else None
            ),
        },
    )
    db.commit()
    return envelope(DepartmentRead.model_validate(department).model_dump(mode="json"))


@router.get("/departments/{department_id}")
def read_department(
    department_id: UUID,
    principal: Principal = Depends(require_permission("org.read")),
    db: Session = Depends(get_db),
) -> dict:
    department = organizations_service.get_department_or_404(
        db, organization_id=principal.organization_id, department_id=department_id
    )
    return envelope(DepartmentRead.model_validate(department).model_dump(mode="json"))


@router.patch("/departments/{department_id}")
def update_department(
    department_id: UUID,
    payload: DepartmentUpdate,
    request: Request,
    principal: Principal = Depends(require_permission("org.manage")),
    db: Session = Depends(get_db),
) -> dict:
    department = organizations_service.get_department_or_404(
        db, organization_id=principal.organization_id, department_id=department_id
    )
    changes = payload.changes()
    organizations_service.update_department(db, department=department, changes=changes)
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="department.updated",
        resource_type="department",
        resource_id=str(department.id),
        request_id=getattr(request.state, "request_id", None),
        details={key: str(value) if value is not None else None for key, value in changes.items()},
    )
    db.commit()
    return envelope(DepartmentRead.model_validate(department).model_dump(mode="json"))


@router.delete("/departments/{department_id}", status_code=204)
def delete_department(
    department_id: UUID,
    request: Request,
    principal: Principal = Depends(require_permission("org.manage")),
    db: Session = Depends(get_db),
) -> Response:
    department = organizations_service.get_department_or_404(
        db, organization_id=principal.organization_id, department_id=department_id
    )
    organizations_service.deactivate_department(db, department)
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="department.deactivated",
        resource_type="department",
        resource_id=str(department.id),
        request_id=getattr(request.state, "request_id", None),
        details={"name": department.name},
    )
    db.commit()
    return Response(status_code=204)


@router.get("/members")
def list_members(
    department_id: UUID | None = Query(default=None),
    include_inactive: bool = Query(default=True),
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("org.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows, total = organizations_service.list_members(
        db,
        principal.organization_id,
        pagination,
        department_id=department_id,
        include_inactive=include_inactive,
    )
    return envelope(
        [
            MemberRead(**organizations_service.serialize_member(db, member)).model_dump(
                mode="json"
            )
            for member in rows
        ],
        pagination.meta(total),
    )


@router.get("/members/{user_id}")
def read_member(
    user_id: UUID,
    principal: Principal = Depends(require_permission("org.read")),
    db: Session = Depends(get_db),
) -> dict:
    member = organizations_service.get_member_or_404(
        db, organization_id=principal.organization_id, user_id=user_id
    )
    return envelope(
        MemberDetailRead(**organizations_service.member_detail(db, member)).model_dump(mode="json")
    )


@router.patch("/members/{user_id}")
def update_member(
    user_id: UUID,
    payload: MemberUpdate,
    request: Request,
    principal: Principal = Depends(require_permission("org.manage")),
    db: Session = Depends(get_db),
) -> dict:
    member = organizations_service.get_member_or_404(
        db, organization_id=principal.organization_id, user_id=user_id
    )
    changes = payload.changes()
    if "department_id" in changes:
        organizations_service.update_member_department(
            db, member=member, department_id=changes["department_id"]
        )
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="organization.member_updated",
        resource_type="organization_member",
        resource_id=str(member.id),
        request_id=getattr(request.state, "request_id", None),
        details={"user_id": str(user_id), "department_id": str(changes.get("department_id"))},
    )
    db.commit()
    return envelope(
        MemberRead(**organizations_service.serialize_member(db, member)).model_dump(mode="json")
    )


@router.post("/members/{user_id}/offboard", status_code=201)
def offboard_member(
    user_id: UUID,
    payload: OffboardingRequest,
    request: Request,
    principal: Principal = Depends(require_permission("org.manage")),
    db: Session = Depends(get_db),
) -> dict:
    record = organizations_service.offboard_member(
        db,
        organization_id=principal.organization_id,
        user_id=user_id,
        handover_to_user_id=payload.handover_to_user_id,
        note=payload.note,
        actor_user_id=principal.user.id,
    )
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="organization.member_offboarded",
        resource_type="offboarding_record",
        resource_id=str(record.id),
        request_id=getattr(request.state, "request_id", None),
        details={
            "user_id": str(user_id),
            "handover_to_user_id": (
                str(record.handover_to_user_id) if record.handover_to_user_id else None
            ),
            "project_count": record.project_count,
            "roles_revoked": record.roles_revoked,
            "sessions_revoked": record.sessions_revoked,
        },
    )
    db.commit()
    return envelope(OffboardingRead.model_validate(record).model_dump(mode="json"))


@router.get("/offboarding")
def list_offboarding(
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("org.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows, total = organizations_service.list_offboarding(
        db, principal.organization_id, pagination
    )
    return envelope(
        [OffboardingRead.model_validate(record).model_dump(mode="json") for record in rows],
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
