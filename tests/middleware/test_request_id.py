"""Middleware behaviour: request id propagation and access logging."""

import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.logging import StructuredLoggingMiddleware
from app.middleware.request_id import RequestIdMiddleware


def _client() -> TestClient:
    app = FastAPI()

    @app.get("/ping")
    async def ping() -> dict[str, str]:
        return {"status": "ok"}

    app.add_middleware(StructuredLoggingMiddleware)
    app.add_middleware(RequestIdMiddleware)
    return TestClient(app)


def test_generates_request_id_when_absent():
    response = _client().get("/ping")
    assert response.status_code == 200
    assert response.headers["x-request-id"]


def test_preserves_incoming_request_id():
    response = _client().get("/ping", headers={"x-request-id": "trace-123"})
    assert response.headers["x-request-id"] == "trace-123"


def test_request_id_is_visible_to_handlers(caplog):
    caplog.set_level(logging.INFO, logger="app.access")
    _client().get("/ping", headers={"x-request-id": "trace-456"})
    assert any("trace-456" in record.getMessage() for record in caplog.records)
