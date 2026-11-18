import uuid

from fastapi.testclient import TestClient


def _bootstrap(client: TestClient, password: str = "CorrectHorseBattery1") -> dict:
    payload = {
        "email": f"owner-{uuid.uuid4().hex[:8]}@example.com",
        "password": password,
        "full_name": "Owner",
        "organization_name": "Bootstrap Studio",
    }
    response = client.post("/api/v1/auth/bootstrap", json=payload)
    assert response.status_code == 200, response.text
    return payload


def test_bootstrap_login_and_me(client):
    payload = _bootstrap(client)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login.status_code == 200, login.text
    data = login.json()["data"]
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0
    assert "administrator" not in data["refresh_token"]

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"})
    assert me.status_code == 200, me.text
    body = me.json()["data"]
    assert body["user"]["email"] == payload["email"]
    assert "users:write" in body["permissions"]
    assert "projects:manage" in body["permissions"]


def test_bootstrap_is_single_use(client):
    _bootstrap(client)
    second = client.post(
        "/api/v1/auth/bootstrap",
        json={
            "email": f"late-{uuid.uuid4().hex[:8]}@example.com",
            "password": "CorrectHorseBattery1",
            "full_name": "Late",
            "organization_name": "Second Studio",
        },
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "CONFLICT"


def test_login_rejects_bad_password_without_leaking_account_state(client):
    payload = _bootstrap(client)
    wrong_password = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": "definitely-wrong"},
    )
    unknown_user = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "definitely-wrong"},
    )
    assert wrong_password.status_code == 401
    assert unknown_user.status_code == 401
    assert wrong_password.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert wrong_password.json()["error"]["message"] == unknown_user.json()["error"]["message"]


def test_me_requires_a_token(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"

    invalid = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert invalid.status_code == 401
    assert invalid.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"


def test_refresh_rotates_and_consumes_the_old_token(client):
    payload = _bootstrap(client)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    ).json()["data"]

    refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert refreshed.status_code == 200, refreshed.text
    rotated = refreshed.json()["data"]
    assert rotated["refresh_token"] != login["refresh_token"]

    reused = client.post("/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert reused.status_code == 401
    assert reused.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"

    me = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {rotated['access_token']}"}
    )
    assert me.status_code == 200


def test_logout_revokes_the_refresh_token(client):
    payload = _bootstrap(client)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    ).json()["data"]

    logout = client.post("/api/v1/auth/logout", json={"refresh_token": login["refresh_token"]})
    assert logout.status_code == 200
    assert logout.json()["data"]["revoked"] is True

    refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert refreshed.status_code == 401
