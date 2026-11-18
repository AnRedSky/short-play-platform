"""Database engine, session factory, declarative base and the ``get_db`` dependency.

This module is the single source of truth for persistence wiring: every domain
imports ``Base`` from here, and ``dependencies.db`` re-exports ``get_db`` so the
HTTP layer never reaches into infrastructure directly.
"""

from collections.abc import Generator, Iterator
from contextlib import contextmanager
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, create_engine, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.config.settings import get_settings

engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionFactory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Declarative base shared by every domain module."""


metadata = Base.metadata


class UUIDPrimaryKeyMixin:
    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding one request-scoped session."""
    db = SessionFactory()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional session for Celery tasks and scripts."""
    db = SessionFactory()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_connection() -> str:
    """Readiness probe for PostgreSQL: ``ok`` or ``unavailable``."""
    from sqlalchemy import text

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - a probe reports state, it never raises
        return "unavailable"
    return "ok"
