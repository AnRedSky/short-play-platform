from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.errors import authentication_required, permission_denied
from apps.api.models.identity import User
from apps.api.security.tokens import decode_access_token
from apps.api.services.identity import user_permissions


@dataclass(frozen=True)
class Principal:
    user: User
    organization_id: UUID | None
    permissions: frozenset[str]


def get_principal(request: Request, db: Session = Depends(get_db)) -> Principal:
    header = request.headers.get("authorization", "")
    scheme, _, credentials = header.partition(" ")
    if scheme.lower() != "bearer" or not credentials.strip():
        raise authentication_required()
    try:
        payload = decode_access_token(credentials.strip())
        user_id = UUID(str(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise authentication_required("Invalid or expired access token") from None

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise authentication_required("User is no longer active")

    organization_id = None
    if payload.get("org"):
        try:
            organization_id = UUID(str(payload["org"]))
        except ValueError:
            organization_id = None
    return Principal(
        user=user,
        organization_id=organization_id,
        permissions=user_permissions(db, user.id),
    )


def require_permission(code: str):
    def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if code not in principal.permissions:
            raise permission_denied(f"Permission '{code}' is required")
        return principal

    return dependency
