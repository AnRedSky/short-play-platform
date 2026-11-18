"""Database engine, session factory, declarative base and the ``get_db`` dependency.

This module is the single source of truth for persistence wiring: every domain
imports ``Base`` from here, and ``dependencies.db`` re-exports ``get_db`` so the
HTTP layer never reaches into infrastructure directly.
"""

import logging
import re
from collections.abc import Generator, Iterator
from contextlib import contextmanager
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, create_engine, func, text
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import NullPool

from app.config.settings import get_settings

logger = logging.getLogger(__name__)

engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionFactory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

_SAFE_DATABASE_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


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
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - a probe reports state, it never raises
        return "unavailable"
    return "ok"


def is_missing_database_error(error: Exception) -> bool:
    """True when PostgreSQL rejected the connection because the database is absent."""
    original = getattr(error, "orig", None)
    if getattr(original, "sqlstate", None) == "3D000":  # invalid_catalog_name
        return True
    message = str(original or error).lower()
    return "database" in message and "does not exist" in message


def ensure_database_exists(database_url: str | URL | None = None) -> bool:
    """Create the target PostgreSQL database when it is missing.

    Returns ``True`` when the database had to be created. Any other connection
    failure (wrong host, bad credentials, database down) is re-raised untouched,
    so this only ever papers over the "database has not been provisioned yet"
    case — which is exactly what a first ``alembic upgrade head`` hits.
    """
    url = make_url(database_url or get_settings().database_url)
    if not url.drivername.startswith("postgresql"):
        return False

    probe = create_engine(url, poolclass=NullPool)
    try:
        with probe.connect() as connection:
            connection.execute(text("SELECT 1"))
        return False
    except OperationalError as error:
        if not is_missing_database_error(error):
            raise
    finally:
        probe.dispose()

    database = url.database or ""
    if not _SAFE_DATABASE_NAME.match(database):
        raise RuntimeError(f"refusing to create database with unsafe name {database!r}")

    admin = create_engine(
        url.set(database="postgres"),
        isolation_level="AUTOCOMMIT",
        poolclass=NullPool,
    )
    try:
        with admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{database}"'))
    finally:
        admin.dispose()

    logger.info("created missing PostgreSQL database %s", database)
    return True
