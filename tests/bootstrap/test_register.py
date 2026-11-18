"""Bootstrap layer: assembly and the documented error envelope."""

from fastapi.testclient import TestClient

from app.config.settings import get_settings
from app.main import app


def test_root_endpoint_contract():
    with TestClient(app) as client:
        response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"name": get_settings().app_name, "status": "ok"}
    assert response.headers["x-request-id"]


def test_unknown_route_uses_the_error_envelope():
    with TestClient(app) as client:
        response = client.get("/api/v1/definitely-not-a-route")
    assert response.status_code == 404
    body = response.json()["error"]
    assert body["code"] == "RESOURCE_NOT_FOUND"
    assert body["request_id"]
    assert body["details"] == {}


def test_openapi_is_served_for_all_domains():
    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()
    paths = schema["paths"]
    for expected in ("/api/v1/auth/login", "/api/v1/users", "/api/v1/projects"):
        assert expected in paths
