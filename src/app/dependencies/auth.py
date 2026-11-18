"""Authentication and authorization dependencies for the HTTP layer.

* ``get_current_user`` validates the bearer token and returns the ORM user.
* ``get_current_active_user`` is the "must still be active" variant used by
  every protected route.
* ``get_principal`` adds the organization scope and the permission set.
* ``require_permission(code)`` builds a guard for a single permission code.
"""

from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.domains.roles.service import permission_codes_for_user
from app.domains.users.models import User
from app.domains.users.repository import get_user_by_id
from app.public.constants import AUTHORIZATION_HEADER
from app.public.exceptions import authentication_required, permission_denied

CLAIMS_STATE_KEY = "access_token_claims"


@dataclass(frozen=True)
class Principal:
    """Authenticated request identity: user, organization scope and permissions."""

    user: User
    organization_id: UUID | None
    permissions: frozenset[str]


def _bearer_claims(request: Request) -> dict:
    header = request.headers.get(AUTHORIZATION_HEADER, "")
    scheme, _, credentials = header.partition(" ")
    if scheme.lower() != "bearer" or not credentials.strip():
        raise authentication_required()
    # Imported lazily: the token policy belongs to the auth domain, the dependency
    # only consumes it, which keeps the import graph one-directional.
    from app.domains.auth.tokens import decode_access_token

    try:
        claims = decode_access_token(credentials.strip())
        UUID(str(claims["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise authentication_required("Invalid or expired access token") from None
    return claims


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    claims = _bearer_claims(request)
    user = get_user_by_id(db, UUID(str(claims["sub"])))
    if user is None or not user.is_active:
        raise authentication_required("User is no longer active")
    setattr(request.state, CLAIMS_STATE_KEY, claims)

    organization_id = None
    if claims.get("org"):
        try:
            organization_id = UUID(str(claims["org"]))
        except ValueError:
            organization_id = None
    request.state.organization_id = organization_id
    return user


def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    """Routes that need an active account depend on this, not on the raw token."""
    return user


def get_principal(
    request: Request,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Principal:
    return Principal(
        user=user,
        organization_id=getattr(request.state, "organization_id", None),
        permissions=permission_codes_for_user(db, user.id),
    )


def require_permission(code: str):
    """Build a dependency enforcing one permission code."""

    def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if code not in principal.permissions:
            raise permission_denied(f"Permission '{code}' is required")
        return principal

    return dependency
