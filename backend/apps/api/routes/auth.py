from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.deps import Principal, get_principal
from apps.api.errors import authentication_required
from apps.api.schemas.auth import (
    BootstrapRequest,
    LoginRequest,
    LogoutRequest,
    MeRead,
    RefreshRequest,
    UserRead,
)
from apps.api.schemas.common import envelope
from apps.api.services import audit as audit_service
from apps.api.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


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
    return envelope(UserRead.model_validate(user))


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    try:
        tokens = auth_service.authenticate(
            db,
            email=payload.email,
            password=payload.password,
            user_agent=request.headers.get("user-agent"),
        )
    except Exception:
        db.rollback()
        audit_service.record(
            db,
            actor_user_id=None,
            action="identity.login",
            resource_type="user",
            result="failure",
            request_id=getattr(request.state, "request_id", None),
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
        request_id=getattr(request.state, "request_id", None),
    )
    db.commit()
    return envelope(
        {
            "access_token": tokens["access_token"],
            "token_type": tokens["token_type"],
            "expires_in": tokens["expires_in"],
            "refresh_token": tokens["refresh_token"],
            "user": UserRead.model_validate(tokens["user"]).model_dump(mode="json"),
        }
    )


@router.post("/refresh")
def refresh(
    payload: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    tokens = auth_service.refresh(
        db, raw_refresh_token=payload.refresh_token, user_agent=request.headers.get("user-agent")
    )
    db.commit()
    return envelope(
        {
            "access_token": tokens["access_token"],
            "token_type": tokens["token_type"],
            "expires_in": tokens["expires_in"],
            "refresh_token": tokens["refresh_token"],
            "user": UserRead.model_validate(tokens["user"]).model_dump(mode="json"),
        }
    )


@router.post("/logout")
def logout(
    payload: LogoutRequest,
    db: Session = Depends(get_db),
) -> dict:
    auth_service.revoke(db, raw_refresh_token=payload.refresh_token)
    db.commit()
    return envelope({"revoked": True})


@router.get("/me")
def me(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> dict:
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
