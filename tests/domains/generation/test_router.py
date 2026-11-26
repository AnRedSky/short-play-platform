import uuid
from datetime import timedelta

from app.domains.generation import repository as generation_repo
from app.domains.generation.models import GenerationTask, UsageRecord
from app.utils.datetime import utcnow


def _project(client, admin) -> dict:
    response = client.post(
        "/api/v1/projects",
        headers=admin["headers"],
        json={"code": f"gen-{uuid.uuid4().hex[:6]}", "name": "Generation Pilot"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _create_task(client, admin, project_id, *, key=None, **overrides) -> tuple[dict, dict]:
    body = {
        "capability": "text_generation",
        "prompt": "Write a ten second cold open for a revenge drama.",
        "model_code": "mock-text-1",
        "provider_code": "mock",
    }
    body.update(overrides)
    headers = dict(admin["headers"])
    headers["Idempotency-Key"] = key or uuid.uuid4().hex
    response = client.post(
        f"/api/v1/projects/{project_id}/generation/tasks", headers=headers, json=body
    )
    return response, body


def _dispatch(client, admin, limit=10) -> dict:
    response = client.post(
        f"/api/v1/generation/queue/dispatch?limit={limit}", headers=admin["headers"]
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]


def _task_detail(client, admin, task_id) -> dict:
    response = client.get(f"/api/v1/generation/tasks/{task_id}", headers=admin["headers"])
    assert response.status_code == 200, response.text
    return response.json()["data"]


def _simulate_running(db_session, task_id, *, attempt_number=1, lease_seconds=300):
    task = db_session.get(GenerationTask, uuid.UUID(task_id))
    task.status = "running"
    task.attempt_count = attempt_number
    task.lease_expires_at = utcnow() + timedelta(seconds=lease_seconds)
    generation_repo.add_attempt_row(
        db_session,
        task_id=task.id,
        attempt_number=attempt_number,
        request_digest="test-digest",
        started_at=utcnow(),
    )
    db_session.commit()
    return task


def test_task_is_queued_then_dispatch_produces_attempt_and_usage(client, admin):
    project = _project(client, admin)
    response, body = _create_task(client, admin, project["record_id"])
    assert response.status_code == 201, response.text
    task = response.json()["data"]
    assert task["status"] == "queued"
    assert task["attempt_count"] == 0
    assert task["max_attempts"] == 3
    assert response.json()["meta"]["queued"] is True

    queued_detail = _task_detail(client, admin, task["id"])
    assert queued_detail["status"] == "queued"
    assert queued_detail["attempts"] == []

    dispatched = _dispatch(client, admin)
    assert dispatched["claimed"] == 1
    assert dispatched["tasks"][0]["id"] == task["id"]
    assert dispatched["tasks"][0]["status"] == "succeeded"

    detail = _task_detail(client, admin, task["id"])
    assert detail["result_payload"]["kind"] == "text"
    assert body["prompt"][:20] in detail["result_payload"]["text"]
    assert len(detail["attempts"]) == 1
    assert detail["attempts"][0]["attempt_number"] == 1
    assert detail["attempts"][0]["provider_task_id"].startswith("mock-")


def test_create_requires_idempotency_key(client, admin):
    project = _project(client, admin)
    response = client.post(
        f"/api/v1/projects/{project['record_id']}/generation/tasks",
        headers=admin["headers"],
        json={"capability": "text_generation", "prompt": "missing key"},
    )
    assert response.status_code == 422, response.text


def test_idempotency_key_prevents_duplicate_queue_entry(client, admin):
    project = _project(client, admin)
    key = uuid.uuid4().hex
    first, _ = _create_task(client, admin, project["record_id"], key=key)
    second, _ = _create_task(client, admin, project["record_id"], key=key)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["data"]["id"] == second.json()["data"]["id"]
    assert second.json()["meta"]["created"] is False

    _dispatch(client, admin)
    detail = _task_detail(client, admin, first.json()["data"]["id"])
    assert len(detail["attempts"]) == 1


def test_mock_image_generation_returns_placeholder_asset_metadata(client, admin):
    project = _project(client, admin)
    response, _ = _create_task(
        client,
        admin,
        project["record_id"],
        capability="image_generation",
        prompt="wide shot of a rainy harbor at night",
        parameters={"width": 1024, "height": 576},
    )
    assert response.status_code == 201, response.text
    task_id = response.json()["data"]["id"]
    _dispatch(client, admin)
    output = _task_detail(client, admin, task_id)["result_payload"]
    assert output["mime_type"] == "image/png"
    assert output["storage_key"].startswith("mock/image_generation/")
    assert output["placeholder"] is True


def test_provider_failure_returns_to_queue_until_attempt_budget_is_used(client, admin):
    project = _project(client, admin)
    response, _ = _create_task(
        client,
        admin,
        project["record_id"],
        provider_code="mock-failing",
        max_attempts=2,
    )
    assert response.status_code == 201
    task_id = response.json()["data"]["id"]

    first = _dispatch(client, admin)["tasks"][0]
    assert first["status"] == "retry_wait"
    assert first["attempt_count"] == 1
    assert first["error_code"] == "PROVIDER_UNAVAILABLE"

    retry = client.post(f"/api/v1/generation/tasks/{task_id}/retry", headers=admin["headers"])
    assert retry.status_code == 200, retry.text
    assert retry.json()["data"]["status"] == "queued"

    second = _dispatch(client, admin)["tasks"][0]
    assert second["status"] == "failed"
    assert second["attempt_count"] == 2

    exhausted = client.post(f"/api/v1/generation/tasks/{task_id}/retry", headers=admin["headers"])
    assert exhausted.status_code == 409
    assert exhausted.json()["error"]["details"]["code"] == "TASK_NOT_RETRYABLE"

    assert _dispatch(client, admin)["claimed"] == 0
    detail = _task_detail(client, admin, task_id)
    assert [row["status"] for row in detail["attempts"]] == ["failed", "failed"]

    inbox = client.get(
        "/api/v1/notifications",
        headers=admin["headers"],
        params={"type": "任务失败", "project": project["id"]},
    )
    assert inbox.status_code == 200, inbox.text
    notifications = inbox.json()["data"]
    assert len(notifications) == 1
    assert notifications[0]["link"] == f"tasks/list?project={project['id']}&task={task_id}"
    assert notifications[0]["reason"]


def test_pause_blocks_claim_and_resume_requeues(client, admin):
    project = _project(client, admin)
    task = _create_task(client, admin, project["record_id"])[0].json()["data"]

    paused = client.post(f"/api/v1/generation/tasks/{task['id']}/pause", headers=admin["headers"])
    assert paused.status_code == 200, paused.text
    assert paused.json()["data"]["status"] == "paused"

    assert _dispatch(client, admin)["claimed"] == 0
    assert _task_detail(client, admin, task["id"])["status"] == "paused"

    resumed = client.post(f"/api/v1/generation/tasks/{task['id']}/resume", headers=admin["headers"])
    assert resumed.status_code == 200
    assert resumed.json()["data"]["status"] == "queued"
    assert _dispatch(client, admin)["tasks"][0]["status"] == "succeeded"


def test_cancel_queued_task_prevents_dispatch(client, admin):
    project = _project(client, admin)
    task = _create_task(client, admin, project["record_id"])[0].json()["data"]
    cancelled = client.post(
        f"/api/v1/generation/tasks/{task['id']}/cancel", headers=admin["headers"]
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["data"]["status"] == "cancelled"
    assert _dispatch(client, admin)["claimed"] == 0


def test_cancel_on_terminal_task_is_rejected(client, admin):
    project = _project(client, admin)
    task = _create_task(client, admin, project["record_id"])[0].json()["data"]
    _dispatch(client, admin)
    cancel = client.post(f"/api/v1/generation/tasks/{task['id']}/cancel", headers=admin["headers"])
    assert cancel.status_code == 409
    assert cancel.json()["error"]["details"]["code"] == "TASK_NOT_RETRYABLE"


def test_callback_duplicate_and_out_of_order_are_idempotent(client, admin, db_session):
    project = _project(client, admin)
    task = _create_task(client, admin, project["record_id"])[0].json()["data"]
    _simulate_running(db_session, task["id"])

    accepted = client.post(
        "/api/v1/generation/providers/mock/callbacks",
        headers=admin["headers"],
        json={
            "callback_id": "accepted-1",
            "task_id": task["id"],
            "event": "accepted",
            "provider_task_id": "provider-9",
            "attempt_number": 1,
            "occurred_at": "2026-11-26T10:00:00+00:00",
        },
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["data"]["applied"] is True

    completed = client.post(
        "/api/v1/generation/providers/mock/callbacks",
        headers=admin["headers"],
        json={
            "callback_id": "completed-1",
            "task_id": task["id"],
            "event": "completed",
            "provider_task_id": "provider-9",
            "attempt_number": 1,
            "status": "succeeded",
            "output": {"kind": "text", "text": "callback result"},
            "usage": {"unit": "call", "quantity": 2, "source": "provider"},
            "occurred_at": "2026-11-26T10:01:00+00:00",
        },
    )
    assert completed.status_code == 200, completed.text
    body = completed.json()["data"]
    assert body["applied"] is True
    assert body["task"]["status"] == "succeeded"
    assert body["task"]["result_payload"]["text"] == "callback result"

    duplicate = client.post(
        "/api/v1/generation/providers/mock/callbacks",
        headers=admin["headers"],
        json={
            "callback_id": "completed-1",
            "task_id": task["id"],
            "event": "completed",
            "provider_task_id": "provider-9",
            "attempt_number": 1,
            "status": "failed",
            "error": {"code": "PROVIDER_TIMEOUT", "message": "late duplicate"},
            "occurred_at": "2026-11-26T10:05:00+00:00",
        },
    )
    assert duplicate.status_code == 200
    assert duplicate.json()["data"]["duplicate"] is True
    assert duplicate.json()["data"]["task"]["status"] == "succeeded"
    assert duplicate.json()["data"]["task"]["result_payload"]["text"] == "callback result"

    late = client.post(
        "/api/v1/generation/providers/mock/callbacks",
        headers=admin["headers"],
        json={
            "callback_id": "accepted-late",
            "task_id": task["id"],
            "event": "accepted",
            "provider_task_id": "provider-9",
            "attempt_number": 1,
            "occurred_at": "2026-11-26T09:59:00+00:00",
        },
    )
    assert late.status_code == 200
    assert late.json()["data"]["applied"] is False
    assert late.json()["data"]["reason"] == "STALE_CALLBACK"
    assert _task_detail(client, admin, task["id"])["status"] == "succeeded"

    late_complete = client.post(
        "/api/v1/generation/providers/mock/callbacks",
        headers=admin["headers"],
        json={
            "callback_id": "completed-stale",
            "task_id": task["id"],
            "event": "completed",
            "status": "failed",
            "error": {"code": "PROVIDER_UNAVAILABLE", "message": "stale"},
            "occurred_at": "2026-11-26T09:58:00+00:00",
        },
    )
    assert late_complete.status_code == 200
    assert late_complete.json()["data"]["applied"] is False
    assert late_complete.json()["data"]["reason"] == "STALE_CALLBACK"

    usage = db_session.query(UsageRecord).filter(UsageRecord.task_id == uuid.UUID(task["id"]))
    assert usage.count() == 1
    assert usage.one().quantity == 2


def test_callback_provider_mismatch_is_rejected(client, admin, db_session):
    project = _project(client, admin)
    task = _create_task(client, admin, project["record_id"], provider_code="mock")[0].json()["data"]
    _simulate_running(db_session, task["id"])
    response = client.post(
        "/api/v1/generation/providers/mock-failing/callbacks",
        headers=admin["headers"],
        json={
            "callback_id": "wrong-provider",
            "task_id": task["id"],
            "event": "completed",
            "status": "succeeded",
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_timeout_recovery_requeues_or_fails_by_budget(client, admin, db_session):
    project = _project(client, admin)
    task = _create_task(client, admin, project["record_id"], max_attempts=2)[0].json()["data"]
    _simulate_running(db_session, task["id"], lease_seconds=-1)

    recovered = client.post("/api/v1/generation/queue/recover", headers=admin["headers"])
    assert recovered.status_code == 200, recovered.text
    row = recovered.json()["data"]["tasks"][0]
    assert row["status"] == "retry_wait"
    assert row["error_code"] == "PROVIDER_TIMEOUT"
    detail = _task_detail(client, admin, task["id"])
    assert detail["attempts"][0]["status"] == "failed"
    assert detail["attempts"][0]["error_code"] == "PROVIDER_TIMEOUT"


def test_unsupported_capability_for_provider_is_rejected(client, admin):
    project = _project(client, admin)
    response, _ = _create_task(client, admin, project["record_id"], capability="asr")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_generation_is_denied_for_non_project_members(client, admin):
    project = _project(client, admin)

    role = client.post(
        "/api/v1/roles",
        headers=admin["headers"],
        json={"code": "reader", "name": "Reader", "permissions": ["project.read"]},
    ).json()["data"]
    email = f"reader-{uuid.uuid4().hex[:8]}@example.com"
    password = "MemberPassword1"
    created = client.post(
        "/api/v1/users",
        headers=admin["headers"],
        json={
            "email": email,
            "full_name": "Reader",
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
        f"/api/v1/projects/{project['record_id']}/generation/tasks",
        headers=headers,
        json={"capability": "text_generation", "prompt": "steal a script"},
    )
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"


def test_provider_health_endpoint(client, admin):
    response = client.get("/api/v1/models/providers", headers=admin["headers"])
    assert response.status_code == 200
    codes = [row["code"] for row in response.json()["data"]]
    assert codes == ["mock", "mock-failing"]


def test_generation_task_cannot_reference_shot_from_another_project(client, admin):
    project_a = _project(client, admin)
    project_b = _project(client, admin)
    episode = client.post(
        f"/api/v1/projects/{project_b['record_id']}/episodes",
        headers=admin["headers"],
        json={"episode_number": 1, "title": "Private episode"},
    ).json()["data"]
    storyboard = client.post(
        f"/api/v1/episodes/{episode['id']}/storyboards",
        headers=admin["headers"],
        json={"version_number": 1},
    ).json()["data"]
    shot = client.post(
        f"/api/v1/storyboards/{storyboard['id']}/shots",
        headers=admin["headers"],
        json={"shot_number": 1, "description": "Private shot"},
    ).json()["data"]

    role = client.post(
        "/api/v1/roles",
        headers=admin["headers"],
        json={
            "code": f"generation-member-{uuid.uuid4().hex[:8]}",
            "name": "Generation member",
            "permissions": ["project.read", "creation.write"],
        },
    ).json()["data"]
    email = f"generation-member-{uuid.uuid4().hex[:8]}@example.com"
    password = "MemberPassword1"
    user = client.post(
        "/api/v1/users",
        headers=admin["headers"],
        json={
            "email": email,
            "full_name": "Project A generator",
            "password": password,
            "role_ids": [role["id"]],
        },
    ).json()["data"]
    token = client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()[
        "data"
    ]["access_token"]
    member_headers = {
        "Authorization": f"Bearer {token}",
        "Idempotency-Key": uuid.uuid4().hex,
    }
    membership = client.post(
        f"/api/v1/projects/{project_a['record_id']}/members",
        headers=admin["headers"],
        json={"user_id": user["id"], "project_role": "artist"},
    )
    assert membership.status_code == 201, membership.text

    foreign_task_response, _ = _create_task(client, admin, project_b["record_id"])
    assert foreign_task_response.status_code == 201, foreign_task_response.text
    foreign_task_id = foreign_task_response.json()["data"]["id"]
    foreign_detail = client.get(
        f"/api/v1/generation/tasks/{foreign_task_id}", headers=member_headers
    )
    assert foreign_detail.status_code == 403
    foreign_cancel = client.post(
        f"/api/v1/generation/tasks/{foreign_task_id}/cancel", headers=member_headers
    )
    assert foreign_cancel.status_code == 403

    response = client.post(
        f"/api/v1/projects/{project_a['record_id']}/generation/tasks",
        headers=member_headers,
        json={
            "capability": "text_generation",
            "prompt": "Generate a scene using an unrelated shot",
            "provider_code": "mock",
            "model_code": "mock-text-1",
            "shot_id": shot["id"],
        },
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


def test_task_list_is_scoped_and_filterable(client, admin):
    project = _project(client, admin)
    first = _create_task(client, admin, project["record_id"])[0].json()["data"]
    second = _create_task(
        client, admin, project["record_id"], provider_code="mock-failing", max_attempts=1
    )[0].json()["data"]
    _dispatch(client, admin)

    retry_wait = client.get(
        f"/api/v1/projects/{project['record_id']}/generation/tasks?status=retry_wait",
        headers=admin["headers"],
    )
    assert retry_wait.status_code == 200, retry_wait.text
    assert retry_wait.json()["data"] == []

    succeeded = client.get(
        f"/api/v1/projects/{project['record_id']}/generation/tasks?status=succeeded",
        headers=admin["headers"],
    )
    assert succeeded.status_code == 200
    assert [row["id"] for row in succeeded.json()["data"]] == [first["id"]]
    assert second["status"] == "queued"
