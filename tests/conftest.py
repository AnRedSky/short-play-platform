import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config.settings import get_settings
from app.dependencies.db import get_db
from app.main import app


@pytest.fixture(scope="session")
def engine():
    database_url = get_settings().database_url
    created = create_engine(database_url, pool_pre_ping=True)
    try:
        with created.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:
        created.dispose()
        if os.environ.get("GITHUB_ACTIONS") == "true":
            raise
        pytest.skip(f"PostgreSQL is not reachable for integration tests: {exc}")
    yield created
    created.dispose()


@pytest.fixture()
def db_session(engine):
    connection = engine.connect()
    transaction = connection.begin()
    factory = sessionmaker(
        bind=connection,
        expire_on_commit=False,
        autoflush=False,
        join_transaction_mode="create_savepoint",
    )
    session = factory()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def admin(client):
    unique = uuid.uuid4().hex[:8]
    payload = {
        "email": f"admin-{unique}@example.com",
        "password": "CorrectHorseBattery1",
        "full_name": "Admin",
        "organization_name": f"Studio {unique}",
    }
    response = client.post("/api/v1/auth/bootstrap", json=payload)
    assert response.status_code == 200, response.text
    login = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login.status_code == 200, login.text
    tokens = login.json()["data"]
    me = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200, me.text
    return {
        "email": payload["email"],
        "password": payload["password"],
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "organization_id": me.json()["data"]["organization_id"],
        "headers": {"Authorization": f"Bearer {tokens['access_token']}"},
    }
