import uuid


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


def test_project_access_requires_membership(client, admin):
    role = client.post(
        "/api/v1/roles",
        headers=admin["headers"],
        json={"code": "artist", "name": "Artist", "permissions": ["projects:read"]},
    ).json()["data"]
    email, password, user = _create_user(client, admin, role["id"])
    member = _login(client, email, password)
    headers = {"Authorization": f"Bearer {member['access_token']}"}

    visible = _create_project(client, admin, "alpha")
    hidden = _create_project(client, admin, "beta")

    # The user is a valid organization member with projects:read, but not a project member.
    denied = client.get(f"/api/v1/projects/{hidden['id']}", headers=headers)
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"

    listed = client.get("/api/v1/projects", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["data"] == []
    assert listed.json()["meta"]["total"] == 0

    added = client.post(
        f"/api/v1/projects/{visible['id']}/members",
        headers=admin["headers"],
        json={"user_id": user["id"], "project_role": "artist"},
    )
    assert added.status_code == 201, added.text

    allowed = client.get(f"/api/v1/projects/{visible['id']}", headers=headers)
    assert allowed.status_code == 200
    assert allowed.json()["data"]["code"] == "alpha"

    listed_after = client.get("/api/v1/projects", headers=headers)
    assert [row["code"] for row in listed_after.json()["data"]] == ["alpha"]

    # 'artist' project role cannot modify the project even though it can read it.
    patch = client.patch(
        f"/api/v1/projects/{visible['id']}",
        headers=headers,
        json={"title": "Hijacked"},
    )
    assert patch.status_code == 403

    # Adding members is a projects:manage action, which this user does not hold.
    add_denied = client.post(
        f"/api/v1/projects/{visible['id']}/members",
        headers=headers,
        json={"user_id": user["id"], "project_role": "owner"},
    )
    assert add_denied.status_code == 403


def test_unknown_project_is_not_disclosed(client, admin):
    missing = client.get(f"/api/v1/projects/{uuid.uuid4()}", headers=admin["headers"])
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_project_code_is_unique_per_organization(client, admin):
    _create_project(client, admin, "gamma")
    duplicate = client.post(
        "/api/v1/projects",
        headers=admin["headers"],
        json={"code": "gamma", "title": "Duplicate"},
    )
    assert duplicate.status_code == 409


def test_project_member_must_belong_to_the_same_organization(client, admin, db_session):
    from app.domains.organizations.models import Organization, OrganizationMember
    from app.domains.users.models import User

    project = _create_project(client, admin, f"scoped-{uuid.uuid4().hex[:6]}")
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
        f"/api/v1/projects/{project['id']}/members",
        headers=admin["headers"],
        json={"user_id": str(other_user.id), "project_role": "writer"},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
