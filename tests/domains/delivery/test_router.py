"""B-08 acceptance: freeze, outputs, final review and immutable delivery package."""

import hashlib
import subprocess
import uuid
from pathlib import Path

from app.domains.delivery.models import DeliveryPackage
from app.domains.projects.models import Project
from app.infrastructure import storage
from app.infrastructure.media import MediaBinaries


def _project(client, admin, db_session, episodes=2) -> dict:
    response = client.post(
        "/api/v1/projects",
        headers=admin["headers"],
        json={
            "code": f"del-{uuid.uuid4().hex[:6]}",
            "name": "Delivery Pilot",
            "episodes": episodes,
            "ratio": "9:16",
            "duration": "90 秒",
        },
    )
    assert response.status_code == 201, response.text
    project = response.json()["data"]
    row = db_session.get(Project, uuid.UUID(project["record_id"]))
    row.status = "后期制作中"
    db_session.commit()
    return project


def _timeline(client, admin, project_id, episode_number):
    payload = {
        "episode_number": episode_number,
        "timebase": 25,
        "duration_ms": 90000,
        "tracks": [
            {"name": "V1", "items": [{"label": f"E{episode_number}-S01", "w": 30}]},
            {"name": "A1", "items": [{"label": f"E{episode_number}-A01", "w": 30}]},
        ],
        "note": "post timeline",
    }
    response = client.post(
        f"/api/v1/projects/{project_id}/timelines", headers=admin["headers"], json=payload
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _freeze(client, admin, timeline_id):
    response = client.post(f"/api/v1/timelines/{timeline_id}/freeze", headers=admin["headers"])
    assert response.status_code == 200, response.text
    return response.json()["data"]


def _video(tmp_path: Path, name: str) -> bytes:
    binaries = MediaBinaries()
    target = tmp_path / name
    subprocess.run(  # noqa: S603 - fixed binary, no shell
        [
            binaries.require_ffmpeg(),
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=blue:s=160x90",
            "-t",
            "1",
            "-r",
            "25",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(target),
        ],
        check=True,
        capture_output=True,
    )
    return target.read_bytes()


def _upload_video(client, admin, project_id, tmp_path, episode_number):
    response = client.post(
        f"/api/v1/projects/{project_id}/assets",
        headers=admin["headers"],
        files={
            "file": (
                f"EP{episode_number}.mp4",
                _video(tmp_path, f"ep{episode_number}.mp4"),
                "video/mp4",
            )
        },
        data={"title": f"EP{episode_number}"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _output(client, admin, project_id, episode_number, timeline_id, asset_id):
    return client.post(
        f"/api/v1/projects/{project_id}/episodes/{episode_number}/outputs",
        headers=admin["headers"],
        json={"timeline_version_id": timeline_id, "asset_id": asset_id, "note": "output"},
    )


def _quality_pass(client, admin, db_session, project):
    row = db_session.get(Project, uuid.UUID(project["record_id"]))
    row.status = "质量检测中"
    db_session.commit()
    report = client.post(
        f"/api/v1/projects/{project['record_id']}/quality/runs",
        headers=admin["headers"],
        json={"level": "整剧级", "version": "SERIES v1", "object": "whole series"},
    )
    assert report.status_code == 201, report.text
    transition = client.post(
        f"/api/v1/projects/{project['record_id']}/transitions",
        headers=admin["headers"],
        json={"action": "passQc"},
    )
    assert transition.status_code == 200, transition.text
    return report.json()["data"]


def _final_approve(client, admin, project_id, note="final ok"):
    response = client.post(
        f"/api/v1/projects/{project_id}/reviews",
        headers=admin["headers"],
        json={"result": "通过", "note": note},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _prepare_complete_project(client, admin, db_session, tmp_path):
    project = _project(client, admin, db_session)
    timelines = []
    assets = []
    outputs = []
    for episode in (1, 2):
        timeline = _timeline(client, admin, project["record_id"], episode)
        timeline = _freeze(client, admin, timeline["record_id"])
        timelines.append(timeline)
        asset = _upload_video(client, admin, project["record_id"], tmp_path, episode)
        assets.append(asset)
        output = _output(
            client, admin, project["record_id"], episode, timeline["record_id"], asset["id"]
        )
        assert output.status_code == 201, output.text
        outputs.append(output.json()["data"])
    _quality_pass(client, admin, db_session, project)
    review = _final_approve(client, admin, project["record_id"])
    return project, timelines, assets, outputs, review


def test_timeline_freeze_is_idempotent_and_history_is_preserved(client, admin, db_session):
    project = _project(client, admin, db_session)
    first = _timeline(client, admin, project["record_id"], 1)
    assert first["status"] == "编辑中"
    frozen = _freeze(client, admin, first["record_id"])
    assert frozen["status"] == "已冻结"
    assert frozen["checksum"] == first["checksum"]
    assert frozen["trackItems"] == first["trackItems"]

    again = _freeze(client, admin, first["record_id"])
    assert again["status"] == "已冻结"
    assert again["frozenAt"] == frozen["frozenAt"]

    second = _timeline(client, admin, project["record_id"], 1)
    assert second["versionNumber"] == 2
    old = client.get(f"/api/v1/timelines/{first['record_id']}", headers=admin["headers"])
    assert old.status_code == 200
    assert old.json()["data"]["status"] == "已冻结"
    assert old.json()["data"]["checksum"] == frozen["checksum"]
    assert old.json()["data"]["trackItems"] == frozen["trackItems"]


def test_output_requires_a_frozen_timeline_and_is_unique(client, admin, db_session, tmp_path):
    project = _project(client, admin, db_session)
    timeline = _timeline(client, admin, project["record_id"], 1)
    asset = _upload_video(client, admin, project["record_id"], tmp_path, 1)

    rejected = _output(client, admin, project["record_id"], 1, timeline["record_id"], asset["id"])
    assert rejected.status_code == 409, rejected.text
    assert rejected.json()["error"]["code"] == "TIMELINE_NOT_FROZEN"

    frozen = _freeze(client, admin, timeline["record_id"])
    created = _output(client, admin, project["record_id"], 1, frozen["record_id"], asset["id"])
    assert created.status_code == 201, created.text
    output = created.json()["data"]
    assert output["status"] == "已输出"
    assert output["timeline"] == frozen["version"]
    assert output["checksum"] == asset["checksum"]

    duplicate = _output(client, admin, project["record_id"], 1, frozen["record_id"], asset["id"])
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "OUTPUT_ALREADY_EXISTS"

    row = db_session.get(Project, uuid.UUID(project["record_id"]))
    assert row.done_episodes == 1


def test_final_review_requires_quality_pass_and_rolls_back_on_reject(
    client, admin, db_session
):
    project = _project(client, admin, db_session)
    row = db_session.get(Project, uuid.UUID(project["record_id"]))
    row.status = "待最终审核"
    db_session.commit()

    missing = client.post(
        f"/api/v1/projects/{project['record_id']}/reviews",
        headers=admin["headers"],
        json={"result": "通过", "note": "no report"},
    )
    assert missing.status_code == 409
    assert missing.json()["error"]["code"] == "FINAL_REVIEW_QUALITY_NOT_PASSED"

    _quality_pass(client, admin, db_session, project)
    rejected = client.post(
        f"/api/v1/projects/{project['record_id']}/reviews",
        headers=admin["headers"],
        json={"result": "退回", "note": "need recut"},
    )
    assert rejected.status_code == 201, rejected.text
    assert rejected.json()["data"]["result"] == "退回"
    refreshed = client.get(
        f"/api/v1/projects/{project['record_id']}", headers=admin["headers"]
    ).json()["data"]
    assert refreshed["status"] == "后期制作中"


def test_delivery_is_blocked_until_the_required_checklist_is_ready(client, admin, db_session):
    project = _project(client, admin, db_session)
    not_complete = client.post(
        f"/api/v1/projects/{project['record_id']}/deliveries",
        headers=admin["headers"],
        json={"receiver": "企业内容库"},
    )
    assert not_complete.status_code == 409
    assert not_complete.json()["error"]["code"] == "DELIVERY_PROJECT_NOT_COMPLETED"

    row = db_session.get(Project, uuid.UUID(project["record_id"]))
    row.status = "已完成"
    db_session.commit()
    checklist = client.get(
        f"/api/v1/projects/{project['record_id']}/delivery-checklist",
        headers=admin["headers"],
    )
    assert checklist.status_code == 200
    assert checklist.json()["meta"]["ready"] is False

    incomplete = client.post(
        f"/api/v1/projects/{project['record_id']}/deliveries",
        headers=admin["headers"],
        json={"receiver": "企业内容库"},
    )
    assert incomplete.status_code == 409
    assert incomplete.json()["error"]["code"] == "DELIVERY_CHECKLIST_INCOMPLETE"


def test_delivery_freezes_a_checksummed_package_and_cannot_be_overwritten(
    client, admin, db_session, tmp_path
):
    project, timelines, assets, outputs, review = _prepare_complete_project(
        client, admin, db_session, tmp_path
    )
    checklist = client.get(
        f"/api/v1/projects/{project['record_id']}/delivery-checklist",
        headers=admin["headers"],
    )
    assert checklist.status_code == 200
    assert checklist.json()["meta"]["ready"] is True

    delivered = client.post(
        f"/api/v1/projects/{project['record_id']}/deliveries",
        headers=admin["headers"],
        json={"receiver": "企业内容库", "note": "final package"},
    )
    assert delivered.status_code == 201, delivered.text
    package = delivered.json()["data"]
    assert package["status"] == "已冻结"
    assert package["frozen"] is True
    assert package["episodes"] == 2
    assert package["files"] == 2
    assert len(package["checksum"]) == 64
    assert [item["episode"] for item in package["manifest"]["items"]] == [1, 2]

    download = client.get(
        f"/api/v1/deliveries/{package['record_id']}/download", headers=admin["headers"]
    )
    assert download.status_code == 200
    assert hashlib.sha256(download.content).hexdigest() == package["checksum"]
    assert b"manifest.json" in download.content

    refreshed = client.get(
        f"/api/v1/projects/{project['record_id']}", headers=admin["headers"]
    ).json()["data"]
    assert refreshed["status"] == "已交付"
    assert refreshed["delivered"] == 2

    second = client.post(
        f"/api/v1/projects/{project['record_id']}/deliveries",
        headers=admin["headers"],
        json={"receiver": "企业内容库"},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "DELIVERY_ALREADY_FROZEN"

    late_timeline = client.post(
        f"/api/v1/projects/{project['record_id']}/timelines",
        headers=admin["headers"],
        json={
            "episode_number": 1,
            "timebase": 25,
            "duration_ms": 90000,
            "tracks": [{"name": "V1", "items": []}],
        },
    )
    assert late_timeline.status_code == 409
    frozen = client.get(f"/api/v1/timelines/{timelines[0]['record_id']}", headers=admin["headers"])
    assert frozen.json()["data"]["status"] == "已冻结"
    assert frozen.json()["data"]["checksum"] == timelines[0]["checksum"]


def test_download_detects_a_tampered_package(client, admin, db_session, tmp_path):
    project, *_ = _prepare_complete_project(client, admin, db_session, tmp_path)
    package = client.post(
        f"/api/v1/projects/{project['record_id']}/deliveries",
        headers=admin["headers"],
        json={"receiver": "企业内容库"},
    ).json()["data"]
    row = db_session.get(DeliveryPackage, uuid.UUID(package["record_id"]))
    target = storage.path_of(row.storage_key)
    target.write_bytes(b"corrupted")
    rejected = client.get(
        f"/api/v1/deliveries/{package['record_id']}/download", headers=admin["headers"]
    )
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "DELIVERY_CHECKSUM_MISMATCH"
