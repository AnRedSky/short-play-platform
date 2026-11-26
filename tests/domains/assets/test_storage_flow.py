import uuid
from urllib.parse import parse_qs, urlsplit

from sqlalchemy import select

from app.domains.assets.models import AssetUploadSession
from tests.domains.assets.test_router import _png, _project


def _direct_upload(client, admin, project_id, data: bytes, *, filename="reel.png"):
    created = client.post(
        f"/api/v1/projects/{project_id}/asset-uploads",
        headers=admin["headers"],
        json={
            "filename": filename,
            "mime_type": "image/png",
            "title": "直传素材",
            "max_bytes": len(data) + 1024,
        },
    )
    assert created.status_code == 201, created.text
    session = created.json()["data"]
    parts = urlsplit(session["upload_url"])
    put = client.put(
        f"{parts.path}?{parts.query}",
        content=data,
        headers={"Content-Type": "image/png"},
    )
    assert put.status_code == 200, put.text
    completed = client.post(
        f"/api/v1/projects/{project_id}/asset-uploads/{session['upload_id']}/complete",
        headers=admin["headers"],
        json={"checksum": put.json()["data"]["checksum"]},
    )
    assert completed.status_code == 201, completed.text
    return session, put.json()["data"], completed.json()["data"]


def _upload_version(client, admin, asset_id, data: bytes):
    response = client.post(
        f"/api/v1/assets/{asset_id}/versions",
        headers=admin["headers"],
        files={"file": ("retake.png", data, "image/png")},
        data={"note": "retake"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _pass_qc(client, admin, asset_id):
    response = client.post(
        f"/api/v1/assets/{asset_id}/qc",
        headers=admin["headers"],
        json={"result": "通过", "note": "构图与清晰度达标"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _clear_authorization(client, admin, asset_id):
    response = client.patch(
        f"/api/v1/assets/{asset_id}/authorization",
        headers=admin["headers"],
        json={"status": "cleared", "scope": "短剧正片", "note": "已取得完整授权"},
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]


def _formalize(client, admin, asset_id):
    return client.post(
        f"/api/v1/assets/{asset_id}/formalize", headers=admin["headers"]
    )


def test_direct_upload_only_stores_token_hash_and_registers_asset(
    client, admin, db_session, tmp_path
):
    project = _project(client, admin)
    data = _png(tmp_path, "direct.png", color="green")
    session, put_body, asset = _direct_upload(client, admin, project["record_id"], data)
    token = parse_qs(urlsplit(session["upload_url"]).query)["token"][0]

    stored = db_session.scalar(
        select(AssetUploadSession).where(AssetUploadSession.id == uuid.UUID(session["upload_id"]))
    )
    assert stored is not None
    assert stored.token_hash != token
    assert token not in stored.token_hash
    assert stored.status == "completed"
    assert stored.asset_id == uuid.UUID(asset["id"])

    assert put_body["checksum"] == asset["checksum"]
    assert asset["checksum"] == stored.checksum
    assert asset["status"] == "registered"
    assert asset["qc_status"] == "pending"
    assert asset["authorization_status"] == "pending"
    assert asset["reference_count"] == 0
    assert asset["source"] == "direct_upload"
    assert asset["storage_key"].startswith(f"asset-uploads/{project['record_id']}/")

    detail = client.get(f"/api/v1/assets/{asset['id']}", headers=admin["headers"]).json()["data"]
    assert detail["versions"][0]["status"] == "draft"
    assert detail["versions"][0]["checksum"] == asset["checksum"]


def test_qc_then_authorization_then_formal_release_is_a_closed_loop(client, admin, tmp_path):
    project = _project(client, admin)
    _, _, asset = _direct_upload(
        client, admin, project["record_id"], _png(tmp_path, "formal.png", color="blue")
    )

    blocked_qc = _formalize(client, admin, asset["id"])
    assert blocked_qc.status_code == 409, blocked_qc.text
    assert blocked_qc.json()["error"]["code"] == "ASSET_QC_NOT_PASSED"

    checked = _pass_qc(client, admin, asset["id"])
    assert checked["asset"]["status"] == "qc_passed"
    assert checked["check"]["result"] == "passed"
    assert checked["check"]["checksum"] == asset["checksum"]

    blocked_auth = _formalize(client, admin, asset["id"])
    assert blocked_auth.status_code == 409, blocked_auth.text
    assert blocked_auth.json()["error"]["code"] == "ASSET_AUTH_NOT_CLEARED"

    authorized = _clear_authorization(client, admin, asset["id"])
    assert authorized["authorization_status"] == "cleared"

    released = _formalize(client, admin, asset["id"])
    assert released.status_code == 200, released.text
    body = released.json()["data"]
    assert body["asset"]["status"] == "formal"
    assert body["asset"]["formal_version_id"] == body["version"]["id"]
    assert body["version"]["status"] == "formal"
    assert body["version"]["version_number"] == 1

    recheck = client.post(
        f"/api/v1/assets/{asset['id']}/qc",
        headers=admin["headers"],
        json={"result": "拒绝", "note": "试图覆盖正式版"},
    )
    assert recheck.status_code == 409, recheck.text
    assert recheck.json()["error"]["code"] == "ASSET_ALREADY_FORMAL"


def test_new_version_resets_qc_and_supersedes_the_previous_formal_version(client, admin, tmp_path):
    project = _project(client, admin)
    first = _png(tmp_path, "v1.png", color="red")
    _, _, asset = _direct_upload(client, admin, project["record_id"], first)
    _pass_qc(client, admin, asset["id"])
    _clear_authorization(client, admin, asset["id"])
    assert _formalize(client, admin, asset["id"]).status_code == 200

    second = _png(tmp_path, "v2.png", color="purple")
    version_two = _upload_version(client, admin, asset["id"], second)
    assert version_two["version_number"] == 2
    assert version_two["status"] == "draft"

    detail = client.get(f"/api/v1/assets/{asset['id']}", headers=admin["headers"]).json()["data"]
    assert detail["status"] == "registered"
    assert detail["qc_status"] == "pending"
    assert detail["authorization_status"] == "pending"
    assert detail["formal_version_id"] == detail["versions"][0]["id"]
    assert detail["versions"][0]["status"] == "formal"

    _pass_qc(client, admin, asset["id"])
    blocked_auth = _formalize(client, admin, asset["id"])
    assert blocked_auth.status_code == 409, blocked_auth.text
    assert blocked_auth.json()["error"]["code"] == "ASSET_AUTH_NOT_CLEARED"
    _clear_authorization(client, admin, asset["id"])
    released = _formalize(client, admin, asset["id"])
    assert released.status_code == 200, released.text
    body = released.json()["data"]
    assert body["version"]["status"] == "formal"
    assert body["asset"]["formal_version_id"] == version_two["id"]

    detail = client.get(f"/api/v1/assets/{asset['id']}", headers=admin["headers"]).json()["data"]
    statuses = [version["status"] for version in detail["versions"]]
    assert statuses == ["superseded", "formal"]


def test_rejected_asset_can_be_rechecked_then_formalized(client, admin, tmp_path):
    project = _project(client, admin)
    _, _, asset = _direct_upload(
        client, admin, project["record_id"], _png(tmp_path, "reject.png", color="yellow")
    )

    rejected = client.post(
        f"/api/v1/assets/{asset['id']}/qc",
        headers=admin["headers"],
        json={"result": "拒绝", "note": "画面有摩尔纹"},
    )
    assert rejected.status_code == 201, rejected.text
    assert rejected.json()["data"]["asset"]["status"] == "rejected"
    assert rejected.json()["data"]["check"]["result"] == "failed"

    blocked = _formalize(client, admin, asset["id"])
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "ASSET_QC_NOT_PASSED"

    assert _pass_qc(client, admin, asset["id"])["asset"]["status"] == "qc_passed"
    _clear_authorization(client, admin, asset["id"])
    released = _formalize(client, admin, asset["id"])
    assert released.status_code == 200, released.text
    assert released.json()["data"]["asset"]["status"] == "formal"


def test_reference_count_is_idempotent_and_decrements_on_delete(client, admin, tmp_path):
    project = _project(client, admin)
    _, _, asset = _direct_upload(
        client, admin, project["record_id"], _png(tmp_path, "ref.png", color="orange")
    )
    ref_id = str(uuid.uuid4())

    first = client.post(
        f"/api/v1/assets/{asset['id']}/references",
        headers=admin["headers"],
        json={"ref_type": "shot", "ref_id": ref_id, "note": "E01 镜头 3"},
    )
    assert first.status_code == 201, first.text
    assert first.json()["data"]["reference_count"] == 1

    duplicate = client.post(
        f"/api/v1/assets/{asset['id']}/references",
        headers=admin["headers"],
        json={"ref_type": "shot", "ref_id": ref_id},
    )
    assert duplicate.status_code == 201, duplicate.text
    assert duplicate.json()["data"]["reference_count"] == 1

    listing = client.get(
        f"/api/v1/assets/{asset['id']}/references", headers=admin["headers"]
    ).json()["data"]
    assert listing["reference_count"] == 1
    assert [item["ref_id"] for item in listing["items"]] == [ref_id]

    reference_id = listing["items"][0]["id"]
    removed = client.delete(
        f"/api/v1/assets/{asset['id']}/references/{reference_id}", headers=admin["headers"]
    )
    assert removed.status_code == 200, removed.text
    assert removed.json()["data"]["reference_count"] == 0

    detail = client.get(f"/api/v1/assets/{asset['id']}", headers=admin["headers"]).json()["data"]
    assert detail["reference_count"] == 0
    assert detail["references"] == []


def test_direct_upload_rejects_bad_token_and_oversized_payload(client, admin, tmp_path):
    project = _project(client, admin)
    data = _png(tmp_path, "limit.png")
    created = client.post(
        f"/api/v1/projects/{project['record_id']}/asset-uploads",
        headers=admin["headers"],
        json={"filename": "limit.png", "mime_type": "image/png", "max_bytes": len(data)},
    ).json()["data"]
    parts = urlsplit(created["upload_url"])

    bad_token = client.put(
        f"{parts.path}?token=not-the-token", content=data, headers={"Content-Type": "image/png"}
    )
    assert bad_token.status_code == 403, bad_token.text
    assert bad_token.json()["error"]["code"] == "UPLOAD_TOKEN_INVALID"

    too_large = client.put(
        f"{parts.path}?{parts.query}", content=data + b"x", headers={"Content-Type": "image/png"}
    )
    assert too_large.status_code == 413, too_large.text
    assert too_large.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_complete_rejects_checksum_mismatch_and_replay(client, admin, tmp_path):
    project = _project(client, admin)
    data = _png(tmp_path, "checksum.png")
    created = client.post(
        f"/api/v1/projects/{project['record_id']}/asset-uploads",
        headers=admin["headers"],
        json={"filename": "checksum.png", "mime_type": "image/png", "max_bytes": len(data) + 1},
    ).json()["data"]
    parts = urlsplit(created["upload_url"])
    put = client.put(
        f"{parts.path}?{parts.query}", content=data, headers={"Content-Type": "image/png"}
    )
    assert put.status_code == 200, put.text

    mismatched = client.post(
        f"/api/v1/projects/{project['record_id']}/asset-uploads/{created['upload_id']}/complete",
        headers=admin["headers"],
        json={"checksum": "0" * 64},
    )
    assert mismatched.status_code == 409, mismatched.text
    assert mismatched.json()["error"]["code"] == "UPLOAD_CHECKSUM_MISMATCH"

    completed = client.post(
        f"/api/v1/projects/{project['record_id']}/asset-uploads/{created['upload_id']}/complete",
        headers=admin["headers"],
        json={"checksum": put.json()["data"]["checksum"]},
    )
    assert completed.status_code == 201, completed.text

    replay = client.post(
        f"/api/v1/projects/{project['record_id']}/asset-uploads/{created['upload_id']}/complete",
        headers=admin["headers"],
        json={},
    )
    assert replay.status_code == 409, replay.text
    assert replay.json()["error"]["code"] == "UPLOAD_ALREADY_COMPLETED"
