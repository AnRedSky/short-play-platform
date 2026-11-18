import uuid


def _project(client, admin) -> dict:
    response = client.post(
        "/api/v1/projects",
        headers=admin["headers"],
        json={"code": f"gen-{uuid.uuid4().hex[:6]}", "title": "Generation Pilot"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _create_task(client, admin, project_id, **overrides) -> tuple[dict, dict]:
    body = {
        "capability": "text_generation",
        "prompt": "Write a ten second cold open for a revenge drama.",
        "model_code": "mock-text-1",
        "provider_code": "mock",
    }
    body.update(overrides)
    headers = dict(admin["headers"])
    headers["Idempotency-Key"] = overrides.pop("_idempotency_key", uuid.uuid4().hex)
    response = client.post(
        f"/api/v1/projects/{project_id}/generation/tasks", headers=headers, json=body
    )
    return response, body


def test_mock_text_generation_produces_task_attempt_and_usage(client, admin):
    project = _project(client, admin)
    response, body = _create_task(client, admin, project["id"])
    assert response.status_code == 201, response.text
    task = response.json()["data"]
    assert task["status"] == "succeeded"
    assert task["result_payload"]["kind"] == "text"
    assert body["prompt"][:20] in task["result_payload"]["text"]
    assert response.json()["meta"]["created"] is True

    detail = client.get(f"/api/v1/generation/tasks/{task['id']}", headers=admin["headers"])
    assert detail.status_code == 200
    attempts = detail.json()["data"]["attempts"]
    assert len(attempts) == 1
    assert attempts[0]["attempt_number"] == 1
    assert attempts[0]["provider_task_id"].startswith("mock-")


def test_idempotency_key_prevents_duplicate_generation(client, admin):
    project = _project(client, admin)
    key = uuid.uuid4().hex
    first, _ = _create_task(client, admin, project["id"], _idempotency_key=key)
    second, _ = _create_task(client, admin, project["id"], _idempotency_key=key)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["data"]["id"] == second.json()["data"]["id"]
    assert second.json()["meta"]["created"] is False

    detail = client.get(
        f"/api/v1/generation/tasks/{first.json()['data']['id']}", headers=admin["headers"]
    )
    assert len(detail.json()["data"]["attempts"]) == 1


def test_mock_image_generation_returns_placeholder_asset_metadata(client, admin):
    project = _project(client, admin)
    response, _ = _create_task(
        client,
        admin,
        project["id"],
        capability="image_generation",
        prompt="wide shot of a rainy harbor at night",
        parameters={"width": 1024, "height": 576},
    )
    assert response.status_code == 201, response.text
    output = response.json()["data"]["result_payload"]
    assert output["mime_type"] == "image/png"
    assert output["storage_key"].startswith("mock/image_generation/")
    assert output["placeholder"] is True


def test_provider_failure_is_recorded_not_reported_as_success(client, admin):
    project = _project(client, admin)
    response, _ = _create_task(client, admin, project["id"], provider_code="mock-failing")
    assert response.status_code == 201
    task = response.json()["data"]
    assert task["status"] == "failed"
    assert task["error_code"] == "PROVIDER_UNAVAILABLE"

    detail = client.get(f"/api/v1/generation/tasks/{task['id']}", headers=admin["headers"])
    attempts = detail.json()["data"]["attempts"]
    assert attempts[0]["status"] == "failed"
    assert attempts[0]["error_code"] == "PROVIDER_UNAVAILABLE"


def test_unsupported_capability_for_provider_is_rejected(client, admin):
    project = _project(client, admin)
    response, _ = _create_task(client, admin, project["id"], capability="asr")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_cancel_on_terminal_task_is_rejected(client, admin):
    project = _project(client, admin)
    response, _ = _create_task(client, admin, project["id"])
    task_id = response.json()["data"]["id"]
    cancel = client.post(f"/api/v1/generation/tasks/{task_id}/cancel", headers=admin["headers"])
    assert cancel.status_code == 409
    assert cancel.json()["error"]["details"]["code"] == "TASK_NOT_RETRYABLE"


def test_generation_is_denied_for_non_project_members(client, admin):
    project = _project(client, admin)

    role = client.post(
        "/api/v1/roles",
        headers=admin["headers"],
        json={"code": "reader", "name": "Reader", "permissions": ["projects:read"]},
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
        f"/api/v1/projects/{project['id']}/generation/tasks",
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
