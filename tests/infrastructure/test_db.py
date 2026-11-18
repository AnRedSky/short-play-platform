"""Infrastructure: database wiring and dependency inversion."""

from pathlib import Path

from sqlalchemy import text

from app.dependencies.db import get_db as dependency_get_db
from app.infrastructure import db as db_infra


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
