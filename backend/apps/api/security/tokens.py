import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt

from apps.api.config import get_settings

ALGORITHM = "HS256"


def _settings() -> Any:
    return get_settings()


def create_access_token(
    *, user_id: UUID, organization_id: UUID | None, extra: dict[str, Any] | None = None
) -> tuple[str, int]:
    settings = _settings()
    ttl_seconds = settings.access_token_ttl_minutes * 60
    issued_at = datetime.now(UTC)
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
    settings = _settings()
    payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    if payload.get("typ") != "access":
        raise jwt.InvalidTokenError("unexpected token type")
    return payload


def new_refresh_token() -> tuple[str, str]:
    """Returns the opaque refresh token handed to the client and its stored hash."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def refresh_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(days=_settings().refresh_token_ttl_days)
