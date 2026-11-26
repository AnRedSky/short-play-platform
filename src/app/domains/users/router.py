"""Users HTTP contract."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, get_pagination
from app.domains.audit import service as audit_service
from app.domains.users import service as users_service
from app.domains.users.dependencies import get_user_from_path
from app.domains.users.models import User
from app.domains.users.schemas import UserCreate, UserDetailRead, UserRead, UserUpdate
from app.public.schemas import envelope

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
def list_users(
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("org.read")),
    db: Session = Depends(get_db),
) -> dict:
    rows, total = users_service.list_users(db, principal.organization_id, pagination)
    return envelope(
        [UserRead.model_validate(user).model_dump(mode="json") for user in rows],
        pagination.meta(total),
    )


@router.post("", status_code=201)
def create_user(
    payload: UserCreate,
    request: Request,
    principal: Principal = Depends(require_permission("org.manage")),
    db: Session = Depends(get_db),
) -> dict:
    user = users_service.create_user(
        db,
        email=payload.email,
        full_name=payload.full_name,
        password=payload.password,
        organization_id=principal.organization_id,
        department_id=payload.department_id,
        role_ids=payload.role_ids,
    )
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
def read_user(
    user: User = Depends(get_user_from_path),
    principal: Principal = Depends(require_permission("org.read")),
    db: Session = Depends(get_db),
) -> dict:
    users_service.assert_user_in_organization(db, user, principal.organization_id)
    return envelope(
        UserDetailRead(
            **UserRead.model_validate(user).model_dump(),
            permissions=users_service.permissions_of(db, user.id, principal.organization_id),
        ).model_dump(mode="json")
    )


@router.patch("/{user_id}")
def update_user(
    payload: UserUpdate,
    request: Request,
    user: User = Depends(get_user_from_path),
    principal: Principal = Depends(require_permission("org.manage")),
    db: Session = Depends(get_db),
) -> dict:
    users_service.assert_user_in_organization(db, user, principal.organization_id)
    users_service.update_user(
        db, user, full_name=payload.full_name, is_active=payload.is_active
    )
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
