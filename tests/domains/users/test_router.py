"""Users domain: HTTP contract tests."""

import uuid


def _create_user(client, admin, email: str, name: str = "Writer One") -> dict:
    response = client.post(
        "/api/v1/users",
        json={
            "email": email,
            "full_name": name,
            "password": "CorrectHorseBattery1",
        },
        headers=admin["headers"],
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def test_create_user_and_read_back(client, admin):
    user = _create_user(client, admin, f"writer-{uuid.uuid4().hex[:8]}@example.com")

    detail = client.get(f"/api/v1/users/{user['id']}", headers=admin["headers"])
    assert detail.status_code == 200, detail.text
    body = detail.json()["data"]
    assert body["id"] == user["id"]
    assert "permissions" in body


def test_list_users_paginates(client, admin):
    _create_user(client, admin, f"writer-{uuid.uuid4().hex[:8]}@example.com")

    response = client.get("/api/v1/users", headers=admin["headers"])
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["meta"]["total"] >= 1
    assert payload["data"]


def test_update_user_patches_full_name(client, admin):
    user = _create_user(client, admin, f"writer-{uuid.uuid4().hex[:8]}@example.com")

    response = client.patch(
        f"/api/v1/users/{user['id']}",
        json={"full_name": "Renamed Writer"},
        headers=admin["headers"],
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["full_name"] == "Renamed Writer"


def test_unknown_user_returns_documented_error(client, admin):
    response = client.get(f"/api/v1/users/{uuid.uuid4()}", headers=admin["headers"])
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"



def test_user_detail_and_update_are_scoped_to_active_organization(client, admin, db_session):
    from app.domains.organizations.models import Organization, OrganizationMember
    from app.domains.users.models import User

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

    detail = client.get(f"/api/v1/users/{other_user.id}", headers=admin["headers"])
    assert detail.status_code == 404
    assert detail.json()["error"]["code"] == "RESOURCE_NOT_FOUND"

    update = client.patch(
        f"/api/v1/users/{other_user.id}",
        headers=admin["headers"],
        json={"full_name": "Cross-organization modification"},
    )
    assert update.status_code == 404
    assert other_user.full_name == "Other organization user"
