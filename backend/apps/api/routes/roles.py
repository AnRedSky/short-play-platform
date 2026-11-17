from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.deps import Principal, require_permission
from apps.api.errors import not_found
from apps.api.models.access import Role
from apps.api.models.identity import User
from apps.api.schemas.access import RoleAssignment, RoleCreate, RoleDetailRead, RoleRead
from apps.api.schemas.common import envelope
from apps.api.services import audit as audit_service
from apps.api.services.identity import assign_role, create_role, role_permission_codes

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("")
def list_roles(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    principal: Principal = Depends(require_permission("roles:read")),
    db: Session = Depends(get_db),
) -> dict:
    organization_id = principal.organization_id
    rows = db.scalars(
        select(Role)
        .where(Role.organization_id == organization_id)
        .order_by(Role.code)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    total = int(
        db.scalar(select(func.count(Role.id)).where(Role.organization_id == organization_id)) or 0
    )
    return envelope(
        [RoleRead.model_validate(role).model_dump(mode="json") for role in rows],
        {"page": page, "page_size": page_size, "total": total},
    )


@router.post("", status_code=201)
def create_role_endpoint(
    payload: RoleCreate,
    request: Request,
    principal: Principal = Depends(require_permission("roles:write")),
    db: Session = Depends(get_db),
) -> dict:
    role = create_role(
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
            permissions=role_permission_codes(db, role.id),
        ).model_dump(mode="json")
    )


@router.get("/{role_id}")
def get_role(
    role_id: UUID,
    principal: Principal = Depends(require_permission("roles:read")),
    db: Session = Depends(get_db),
) -> dict:
    role = db.get(Role, role_id)
    if role is None or role.organization_id != principal.organization_id:
        raise not_found("Role not found")
    return envelope(
        RoleDetailRead(
            **RoleRead.model_validate(role).model_dump(),
            permissions=role_permission_codes(db, role.id),
        ).model_dump(mode="json")
    )


@router.post("/{role_id}/assignments")
def assign_role_endpoint(
    role_id: UUID,
    payload: RoleAssignment,
    request: Request,
    principal: Principal = Depends(require_permission("roles:write")),
    db: Session = Depends(get_db),
) -> dict:
    role = db.get(Role, role_id)
    if role is None or role.organization_id != principal.organization_id:
        raise not_found("Role not found")
    if db.get(User, payload.user_id) is None:
        raise not_found("User not found")
    assign_role(db, user_id=payload.user_id, role_id=role_id)
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
