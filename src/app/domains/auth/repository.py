"""Auth session data access."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.domains.auth.models import AuthSession


def get_session_by_token_hash(db: Session, token_hash: str) -> AuthSession | None:
    return db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash))


def create_session_row(
    db: Session,
    *,
    user_id: UUID,
    token_hash: str,
    expires_at: datetime,
    user_agent: str | None,
) -> AuthSession:
    session = AuthSession(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        user_agent=user_agent,
    )
    db.add(session)
    db.flush()
    return session


def list_active_sessions(db: Session, user_id: UUID) -> list[AuthSession]:
    return list(
        db.scalars(
            select(AuthSession).where(
                AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None)
            )
        )
    )


def delete_expired_sessions(db: Session, *, before: datetime) -> int:
    result = db.execute(delete(AuthSession).where(AuthSession.expires_at < before))
    return int(result.rowcount or 0)
