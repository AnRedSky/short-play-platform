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



def test_role_assignment_cannot_target_user_from_another_organization(client, admin, db_session):
    from app.domains.organizations.models import Organization, OrganizationMember
    from app.domains.users.models import User

    role = client.post(
        "/api/v1/roles",
        headers=admin["headers"],
        json={
            "code": f"scoped-{uuid.uuid4().hex[:8]}",
            "name": "Scoped",
            "permissions": ["projects:read"],
        },
    ).json()["data"]
    other_org = Organization(name="Other studio", slug=f"other-{uuid.uuid4().hex[:8]}")
    db_session.add(other_org)
    db_session.flush()
    other_user = User(
        email=f"other-{uuid.uuid4().hex[:8]}@example.com",
        full_name="Other organization user",
        password_hash="not-used-in-this-test",
    )
    db_session.add(other_user)
    db_session.flush()
    db_session.add(OrganizationMember(organization_id=other_org.id, user_id=other_user.id))
    db_session.flush()

    response = client.post(
        f"/api/v1/roles/{role['id']}/assignments",
        headers=admin["headers"],
        json={"user_id": str(other_user.id)},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_permissions_from_another_organization_do_not_leak_into_current_context(
    client, admin, db_session
):
    from app.domains.organizations.models import Organization, OrganizationMember
    from app.domains.roles.models import Permission, Role, RolePermission, UserRole
    from sqlalchemy import select

    email, password, user = _create_user(client, admin)
    other_org = Organization(name="Other studio", slug=f"other-{uuid.uuid4().hex[:8]}")
    db_session.add(other_org)
    db_session.flush()
    db_session.add(OrganizationMember(organization_id=other_org.id, user_id=user["id"]))
    foreign_role = Role(
        organization_id=other_org.id,
        code=f"foreign-admin-{uuid.uuid4().hex[:8]}",
        name="Foreign organization admin",
    )
    db_session.add(foreign_role)
    db_session.flush()
    manage_permission = db_session.scalar(
        select(Permission).where(Permission.code == "projects:manage")
    )
    assert manage_permission is not None
    db_session.add(RolePermission(role_id=foreign_role.id, permission_id=manage_permission.id))
    db_session.add(UserRole(user_id=user["id"], role_id=foreign_role.id))
    db_session.flush()

    tokens = _login(client, email, password)
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["data"]["organization_id"] == admin["organization_id"]
    assert "projects:manage" not in me.json()["data"]["permissions"]
