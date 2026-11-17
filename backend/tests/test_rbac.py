import uuid


def _create_user(client, admin, role_ids=None, password="MemberPassword1"):
    email = f"member-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/users",
        headers=admin["headers"],
        json={
            "email": email,
            "full_name": "Member",
            "password": password,
            "role_ids": role_ids or [],
        },
    )
    assert response.status_code == 201, response.text
    return email, password, response.json()["data"]


def _login(client, email: str, password: str) -> dict:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["data"]


def test_missing_permission_is_denied_server_side(client, admin):
    email, password, _ = _create_user(client, admin)
    member = _login(client, email, password)
    headers = {"Authorization": f"Bearer {member['access_token']}"}

    # No role was assigned, so read permissions are absent.
    denied = client.get("/api/v1/roles", headers=headers)
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"

    users_denied = client.get("/api/v1/users", headers=headers)
    assert users_denied.status_code == 403

    projects = client.get("/api/v1/projects", headers=headers)
    assert projects.status_code == 403


def test_administrator_assigns_role_and_permission_takes_effect(client, admin):
    role = client.post(
        "/api/v1/roles",
        headers=admin["headers"],
        json={
            "code": "writer",
            "name": "Writer",
            "description": "Writes episodes",
            "permissions": ["projects:read", "projects:write"],
        },
    )
    assert role.status_code == 201, role.text
    role_id = role.json()["data"]["id"]

    email, password, user = _create_user(client, admin, role_ids=[role_id])
    member = _login(client, email, password)
    headers = {"Authorization": f"Bearer {member['access_token']}"}

    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert sorted(me.json()["data"]["permissions"]) == ["projects:read", "projects:write"]

    assert client.get("/api/v1/projects", headers=headers).status_code == 200
    assert client.get("/api/v1/roles", headers=headers).status_code == 403

    audit = client.get(
        "/api/v1/audit-logs", headers=admin["headers"], params={"action": "role.created"}
    )
    assert audit.status_code == 200
    actions = [row["action"] for row in audit.json()["data"]]
    assert "role.created" in actions

    audit_denied = client.get("/api/v1/audit-logs", headers=headers)
    assert audit_denied.status_code == 403

    # An inactive user can no longer authenticate.
    deactivated = client.patch(
        f"/api/v1/users/{user['id']}", headers=admin["headers"], json={"is_active": False}
    )
    assert deactivated.status_code == 200
    failure = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert failure.status_code == 401


def test_duplicate_user_email_is_a_conflict(client, admin):
    email, _, _ = _create_user(client, admin)
    duplicate = client.post(
        "/api/v1/users",
        headers=admin["headers"],
        json={"email": email, "full_name": "Clone", "password": "MemberPassword1"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "CONFLICT"


def test_role_with_unknown_permission_is_rejected(client, admin):
    response = client.post(
        "/api/v1/roles",
        headers=admin["headers"],
        json={"code": "ghost", "name": "Ghost", "permissions": ["ghost:read"]},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"
