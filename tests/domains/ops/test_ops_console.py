"""B-12 acceptance: real health, queue depth, log query and backup result."""

import uuid
from datetime import timedelta

from app.domains.generation.models import GenerationTask
from app.domains.ops import service as ops_service
from app.domains.organizations.models import Organization
from app.domains.projects.models import Project
from app.utils.datetime import utcnow


def _create_project(client, admin) -> dict:
    code = f"ops-{uuid.uuid4().hex[:6]}"
    response = client.post(
        "/api/v1/projects",
        headers=admin["headers"],
        json={"code": code, "title": f"Ops {code}", "summary": "ops test"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _create_failed_task(db_session, project: dict) -> GenerationTask:
    task = GenerationTask(
        id=uuid.uuid4(),
        project_id=uuid.UUID(project["record_id"]),
        capability="video.generate",
        provider_code="local-compatible",
        model_code="test-video",
        status="failed",
        idempotency_key=f"ops-{uuid.uuid4().hex}",
        request_payload={"prompt": "ops"},
        error_code="PROVIDER_TIMEOUT",
        error_message="provider timeout after 600s",
        attempt_count=2,
        finished_at=utcnow() - timedelta(minutes=5),
    )
    db_session.add(task)
    db_session.flush()
    return task


def test_health_and_overview_return_real_components(client, admin, db_session):
    health = client.get("/api/v1/ops/health", headers=admin["headers"])
    assert health.status_code == 200, health.text
    body = health.json()["data"]
    assert body["status"] in {"ok", "degraded"}
    names = {item["name"] for item in body["components"]}
    assert {"api", "postgresql", "redis", "worker", "storage"} <= names
    assert all("latency_ms" in item for item in body["components"])

    project = _create_project(client, admin)
    _create_failed_task(db_session, project)
    overview = client.get("/api/v1/ops/overview", headers=admin["headers"])
    assert overview.status_code == 200, overview.text
    data = overview.json()["data"]
    assert {"queues", "storage", "services", "providers", "incidents", "totals"} <= set(data)
    assert data["totals"]["failed_tasks"] >= 1
    assert any(row["type"] == "生成任务失败" for row in data["incidents"])
    assert data["storage"]["db"]
    assert data["storage"]["objects"].endswith("B") or "个" in data["storage"]["objects"]


def test_queue_depth_and_log_query_reflect_failed_task(client, admin, db_session):
    project = _create_project(client, admin)
    _create_failed_task(db_session, project)

    queues = client.get("/api/v1/ops/queues", headers=admin["headers"])
    assert queues.status_code == 200, queues.text
    rows = queues.json()["data"]
    video = next(row for row in rows if row["capability"] == "video.generate")
    assert video["failed"] == 1
    assert video["status"] == "告警"
    assert video["running"] == 0

    logs = client.get(
        "/api/v1/ops/logs", headers=admin["headers"], params={"level": "ERROR"}
    )
    assert logs.status_code == 200, logs.text
    data = logs.json()["data"]
    assert any("PROVIDER_TIMEOUT" in row["message"] for row in data)
    assert all(row["level"] == "ERROR" for row in data)

    filtered = client.get(
        "/api/v1/ops/logs", headers=admin["headers"], params={"q": project["id"]}
    )
    assert filtered.status_code == 200, filtered.text


def test_overview_does_not_leak_another_organization_task(
    client, admin, db_session
):
    project = _create_project(client, admin)
    own_task = _create_failed_task(db_session, project)

    foreign_org = Organization(
        id=uuid.uuid4(), name="Foreign Ops Org", slug=f"foreign-{uuid.uuid4().hex[:6]}"
    )
    foreign_project = Project(
        id=uuid.uuid4(),
        organization_id=foreign_org.id,
        code=f"foreign-{uuid.uuid4().hex[:6]}",
        title="Foreign Project",
    )
    foreign_task = GenerationTask(
        id=uuid.uuid4(),
        project_id=foreign_project.id,
        capability="video.generate",
        provider_code="local-compatible",
        model_code="test-video",
        status="failed",
        idempotency_key=f"foreign-{uuid.uuid4().hex}",
        request_payload={"prompt": "foreign"},
        error_code="FOREIGN_TIMEOUT",
        error_message="foreign task must not be visible",
        attempt_count=1,
        finished_at=utcnow(),
    )
    db_session.add_all([foreign_org, foreign_project])
    db_session.flush()
    db_session.add(foreign_task)
    db_session.flush()

    overview = client.get("/api/v1/ops/overview", headers=admin["headers"])
    assert overview.status_code == 200, overview.text
    data = overview.json()["data"]
    assert data["totals"]["failed_tasks"] == 1
    video = next(row for row in data["queues"] if row["capability"] == "video.generate")
    assert video["failed"] == 1
    incident_ids = {row["id"] for row in data["incidents"]}
    assert f"TASK-{str(own_task.id)[:8]}" in incident_ids
    assert f"TASK-{str(foreign_task.id)[:8]}" not in incident_ids

    logs = client.get(
        "/api/v1/ops/logs", headers=admin["headers"], params={"q": str(foreign_task.id)}
    )
    assert logs.status_code == 200, logs.text
    assert logs.json()["data"] == []


def test_backup_trigger_returns_verifiable_result(client, admin, monkeypatch, tmp_path):
    calls = []

    def fake_root():
        calls.append(True)
        return tmp_path

    monkeypatch.setattr(ops_service, "backup_root", fake_root)
    response = client.post(
        "/api/v1/ops/backups", headers=admin["headers"], json={"target": "database"}
    )
    assert response.status_code == 201, response.text
    data = response.json()["data"]
    assert calls
    assert data["status"] == "succeeded"
    assert data["size_bytes"] > 0
    assert len(data["checksum"]) == 64
    assert data["location"].endswith(".json")
    assert data["mode"] == "metadata_snapshot"
    assert data["target_label"] == "数据库全量"

    listed = client.get("/api/v1/ops/backups", headers=admin["headers"])
    assert listed.status_code == 200, listed.text
    assert listed.json()["meta"]["total"] >= 1
    assert listed.json()["data"][0]["verify"] == "sha256 已记录"
