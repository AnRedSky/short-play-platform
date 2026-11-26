"""B-07 acceptance: rule catalog, reports and blocker rollback."""

import uuid

from sqlalchemy import select

from app.domains.projects.models import Project, ProjectTransition


def _project_in_quality(client, admin, db_session) -> dict:
    response = client.post(
        "/api/v1/projects",
        headers=admin["headers"],
        json={"code": f"qc-{uuid.uuid4().hex[:6]}", "name": "Quality Pilot", "budget": 100},
    )
    assert response.status_code == 201, response.text
    project = response.json()["data"]
    row = db_session.get(Project, uuid.UUID(project["record_id"]))
    row.status = "质量检测中"
    db_session.commit()
    return project


def _run(client, admin, project_id, **overrides):
    body = {"level": "单集级", "version": "EP17 v1", "note": "QC run"}
    body.update(overrides)
    return client.post(
        f"/api/v1/projects/{project_id}/quality/runs", headers=admin["headers"], json=body
    )


def test_blocking_issue_rolls_project_back_to_post_and_is_traceable(
    client, admin, db_session
):
    project = _project_in_quality(client, admin, db_session)
    response = _run(
        client,
        admin,
        project["record_id"],
        checks=[
            {
                "rule_code": "Q-E01",
                "status": "FAIL",
                "location": "E17 03:12",
                "note": "第 17 集结尾跳接",
            }
        ],
    )
    assert response.status_code == 201, response.text
    report = response.json()["data"]
    assert report["result"] == "FAIL"
    assert report["fail"] == 1
    assert report["issues"] == 1
    assert report["items"] == 4
    assert report["id"].startswith(f"QR-{project['id']}-")

    refreshed = client.get(
        f"/api/v1/projects/{project['record_id']}", headers=admin["headers"]
    ).json()["data"]
    assert refreshed["status"] == "后期制作中"

    transition = db_session.scalar(
        select(ProjectTransition).where(
            ProjectTransition.project_id == uuid.UUID(project["record_id"])
        )
    )
    assert transition is not None
    assert transition.action == "failQc"
    assert transition.from_status == "质量检测中"
    assert transition.to_status == "后期制作中"
    assert "阻断项" in transition.reason

    issue = client.get(
        f"/api/v1/quality-issues?report={report['id']}", headers=admin["headers"]
    ).json()["data"][0]
    assert issue["blocking"] is True
    assert issue["level"] == "高"
    assert issue["where"] == "E17 03:12"
    assert issue["report"] == report["id"]


def test_review_item_does_not_roll_back_the_project(client, admin, db_session):
    project = _project_in_quality(client, admin, db_session)
    response = _run(
        client,
        admin,
        project["record_id"],
        checks=[{"rule_code": "Q-E02", "status": "REVIEW_REQUIRED", "location": "E17 字幕"}],
    )
    assert response.status_code == 201, response.text
    report = response.json()["data"]
    assert report["result"] == "REVIEW_REQUIRED"
    assert report["review"] == 1
    assert report["fail"] == 0

    refreshed = client.get(
        f"/api/v1/projects/{project['record_id']}", headers=admin["headers"]
    ).json()["data"]
    assert refreshed["status"] == "质量检测中"

    issue = client.get(
        f"/api/v1/quality-issues?report={report['id']}", headers=admin["headers"]
    ).json()["data"][0]
    assert issue["blocking"] is False


def test_whole_series_pass_uses_the_seeded_rule_set(client, admin, db_session):
    project = _project_in_quality(client, admin, db_session)
    response = _run(
        client,
        admin,
        project["record_id"],
        level="整剧级",
        version="SERIES v1",
        object="SP 全剧 24 集",
    )
    assert response.status_code == 201, response.text
    report = response.json()["data"]
    assert report["result"] == "PASS"
    assert report["items"] == 4
    assert report["issues"] == 0
    assert report["level"] == "整剧级"

    rules = client.get("/api/v1/quality/rules?level=整剧级", headers=admin["headers"])
    assert rules.status_code == 200, rules.text
    assert [row["code"] for row in rules.json()["data"]] == [
        "Q-W01",
        "Q-W02",
        "Q-W03",
        "Q-W04",
    ]

    levels = client.get("/api/v1/quality-levels", headers=admin["headers"])
    assert levels.status_code == 200
    assert {row["level"] for row in levels.json()["data"]} == {
        "资产级",
        "镜头级",
        "单集级",
        "整剧级",
    }


def test_rule_from_another_level_is_rejected(client, admin, db_session):
    project = _project_in_quality(client, admin, db_session)
    response = _run(
        client,
        admin,
        project["record_id"],
        level="单集级",
        checks=[{"rule_code": "Q-W01", "status": "FAIL"}],
    )
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "QUALITY_RULE_UNKNOWN"


def test_report_list_is_scoped_and_filterable(client, admin, db_session):
    project = _project_in_quality(client, admin, db_session)
    first = _run(client, admin, project["record_id"], level="资产级")
    assert first.status_code == 201, first.text
    second = _run(client, admin, project["record_id"], level="镜头级")
    assert second.status_code == 201, second.text

    listed = client.get(
        f"/api/v1/quality-reports?project={project['id']}&level=镜头级",
        headers=admin["headers"],
    )
    assert listed.status_code == 200, listed.text
    rows = listed.json()["data"]
    assert len(rows) == 1
    assert rows[0]["id"] == second.json()["data"]["id"]
    assert rows[0]["project"] == project["id"]


def test_quality_requires_project_in_check_state(client, admin, db_session):
    response = client.post(
        "/api/v1/projects",
        headers=admin["headers"],
        json={"code": f"qc-state-{uuid.uuid4().hex[:6]}", "name": "Not in QC"},
    )
    project = response.json()["data"]
    rejected = _run(client, admin, project["record_id"])
    assert rejected.status_code == 409, rejected.text
    assert rejected.json()["error"]["code"] == "QUALITY_PROJECT_NOT_IN_CHECK"
