"""Roles and permissions HTTP contract."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, get_pagination
from app.domains.audit import service as audit_service
from app.domains.roles import service as roles_service
from app.domains.roles.schemas import RoleAssignment, RoleCreate, RoleDetailRead, RoleRead
from app.public.schemas import envelope

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("")
def list_roles(
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("grant.manage")),
    db: Session = Depends(get_db),
) -> dict:
    rows, total = roles_service.list_roles(db, principal.organization_id, pagination)
    return envelope(
        [RoleRead.model_validate(role).model_dump(mode="json") for role in rows],
        pagination.meta(total),
    )


@router.post("", status_code=201)
def create_role(
    payload: RoleCreate,
    request: Request,
    principal: Principal = Depends(require_permission("grant.manage")),
    db: Session = Depends(get_db),
) -> dict:
    role = roles_service.create_role(
        db,
        organization_id=principal.organization_id,
        code=payload.code,
        name=payload.name,
        description=payload.description,
        permission_codes=payload.permissions,
    )
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="role.created",
        resource_type="role",
        resource_id=str(role.id),
        request_id=getattr(request.state, "request_id", None),
        details={"code": role.code, "permissions": sorted(set(payload.permissions))},
    )
    db.commit()
    return envelope(
        RoleDetailRead(
            **RoleRead.model_validate(role).model_dump(),
            permissions=roles_service.role_permission_codes(db, role.id),
        ).model_dump(mode="json")
    )


@router.get("/{role_id}")
def read_role(
    role_id: UUID,
    principal: Principal = Depends(require_permission("grant.manage")),
    db: Session = Depends(get_db),
) -> dict:
    role = roles_service.get_role_in_organization(db, role_id, principal.organization_id)
    return envelope(
        RoleDetailRead(
            **RoleRead.model_validate(role).model_dump(),
            permissions=roles_service.role_permission_codes(db, role.id),
        ).model_dump(mode="json")
    )


@router.post("/{role_id}/assignments")
def assign_role(
    role_id: UUID,
    payload: RoleAssignment,
    request: Request,
    principal: Principal = Depends(require_permission("grant.manage")),
    db: Session = Depends(get_db),
) -> dict:
    role = roles_service.assign_role_to_user(
        db,
        role_id=role_id,
        organization_id=principal.organization_id,
        user_id=payload.user_id,
    )
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="role.assigned",
        resource_type="role",
        resource_id=str(role.id),
        request_id=getattr(request.state, "request_id", None),
        details={"user_id": str(payload.user_id), "role_code": role.code},
    )
    db.commit()
    return envelope({"role_id": str(role.id), "user_id": str(payload.user_id)})
