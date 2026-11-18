"""Authentication HTTP contract."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, get_principal
from app.dependencies.db import get_db
from app.domains.audit import service as audit_service
from app.domains.auth import service as auth_service
from app.domains.auth.schemas import (
    BootstrapRequest,
    LoginRequest,
    LogoutRequest,
    MeRead,
    RefreshRequest,
    UserRead,
)
from app.public.constants import USER_AGENT_HEADER
from app.public.exceptions import authentication_required
from app.public.schemas import envelope

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_payload(tokens: dict) -> dict:
    return {
        "access_token": tokens["access_token"],
        "token_type": tokens["token_type"],
        "expires_in": tokens["expires_in"],
        "refresh_token": tokens["refresh_token"],
        "user": UserRead.model_validate(tokens["user"]).model_dump(mode="json"),
    }


@router.post("/bootstrap")
def bootstrap(
    payload: BootstrapRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    user = auth_service.bootstrap_first_administrator(
        db,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        organization_name=payload.organization_name,
    )
    audit_service.record(
        db,
        actor_user_id=user.id,
        action="identity.bootstrap",
        resource_type="user",
        resource_id=str(user.id),
        request_id=getattr(request.state, "request_id", None),
    )
    db.commit()
    return envelope(UserRead.model_validate(user).model_dump(mode="json"))


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    request_id = getattr(request.state, "request_id", None)
    try:
        tokens = auth_service.authenticate(
            db,
            email=payload.email,
            password=payload.password,
            user_agent=request.headers.get(USER_AGENT_HEADER),
        )
    except Exception:
        db.rollback()
        audit_service.record(
            db,
            actor_user_id=None,
            action="identity.login",
            resource_type="user",
            result="failure",
            request_id=request_id,
            details={"email": payload.email.strip().lower()},
        )
        db.commit()
        raise
    audit_service.record(
        db,
        actor_user_id=tokens["user"].id,
        action="identity.login",
        resource_type="user",
        resource_id=str(tokens["user"].id),
        request_id=request_id,
    )
    db.commit()
    return envelope(_token_payload(tokens))


@router.post("/refresh")
def refresh(
    payload: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    tokens = auth_service.refresh(
        db,
        raw_refresh_token=payload.refresh_token,
        user_agent=request.headers.get(USER_AGENT_HEADER),
    )
    db.commit()
    return envelope(_token_payload(tokens))


@router.post("/logout")
def logout(
    payload: LogoutRequest,
    db: Session = Depends(get_db),
) -> dict:
    auth_service.revoke(db, raw_refresh_token=payload.refresh_token)
    db.commit()
    return envelope({"revoked": True})


@router.get("/me")
def me(principal: Principal = Depends(get_principal)) -> dict:
    if principal.user is None:
        raise authentication_required()
    return envelope(
        MeRead(
            user=UserRead.model_validate(principal.user),
            organization_id=principal.organization_id,
            permissions=sorted(principal.permissions),
        ).model_dump(mode="json")
    )


@router.post("/me/revoke-all")
def revoke_all(
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> dict:
    count = auth_service.revoke_all_for_user(db, principal.user.id)
    db.commit()
    return envelope({"revoked_sessions": count})
