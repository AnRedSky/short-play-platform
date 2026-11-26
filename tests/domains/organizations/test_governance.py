import uuid

from sqlalchemy import select


def _me(client, admin):
    response = client.get("/api/v1/auth/me", headers=admin["headers"])
    assert response.status_code == 200, response.text
    return response.json()["data"]


def _create_role(client, admin, permissions, suffix="ops"):
    response = client.post(
        "/api/v1/roles",
        headers=admin["headers"],
        json={
            "code": f"{suffix}-{uuid.uuid4().hex[:8]}",
            "name": f"Role {suffix}",
            "permissions": permissions,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _create_user(client, admin, role_ids=None):
    unique = uuid.uuid4().hex[:8]
    email = f"member-{unique}@example.com"
    password = "MemberPassword1"
    response = client.post(
        "/api/v1/users",
        headers=admin["headers"],
        json={
            "email": email,
            "full_name": "Governance member",
            "password": password,
            "role_ids": role_ids or [],
        },
    )
    assert response.status_code == 201, response.text
    return email, password, response.json()["data"]


def _login(client, email, password):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["data"]


def _headers(token):
    return {"Authorization": f"Bearer {token['access_token']}"}


def _create_project(client, headers, code):
    response = client.post(
        "/api/v1/projects",
        headers=headers,
        json={"code": code, "title": f"Project {code}", "summary": "governance"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def test_department_lifecycle_cycle_and_member_blocking(client, admin):
    admin_id = _me(client, admin)["user"]["id"]
    root = client.post(
        "/api/v1/organizations/departments",
        headers=admin["headers"],
        json={"name": "Production", "manager_user_id": admin_id},
    )
    assert root.status_code == 201, root.text
    root = root.json()["data"]
    assert root["manager_user_id"] == admin_id

    child = client.post(
        "/api/v1/organizations/departments",
        headers=admin["headers"],
        json={"name": "Production A", "parent_id": root["id"]},
    )
    assert child.status_code == 201, child.text
    child = child.json()["data"]

    cycle = client.patch(
        f"/api/v1/organizations/departments/{root['id']}",
        headers=admin["headers"],
        json={"parent_id": child["id"]},
    )
    assert cycle.status_code == 409
    assert cycle.json()["error"]["code"] == "DEPARTMENT_CYCLE"

    blocked_children = client.delete(
        f"/api/v1/organizations/departments/{root['id']}", headers=admin["headers"]
    )
    assert blocked_children.status_code == 409
    assert blocked_children.json()["error"]["code"] == "DEPARTMENT_HAS_CHILDREN"

    moved = client.patch(
        f"/api/v1/organizations/members/{admin_id}",
        headers=admin["headers"],
        json={"department_id": child["id"]},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["data"]["department_id"] == child["id"]

    blocked_members = client.delete(
        f"/api/v1/organizations/departments/{child['id']}", headers=admin["headers"]
    )
    assert blocked_members.status_code == 409
    assert blocked_members.json()["error"]["code"] == "DEPARTMENT_HAS_MEMBERS"

    unassigned = client.patch(
        f"/api/v1/organizations/members/{admin_id}",
        headers=admin["headers"],
        json={"department_id": None},
    )
    assert unassigned.status_code == 200
    deleted_child = client.delete(
        f"/api/v1/organizations/departments/{child['id']}", headers=admin["headers"]
    )
    assert deleted_child.status_code == 204
    deleted_root = client.delete(
        f"/api/v1/organizations/departments/{root['id']}", headers=admin["headers"]
    )
    assert deleted_root.status_code == 204

    read = client.get(
        f"/api/v1/organizations/departments/{child['id']}", headers=admin["headers"]
    )
    assert read.status_code == 200
    assert read.json()["data"]["is_active"] is False

    inactive_rows = client.get(
        "/api/v1/organizations/departments?include_inactive=true",
        headers=admin["headers"],
    )
    assert inactive_rows.status_code == 200
    assert {row["id"] for row in inactive_rows.json()["data"]} >= {root["id"], child["id"]}


def test_role_revocation_takes_effect_on_the_existing_access_token(client, admin):
    role = _create_role(client, admin, ["org.read"], "revoke")
    email, password, user = _create_user(client, admin, [role["id"]])
    member = _login(client, email, password)

    allowed = client.get("/api/v1/organizations/departments", headers=_headers(member))
    assert allowed.status_code == 200

    revoked = client.delete(
        f"/api/v1/roles/{role['id']}/assignments/{user['id']}", headers=admin["headers"]
    )
    assert revoked.status_code == 204

    denied = client.get("/api/v1/organizations/departments", headers=_headers(member))
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"


def test_project_authorization_evidence_update_and_immediate_revocation(client, admin):
    role = _create_role(client, admin, ["project.read"], "artist")
    email, password, user = _create_user(client, admin, [role["id"]])
    member = _login(client, email, password)
    project = _create_project(client, admin["headers"], f"gov-{uuid.uuid4().hex[:6]}")
    admin_id = _me(client, admin)["user"]["id"]

    owner_removal = client.delete(
        f"/api/v1/projects/{project['record_id']}/members/{admin_id}",
        headers=admin["headers"],
    )
    assert owner_removal.status_code == 409
    assert owner_removal.json()["error"]["code"] == "PROJECT_OWNER_IMMUTABLE"

    owner_denied = client.post(
        f"/api/v1/projects/{project['record_id']}/members",
        headers=admin["headers"],
        json={"user_id": user["id"], "project_role": "owner"},
    )
    assert owner_denied.status_code == 409
    assert owner_denied.json()["error"]["code"] == "PROJECT_OWNER_IMMUTABLE"

    added = client.post(
        f"/api/v1/projects/{project['record_id']}/members",
        headers=admin["headers"],
        json={"user_id": user["id"], "project_role": "artist"},
    )
    assert added.status_code == 201, added.text
    authorization = added.json()["data"]
    assert authorization["granted_by"] == _me(client, admin)["user"]["id"]
    assert authorization["granted_at"] is not None

    assert client.get(
        f"/api/v1/projects/{project['record_id']}", headers=_headers(member)
    ).status_code == 200

    updated = client.patch(
        f"/api/v1/projects/{project['record_id']}/members/{user['id']}",
        headers=admin["headers"],
        json={"project_role": "writer"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["data"]["project_role"] == "writer"

    downgrade_owner = client.patch(
        f"/api/v1/projects/{project['record_id']}/members/{user['id']}",
        headers=admin["headers"],
        json={"project_role": "owner"},
    )
    assert downgrade_owner.status_code == 409
    assert downgrade_owner.json()["error"]["code"] == "PROJECT_OWNER_IMMUTABLE"

    removed = client.delete(
        f"/api/v1/projects/{project['record_id']}/members/{user['id']}",
        headers=admin["headers"],
    )
    assert removed.status_code == 204

    member_detail = client.get(
        f"/api/v1/organizations/members/{user['id']}", headers=admin["headers"]
    )
    assert member_detail.status_code == 200
    authorization = member_detail.json()["data"]["project_authorizations"][0]
    assert authorization["is_active"] is False
    assert authorization["revoked_at"] is not None

    denied = client.get(f"/api/v1/projects/{project['record_id']}", headers=_headers(member))
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"


def test_account_deactivation_revokes_roles_membership_and_project_authorization(client, admin):
    role = _create_role(client, admin, ["project.read"], "deactivate")
    email, password, user = _create_user(client, admin, [role["id"]])
    member = _login(client, email, password)
    project = _create_project(client, admin["headers"], f"deact-{uuid.uuid4().hex[:6]}")
    added = client.post(
        f"/api/v1/projects/{project['record_id']}/members",
        headers=admin["headers"],
        json={"user_id": user["id"], "project_role": "artist"},
    )
    assert added.status_code == 201, added.text
    assert client.get(
        f"/api/v1/projects/{project['record_id']}", headers=_headers(member)
    ).status_code == 200

    deactivated = client.patch(
        f"/api/v1/users/{user['id']}",
        headers=admin["headers"],
        json={"is_active": False},
    )
    assert deactivated.status_code == 200, deactivated.text

    expired = client.get("/api/v1/projects", headers=_headers(member))
    assert expired.status_code == 401
    assert expired.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"

    detail = client.get(
        f"/api/v1/organizations/members/{user['id']}", headers=admin["headers"]
    )
    assert detail.status_code == 200
    payload = detail.json()["data"]
    assert payload["user_active"] is False
    assert payload["member"]["is_active"] is False
    assert payload["member"]["deactivated_at"] is not None
    assert payload["role_codes"] == []
    assert payload["project_authorizations"][0]["is_active"] is False

    listed = client.get(
        "/api/v1/organizations/members?include_inactive=false",
        headers=admin["headers"],
    )
    assert listed.status_code == 200
    assert user["id"] not in {row["user_id"] for row in listed.json()["data"]}


def test_offboarding_transfers_ownership_revokes_and_is_idempotent(client, admin, db_session):
    from app.domains.organizations.models import OrganizationMember
    from app.domains.projects.models import Project, ProjectMember
    from app.domains.users.models import User

    role = _create_role(
        client,
        admin,
        ["project.read", "project.create", "project.manage"],
        "owner",
    )
    victim_email, victim_password, victim = _create_user(client, admin, [role["id"]])
    _, _, handover = _create_user(client, admin, [])
    victim_session = _login(client, victim_email, victim_password)
    project = _create_project(client, _headers(victim_session), f"off-{uuid.uuid4().hex[:6]}")

    owner_deactivation = client.patch(
        f"/api/v1/users/{victim['id']}",
        headers=admin["headers"],
        json={"is_active": False},
    )
    assert owner_deactivation.status_code == 409
    assert owner_deactivation.json()["error"]["code"] == "HANDOVER_REQUIRED"
    assert client.get("/api/v1/auth/me", headers=_headers(victim_session)).status_code == 200

    missing_handover = client.post(
        f"/api/v1/organizations/members/{victim['id']}/offboard",
        headers=admin["headers"],
        json={},
    )
    assert missing_handover.status_code == 409
    assert missing_handover.json()["error"]["code"] == "HANDOVER_REQUIRED"
    # A failed handover check must not partially deactivate the member.
    assert client.get("/api/v1/auth/me", headers=_headers(victim_session)).status_code == 200

    unknown_handover = client.post(
        f"/api/v1/organizations/members/{victim['id']}/offboard",
        headers=admin["headers"],
        json={"handover_to_user_id": str(uuid.uuid4())},
    )
    assert unknown_handover.status_code == 404

    offboarded = client.post(
        f"/api/v1/organizations/members/{victim['id']}/offboard",
        headers=admin["headers"],
        json={"handover_to_user_id": handover["id"], "note": "Left the studio"},
    )
    assert offboarded.status_code == 201, offboarded.text
    record = offboarded.json()["data"]
    assert record["status"] == "completed"
    assert record["project_count"] == 1
    assert record["transferred_project_count"] == 1
    assert record["project_authorizations_revoked"] == 1
    assert record["roles_revoked"] == 1
    assert record["sessions_revoked"] == 1
    assert record["handover_to_user_id"] == handover["id"]

    repeated = client.post(
        f"/api/v1/organizations/members/{victim['id']}/offboard",
        headers=admin["headers"],
        json={"note": "second attempt"},
    )
    assert repeated.status_code == 201
    assert repeated.json()["data"]["id"] == record["id"]

    history = client.get("/api/v1/organizations/offboarding", headers=admin["headers"])
    assert history.status_code == 200
    assert [row["id"] for row in history.json()["data"]] == [record["id"]]

    expired = client.get("/api/v1/projects", headers=_headers(victim_session))
    assert expired.status_code == 401
    assert expired.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"

    detail = client.get(
        f"/api/v1/organizations/members/{victim['id']}", headers=admin["headers"]
    )
    assert detail.status_code == 200
    assert detail.json()["data"]["member"]["is_active"] is False
    assert detail.json()["data"]["role_codes"] == []

    project_row = db_session.scalar(select(Project).where(Project.code == project["id"]))
    assert project_row.owner_user_id == uuid.UUID(handover["id"])
    old_membership = db_session.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_row.id,
            ProjectMember.user_id == uuid.UUID(victim["id"]),
        )
    )
    assert old_membership.is_active is False
    assert old_membership.revoked_at is not None
    handover_membership = db_session.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_row.id,
            ProjectMember.user_id == uuid.UUID(handover["id"]),
        )
    )
    assert handover_membership.project_role == "owner"
    assert handover_membership.is_active is True
    assert db_session.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == uuid.UUID(admin["organization_id"]),
            OrganizationMember.user_id == uuid.UUID(victim["id"]),
        )
    ).deactivated_at is not None
    assert db_session.scalar(
        select(User).where(User.id == uuid.UUID(victim["id"]))
    ).is_active is False
