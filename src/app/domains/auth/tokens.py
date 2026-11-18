"""JWT access-token policy owned by the auth domain."""

from datetime import timedelta
from typing import Any
from uuid import UUID

import jwt

from app.config.settings import get_settings
from app.utils.datetime import utcnow

ALGORITHM = "HS256"


def create_access_token(
    *, user_id: UUID, organization_id: UUID | None, extra: dict[str, Any] | None = None
) -> tuple[str, int]:
    """Return ``(access_token, expires_in_seconds)``."""
    settings = get_settings()
    ttl_seconds = settings.access_token_ttl_minutes * 60
    issued_at = utcnow()
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "org": str(organization_id) if organization_id else None,
        "iat": int(issued_at.timestamp()),
        "exp": int((issued_at + timedelta(seconds=ttl_seconds)).timestamp()),
        "typ": "access",
    }
    if extra:
        payload.update(extra)
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    return token, ttl_seconds


def decode_access_token(token: str) -> dict[str, Any]:
    """Raises jwt exceptions for invalid, expired or wrongly typed tokens."""
    settings = get_settings()
    payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    if payload.get("typ") != "access":
        raise jwt.InvalidTokenError("unexpected token type")
    return payload


def refresh_expiry():
    """Absolute expiry of a refresh token, derived from the configured TTL."""
    return utcnow() + timedelta(days=get_settings().refresh_token_ttl_days)
