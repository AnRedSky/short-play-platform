"""Pure cryptographic helpers: password hashing and opaque token hashing."""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

_hasher = PasswordHasher()


def hash_password(raw_password: str) -> str:
    return _hasher.hash(raw_password)


def verify_password(raw_password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, raw_password)
    except (VerifyMismatchError, VerificationError):
        return False


def hash_token(raw: str) -> str:
    """SHA-256 of an opaque token; only the digest is persisted."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def new_refresh_token() -> tuple[str, str]:
    """Returns the opaque refresh token handed to the client and its stored hash."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_token(raw)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def checksum_of_text(value: str) -> str:
    return sha256_hex(value.encode("utf-8"))
