"""B-02 acceptance: server-side state machine, PATCH closure, idempotency."""

import uuid

from sqlalchemy import func, select

from app.domains.audit.models import AuditLog


def _create_user(client, admin, role_id=None):
    email = f"artist-{uuid.uuid4().hex[:8]}@example.com"
    password = "MemberPassword1"
    response = client.post(
        "/api/v1/users",
        headers=admin["headers"],
        json={
            "email": email,
            "full_name": "Artist",
            "password": password,
            "role_ids": [role_id] if role_id else [],
        },
    )
    assert response.status_code == 201, response.text
    return email, password, response.json()["data"]


def _login(client, email, password):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()[
        "data"
    ]


def _create_project(client, admin, code):
    response = client.post(
        "/api/v1/projects",
        headers=admin["headers"],
        json={"code": code, "title": f"Project {code}", "summary": "pilot"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _transition(client, headers, project_id, **body):
    return client.post(f"/api/v1/projects/{project_id}/transitions", headers=headers, json=body)


def test_transition_advances_state_and_returns_allowed_actions(client, admin):
    project = _create_project(client, admin, f"flow-{uuid.uuid4().hex[:6]}")
    assert project["status"] == "草稿"

    response = _transition(client, admin["headers"], project["id"], action="start")
    assert response.status_code == 200, response.text
    body = response.json()["data"]
    assert body["project"]["status"] == "创意策划中"
    assert body["message"] == "草稿 → 创意策划中"
    keys = {item["key"] for item in body["allowed_actions"]}
    assert keys == {"confirmBrief", "terminate"}


def test_patch_cannot_change_status(client, admin):
    project = _create_project(client, admin, f"patch-{uuid.uuid4().hex[:6]}")
    response = client.patch(
        f"/api/v1/projects/{project['id']}",
        headers=admin["headers"],
        json={"status": "生产中"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert project["status"] == "草稿"


def test_illegal_transition_is_rejected(client, admin):
    project = _create_project(client, admin, f"illegal-{uuid.uuid4().hex[:6]}")
    response = _transition(client, admin["headers"], project["id"], action="deliver")
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "ILLEGAL_TRANSITION"
    assert error["details"] == {"status": "草稿", "action": "deliver"}


def test_expected_state_conflict_is_rejected(client, admin):
    project = _create_project(client, admin, f"conflict-{uuid.uuid4().hex[:6]}")
    response = _transition(
        client,
        admin["headers"],
        project["id"],
        action="start",
        expected_state="创意策划中",
    )
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "STATE_CONFLICT"
    assert error["details"] == {"expected_state": "创意策划中", "actual_state": "草稿"}


def test_reason_is_required_for_destructive_action(client, admin):
    project = _create_project(client, admin, f"reason-{uuid.uuid4().hex[:6]}")
    response = _transition(client, admin["headers"], project["id"], action="terminate")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "REASON_REQUIRED"

    ok = _transition(client, admin["headers"], project["id"], action="terminate", reason="需求取消")
    assert ok.status_code == 200, ok.text
    assert ok.json()["data"]["project"]["status"] == "已终止"


def test_idempotency_key_writes_once(client, admin, db_session):
    project = _create_project(client, admin, f"idem-{uuid.uuid4().hex[:6]}")
    key = f"key-{uuid.uuid4().hex}"
    headers = {**admin["headers"], "Idempotency-Key": key}

    first = client.post(
        f"/api/v1/projects/{project['id']}/transitions",
        headers=headers,
        json={"action": "start"},
    )
    repeat = client.post(
        f"/api/v1/projects/{project['id']}/transitions",
        headers=headers,
        json={"action": "start"},
    )
    assert first.status_code == 200, first.text
    assert repeat.status_code == 200, repeat.text
    assert repeat.json()["data"] == first.json()["data"]

    logs = db_session.scalars(
        select(AuditLog).where(
            AuditLog.action == "project.transition.start",
            AuditLog.resource_id == project["id"],
        )
    ).all()
    assert len(logs) == 1
    count = db_session.scalar(
        select(func.count(AuditLog.id)).where(
            AuditLog.action == "project.transition.start",
            AuditLog.resource_id == project["id"],
        )
    )
    assert count == 1


def test_transition_requires_action_permission_and_membership(client, admin):
    role = client.post(
        "/api/v1/roles",
        headers=admin["headers"],
        json={
            "code": f"reader-{uuid.uuid4().hex[:6]}",
            "name": "Reader",
            "permissions": ["project.read"],
        },
    ).json()["data"]
    email, password, user = _create_user(client, admin, role["id"])
    member = _login(client, email, password)
    headers = {"Authorization": f"Bearer {member['access_token']}"}

    project = _create_project(client, admin, f"perm-{uuid.uuid4().hex[:6]}")
    # Not a project member: read is denied before any action permission check.
    denied = _transition(client, headers, project["id"], action="start")
    assert denied.status_code == 403

    added = client.post(
        f"/api/v1/projects/{project['id']}/members",
        headers=admin["headers"],
        json={"user_id": user["id"], "project_role": "writer"},
    )
    assert added.status_code == 201, added.text

    # Member now, but creation.write is still absent from the role.
    denied_by_permission = _transition(client, headers, project["id"], action="start")
    assert denied_by_permission.status_code == 403
    assert denied_by_permission.json()["error"]["code"] == "PERMISSION_DENIED"
