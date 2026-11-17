from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.deps import Principal, require_permission
from apps.api.errors import conflict, not_found
from apps.api.models.access import Role
from apps.api.models.identity import OrganizationMember, User
from apps.api.schemas.common import envelope
from apps.api.schemas.identity import UserCreate, UserRead, UserUpdate
from apps.api.services import audit as audit_service
from apps.api.services.identity import assign_role, create_user, user_permissions

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
def list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    principal: Principal = Depends(require_permission("users:read")),
    db: Session = Depends(get_db),
) -> dict:
    organization_id = principal.organization_id
    query = (
        select(User)
        .join(OrganizationMember, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.organization_id == organization_id)
        .order_by(User.created_at, User.email)
    )
    total = int(
        db.scalar(
            select(func.count(User.id))
            .join(OrganizationMember, OrganizationMember.user_id == User.id)
            .where(OrganizationMember.organization_id == organization_id)
        )
        or 0
    )
    rows = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return envelope(
        [UserRead.model_validate(user).model_dump(mode="json") for user in rows],
        {"page": page, "page_size": page_size, "total": total},
    )


@router.post("", status_code=201)
def create_user_endpoint(
    payload: UserCreate,
    request: Request,
    principal: Principal = Depends(require_permission("users:write")),
    db: Session = Depends(get_db),
) -> dict:
    user = create_user(
        db,
        email=payload.email,
        full_name=payload.full_name,
        password=payload.password,
        organization_id=principal.organization_id,
        department_id=payload.department_id,
    )
    for role_id in payload.role_ids:
        role = db.get(Role, role_id)
        if role is None:
            raise not_found("Role not found")
        if role.organization_id != principal.organization_id:
            raise conflict("Role belongs to a different organization")
        assign_role(db, user_id=user.id, role_id=role_id)
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="user.created",
        resource_type="user",
        resource_id=str(user.id),
        request_id=getattr(request.state, "request_id", None),
        details={"email": user.email, "role_ids": [str(role_id) for role_id in payload.role_ids]},
    )
    db.commit()
    return envelope(UserRead.model_validate(user).model_dump(mode="json"))


@router.get("/{user_id}")
def get_user(
    user_id: str,
    principal: Principal = Depends(require_permission("users:read")),
    db: Session = Depends(get_db),
) -> dict:
    from uuid import UUID

    try:
        parsed = UUID(user_id)
    except ValueError:
        raise not_found("User not found") from None
    user = db.get(User, parsed)
    if user is None:
        raise not_found("User not found")
    return envelope(
        {
            **UserRead.model_validate(user).model_dump(mode="json"),
            "permissions": sorted(user_permissions(db, user.id)),
        }
    )


@router.patch("/{user_id}")
def update_user(
    user_id: str,
    payload: UserUpdate,
    request: Request,
    principal: Principal = Depends(require_permission("users:write")),
    db: Session = Depends(get_db),
) -> dict:
    from uuid import UUID

    try:
        parsed = UUID(user_id)
    except ValueError:
        raise not_found("User not found") from None
    user = db.get(User, parsed)
    if user is None:
        raise not_found("User not found")
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.flush()
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="user.updated",
        resource_type="user",
        resource_id=str(user.id),
        request_id=getattr(request.state, "request_id", None),
        details=payload.model_dump(exclude_none=True, mode="json"),
    )
    db.commit()
    return envelope(UserRead.model_validate(user).model_dump(mode="json"))
