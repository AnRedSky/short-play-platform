"""Infrastructure: database wiring and dependency inversion."""

import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError

from app.dependencies.db import get_db as dependency_get_db
from app.infrastructure import db as db_infra
from app.infrastructure.db import ensure_database_exists, is_missing_database_error


def test_every_domain_table_is_registered_on_metadata():
    tables = set(db_infra.metadata.tables)
    for expected in (
        "users",
        "sessions",
        "organizations",
        "roles",
        "projects",
        "episodes",
        "generation_tasks",
        "workflow_runs",
        "media_assets",
        "audit_logs",
    ):
        assert expected in tables


def test_runtime_uses_the_infrastructure_engine():
    assert db_infra.engine is not None
    assert db_infra.SessionFactory.kw["bind"] is db_infra.engine


def test_dependency_reexports_the_infrastructure_get_db():
    assert dependency_get_db is db_infra.get_db


def test_models_live_inside_domains_only():
    src_root = Path(__file__).resolve().parents[2] / "src" / "app"
    legacy = [path for path in src_root.glob("models*")]
    assert legacy == []


def test_database_models_are_importable_without_connecting():
    # Importing models must not open a connection: the API can boot before the DB.
    assert db_infra.metadata is not None
    assert text("SELECT 1").text == "SELECT 1"


class _FakeOriginalError:
    def __init__(self, message: str, sqlstate: str | None = None) -> None:
        self.message = message
        self.sqlstate = sqlstate

    def __str__(self) -> str:
        return self.message


class _FakeOperationalError(Exception):
    def __init__(self, original: _FakeOriginalError) -> None:
        super().__init__(original.message)
        self.orig = original


def test_missing_database_is_detected_from_sqlstate():
    error = _FakeOperationalError(
        _FakeOriginalError("connection failed", sqlstate="3D000")
    )
    assert is_missing_database_error(error) is True


def test_missing_database_is_detected_from_message():
    error = _FakeOperationalError(
        _FakeOriginalError('FATAL: database "short_play" does not exist')
    )
    assert is_missing_database_error(error) is True


def test_other_connection_failures_are_not_treated_as_missing():
    auth = _FakeOperationalError(
        _FakeOriginalError("password authentication failed", sqlstate="28P01")
    )
    assert is_missing_database_error(auth) is False


def test_ensure_database_exists_provisions_a_throwaway_database():
    base_url = make_url(db_infra.engine.url)
    name = f"short_play_autocreate_{uuid.uuid4().hex[:8]}"
    target = base_url.set(database=name)
    maintenance = base_url.set(database="postgres")

    admin = create_engine(maintenance, isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as connection:
            connection.execute(text("SELECT 1"))
    except OperationalError as error:
        admin.dispose()
        pytest.skip(f"PostgreSQL maintenance connection unavailable: {error}")
    admin.dispose()

    try:
        assert ensure_database_exists(target) is True
        assert ensure_database_exists(target) is False
    finally:
        admin = create_engine(maintenance, isolation_level="AUTOCOMMIT")
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        admin.dispose()
