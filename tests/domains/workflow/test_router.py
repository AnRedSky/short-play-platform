import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.domains.workflow import service as workflow_service
from app.infrastructure.providers.registry import build_registry


def _project(client, admin) -> dict:
    response = client.post(
        "/api/v1/projects",
        headers=admin["headers"],
        json={"code": f"wf-{uuid.uuid4().hex[:6]}", "title": "Workflow Pilot"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _start_run(client, admin, project_id, key: str | None = None) -> dict:
    headers = dict(admin["headers"])
    headers["Idempotency-Key"] = key or uuid.uuid4().hex
    response = client.post(f"/api/v1/projects/{project_id}/workflow-runs", headers=headers, json={})
    assert response.status_code == 201, response.text
    return response.json()


def test_default_workflow_definition_is_materialised(client, admin):
    project = _project(client, admin)
    response = client.get(f"/api/v1/projects/{project['id']}/workflows", headers=admin["headers"])
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["code"] == "episode-production"
    keys = [node["key"] for node in data["nodes"]]
    assert keys == ["script_draft", "shot_breakdown", "key_art"]
    assert data["nodes"][0]["depends_on"] == []
    assert data["nodes"][2]["depends_on"] == ["shot_breakdown"]


def test_starting_run_expands_nodes_and_writes_outbox(client, admin, db_session):
    project = _project(client, admin)
    response = _start_run(client, admin, project["id"])
    run = response["data"]
    assert response["meta"]["created"] is True
    assert run["status"] == "running"

    detail = client.get(f"/api/v1/workflow-runs/{run['id']}", headers=admin["headers"])
    assert detail.status_code == 200, detail.text
    nodes = detail.json()["data"]["nodes"]
    assert [node["node_key"] for node in nodes] == ["script_draft", "shot_breakdown", "key_art"]
    assert nodes[0]["status"] == "ready"
    assert nodes[1]["status"] == "pending"
    assert nodes[2]["status"] == "pending"

    dispatched = workflow_service.dispatch_outbox(db_session, send=lambda topic, payload: None)
    assert dispatched >= 1
    db_session.commit()


def test_run_idempotency_key_returns_same_run(client, admin):
    project = _project(client, admin)
    key = uuid.uuid4().hex
    first = _start_run(client, admin, project["id"], key)
    second = _start_run(client, admin, project["id"], key)
    assert first["data"]["id"] == second["data"]["id"]
    assert second["meta"]["created"] is False

    nodes_first = client.get(
        f"/api/v1/workflow-runs/{first['data']['id']}", headers=admin["headers"]
    ).json()["data"]["nodes"]
    assert len(nodes_first) == 3


def test_workflow_executes_each_node_to_completion(client, admin, db_session):
    project = _project(client, admin)
    run = _start_run(client, admin, project["id"])["data"]
    registry = build_registry()

    processed = []
    for _ in range(10):
        node = workflow_service.run_one_step(db_session, registry, uuid.UUID(run["id"]), "tester")
        db_session.commit()
        if node is None:
            break
        processed.append(node.node_key)

    assert processed == ["script_draft", "shot_breakdown", "key_art"]
    detail = client.get(f"/api/v1/workflow-runs/{run['id']}", headers=admin["headers"]).json()[
        "data"
    ]
    assert detail["status"] == "succeeded"
    assert all(node["status"] == "succeeded" for node in detail["nodes"])
    assert detail["nodes"][0]["output"]["kind"] == "generation"
    assert detail["nodes"][2]["output"]["result"]["mime_type"] == "image/png"


def test_failed_provider_keeps_node_retryable_then_fails_after_budget(client, admin, db_session):
    project = _project(client, admin)
    workflow, _version = workflow_service.get_or_create_workflow(
        db_session, uuid.UUID(project["id"])
    )
    definition = {
        "nodes": [
            {
                "key": "broken",
                "type": "generation",
                "depends_on": [],
                "payload": {
                    "capability": "text_generation",
                    "prompt": "this provider always fails",
                    "provider_code": "mock-failing",
                },
                "max_attempts": 2,
            }
        ]
    }
    version = workflow_service.add_workflow_version(db_session, workflow, definition)
    db_session.commit()

    run, _created = workflow_service.create_run(
        db_session,
        project_id=uuid.UUID(project["id"]),
        idempotency_key=uuid.uuid4().hex,
        triggered_by=None,
    )
    db_session.commit()

    registry = build_registry()
    node = workflow_service.claim_next_node(db_session, run.id, "tester")
    db_session.commit()
    assert node is not None
    workflow_service.execute_node_run(db_session, registry, node, worker_id="tester")
    db_session.commit()

    detail = client.get(f"/api/v1/workflow-runs/{run.id}", headers=admin["headers"]).json()["data"]
    assert detail["nodes"][0]["status"] == "retry_wait"
    assert detail["nodes"][0]["error_code"] == "PROVIDER_UNAVAILABLE"
    assert detail["status"] == "running"

    workflow_service.promote_retries(
        db_session, run.id, now=datetime.now(UTC) + timedelta(seconds=60)
    )
    db_session.commit()
    assert workflow_service.get_node(db_session, run.id, "broken").status == "ready"

    node = workflow_service.claim_next_node(db_session, run.id, "tester")
    db_session.commit()
    workflow_service.execute_node_run(db_session, registry, node, worker_id="tester")
    db_session.commit()

    detail = client.get(f"/api/v1/workflow-runs/{run.id}", headers=admin["headers"]).json()["data"]
    assert detail["nodes"][0]["status"] == "failed"
    assert detail["status"] == "failed"
    assert detail["error_code"] == "PROVIDER_UNAVAILABLE"
    assert version.version_number == 2


def test_orphaned_lease_is_recovered_without_false_success(client, admin, db_session):
    project = _project(client, admin)
    run = _start_run(client, admin, project["id"])["data"]
    run_id = uuid.UUID(run["id"])

    node = workflow_service.claim_next_node(db_session, run_id, "doomed-worker", lease_seconds=1)
    db_session.commit()
    assert node is not None
    node.lease_expires_at = datetime.now(UTC) - timedelta(seconds=30)
    db_session.commit()

    recovered = workflow_service.recover_orphans(db_session, run_id)
    db_session.commit()
    assert recovered == 1

    detail = client.get(f"/api/v1/workflow-runs/{run['id']}", headers=admin["headers"]).json()[
        "data"
    ]
    assert detail["nodes"][0]["status"] == "retry_wait"
    assert detail["nodes"][0]["error_code"] == "WORKER_LEASE_EXPIRED"
    assert detail["status"] == "running"

    # The reclaimed node resumes from its checkpoint on the next attempt.
    workflow_service.promote_retries(
        db_session, run_id, now=datetime.now(UTC) + timedelta(seconds=60)
    )
    db_session.commit()
    registry = build_registry()
    resumed = workflow_service.claim_next_node(db_session, run_id, "healthy-worker")
    db_session.commit()
    assert resumed.node_key == "script_draft"
    assert resumed.attempt_count == 2
    workflow_service.execute_node_run(db_session, registry, resumed, worker_id="healthy-worker")
    db_session.commit()
    assert workflow_service.get_node(db_session, run_id, "script_draft").status == "succeeded"


def test_recovery_endpoint_reports_counts(client, admin):
    project = _project(client, admin)
    run = _start_run(client, admin, project["id"])["data"]
    response = client.post(f"/api/v1/workflow-runs/{run['id']}/recover", headers=admin["headers"])
    assert response.status_code == 200, response.text
    assert response.json()["data"]["recovered"] == 0


def test_cancel_workflow_run(client, admin):
    project = _project(client, admin)
    run = _start_run(client, admin, project["id"])["data"]
    response = client.post(f"/api/v1/workflow-runs/{run['id']}/cancel", headers=admin["headers"])
    assert response.status_code == 200, response.text
    assert response.json()["data"]["status"] == "cancelled"

    detail = client.get(f"/api/v1/workflow-runs/{run['id']}", headers=admin["headers"]).json()[
        "data"
    ]
    assert all(node["status"] == "cancelled" for node in detail["nodes"])

    second = client.post(f"/api/v1/workflow-runs/{run['id']}/cancel", headers=admin["headers"])
    assert second.status_code == 409


def test_workflow_is_denied_for_non_project_members(client, admin):
    project = _project(client, admin)
    role = client.post(
        "/api/v1/roles",
        headers=admin["headers"],
        json={"code": "outsider", "name": "Outsider", "permissions": ["projects:read"]},
    ).json()["data"]
    email = f"outsider-{uuid.uuid4().hex[:8]}@example.com"
    password = "MemberPassword1"
    created = client.post(
        "/api/v1/users",
        headers=admin["headers"],
        json={
            "email": email,
            "full_name": "Outsider",
            "password": password,
            "role_ids": [role["id"]],
        },
    )
    assert created.status_code == 201, created.text
    token = client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()[
        "data"
    ]["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Idempotency-Key": uuid.uuid4().hex}

    denied = client.post(
        f"/api/v1/projects/{project['id']}/workflow-runs", headers=headers, json={}
    )
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.parametrize("attempt,expected_floor", [(1, 5), (2, 10), (3, 20)])
def test_backoff_grows(attempt, expected_floor):
    assert workflow_service.backoff_seconds(attempt) == expected_floor
