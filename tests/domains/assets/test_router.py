import shutil
import subprocess
import uuid
from pathlib import Path

import pytest

from app.infrastructure.media import MediaBinaries


def _png(tmp_path: Path, name: str, color: str = "red", size: str = "320x240") -> bytes:
    binaries = MediaBinaries()
    target = tmp_path / name
    subprocess.run(  # noqa: S603 - fixed binary, no shell
        [
            binaries.require_ffmpeg(),
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"color=c={color}:s={size}",
            "-frames:v",
            "1",
            str(target),
        ],
        check=True,
        capture_output=True,
    )
    return target.read_bytes()


def _project(client, admin) -> dict:
    response = client.post(
        "/api/v1/projects",
        headers=admin["headers"],
        json={"code": f"asset-{uuid.uuid4().hex[:6]}", "title": "Asset Pilot"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _upload(client, admin, project_id, data: bytes, filename="frame.png", mime="image/png"):
    return client.post(
        f"/api/v1/projects/{project_id}/assets",
        headers=admin["headers"],
        files={"file": (filename, data, mime)},
        data={"title": filename},
    )


def test_upload_records_metadata_and_keeps_body_out_of_the_database(client, admin, tmp_path):
    assert shutil.which(MediaBinaries().ffprobe or "") is not None
    project = _project(client, admin)
    payload = _png(tmp_path, "red.png")
    response = _upload(client, admin, project["id"], payload)
    assert response.status_code == 201, response.text
    asset = response.json()["data"]
    assert asset["kind"] == "image"
    assert asset["mime_type"] == "image/png"
    assert asset["size_bytes"] == len(payload)
    assert len(asset["checksum"]) == 64
    assert asset["width"] == 320
    assert asset["height"] == 240
    assert asset["storage_key"].startswith(f"assets/{project['id']}/")

    listing = client.get(f"/api/v1/projects/{project['id']}/assets", headers=admin["headers"])
    assert listing.status_code == 200
    assert [row["id"] for row in listing.json()["data"]] == [asset["id"]]


def test_download_returns_the_stored_bytes(client, admin, tmp_path):
    project = _project(client, admin)
    payload = _png(tmp_path, "blue.png", color="blue")
    asset = _upload(client, admin, project["id"], payload).json()["data"]
    response = client.get(f"/api/v1/assets/{asset['id']}/download", headers=admin["headers"])
    assert response.status_code == 200
    assert response.content == payload


def test_new_version_is_numbered_and_tracked(client, admin, tmp_path):
    project = _project(client, admin)
    asset = _upload(client, admin, project["id"], _png(tmp_path, "a.png")).json()["data"]
    second = _png(tmp_path, "b.png", color="green")
    response = client.post(
        f"/api/v1/assets/{asset['id']}/versions",
        headers=admin["headers"],
        files={"file": ("b.png", second, "image/png")},
        data={"note": "retake"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["data"]["version_number"] == 2

    detail = client.get(f"/api/v1/assets/{asset['id']}", headers=admin["headers"]).json()["data"]
    assert [version["version_number"] for version in detail["versions"]] == [1, 2]
    assert detail["versions"][1]["note"] == "retake"


def test_slideshow_export_produces_a_verified_mp4_asset(client, admin, tmp_path):
    project = _project(client, admin)
    first = _upload(client, admin, project["id"], _png(tmp_path, "one.png", color="red")).json()[
        "data"
    ]
    second = _upload(client, admin, project["id"], _png(tmp_path, "two.png", color="blue")).json()[
        "data"
    ]

    response = client.post(
        f"/api/v1/projects/{project['id']}/exports",
        headers=admin["headers"],
        json={
            "asset_ids": [first["id"], second["id"]],
            "width": 320,
            "height": 240,
            "fps": 25,
            "seconds_per_image": 1.0,
            "title": "Pilot export",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()["data"]
    assert body["job"]["status"] == "succeeded"
    video = body["asset"]
    assert video["kind"] == "video"
    assert video["mime_type"] == "video/mp4"
    assert video["size_bytes"] > 0
    assert video["duration_ms"] == pytest.approx(2000, abs=250)
    assert video["width"] == 320
    assert video["height"] == 240

    download = client.get(f"/api/v1/assets/{video['id']}/download", headers=admin["headers"])
    assert download.status_code == 200
    assert download.content[4:12] == b"ftypisom" or b"ftyp" in download.content[:16]


def test_export_rejects_non_image_assets(client, admin, tmp_path):
    project = _project(client, admin)
    document = _upload(
        client, admin, project["id"], b"plain text", filename="notes.txt", mime="text/plain"
    ).json()["data"]
    assert document["kind"] == "document"
    response = client.post(
        f"/api/v1/projects/{project['id']}/exports",
        headers=admin["headers"],
        json={"asset_ids": [document["id"]]},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_upload_is_denied_for_non_project_members(client, admin, tmp_path):
    project = _project(client, admin)
    role = client.post(
        "/api/v1/roles",
        headers=admin["headers"],
        json={"code": "asset-outsider", "name": "Outsider", "permissions": ["projects:read"]},
    ).json()["data"]
    email = f"asset-outsider-{uuid.uuid4().hex[:8]}@example.com"
    password = "MemberPassword1"
    created = client.post(
        "/api/v1/users",
        headers=admin["headers"],
        json={
            "email": email,
            "full_name": "Outsider",
            "password": password,
            "role_ids": [role["id"]],
        },
    )
    assert created.status_code == 201, created.text
    token = client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()[
        "data"
    ]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    denied = client.post(
        f"/api/v1/projects/{project['id']}/assets",
        headers=headers,
        files={"file": ("frame.png", _png(tmp_path, "deny.png"), "image/png")},
    )
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"
