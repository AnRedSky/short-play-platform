from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

hasher = PasswordHasher()


def hash_password(raw_password: str) -> str:
    return hasher.hash(raw_password)


def verify_password(raw_password: str, password_hash: str) -> bool:
    try:
        return hasher.verify(password_hash, raw_password)
    except (VerifyMismatchError, VerificationError):
        return False
