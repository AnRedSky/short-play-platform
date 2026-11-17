from fastapi.testclient import TestClient

from apps.api.main import app
from apps.api.routes import health as health_routes

client = TestClient(app)


def test_health_endpoint_returns_ok() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_reports_ok_when_dependencies_respond(monkeypatch) -> None:
    monkeypatch.setattr(health_routes, "probe_postgresql", lambda: "ok")
    monkeypatch.setattr(health_routes, "probe_redis", lambda: "ok")

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "components": {"postgresql": "ok", "redis": "ok"},
    }


def test_readiness_reports_degraded_when_postgresql_unavailable(monkeypatch) -> None:
    monkeypatch.setattr(health_routes, "probe_postgresql", lambda: "unavailable")
    monkeypatch.setattr(health_routes, "probe_redis", lambda: "ok")

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "degraded",
        "components": {"postgresql": "unavailable", "redis": "ok"},
    }


def test_readiness_reports_degraded_when_redis_unavailable(monkeypatch) -> None:
    monkeypatch.setattr(health_routes, "probe_postgresql", lambda: "ok")
    monkeypatch.setattr(health_routes, "probe_redis", lambda: "unavailable")

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "degraded",
        "components": {"postgresql": "ok", "redis": "unavailable"},
    }
