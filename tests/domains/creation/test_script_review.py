"""B-04 acceptance: review and project transition commit together, only once."""

import uuid

from sqlalchemy import func, select

from app.domains.audit.models import AuditLog
from app.domains.creation.models import ScriptReview
from app.domains.projects.models import ProjectTransition


def _create_project(client, admin, code):
    response = client.post(
        "/api/v1/projects",
        headers=admin["headers"],
        json={"code": code, "title": f"Project {code}", "summary": "pilot"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _transition(client, admin, project_id, action, **extra):
    body = {"action": action, **extra}
    response = client.post(
        f"/api/v1/projects/{project_id}/transitions", headers=admin["headers"], json=body
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]


def _script_ready_for_review(client, admin, code):
    project = _create_project(client, admin, code)
    for action in ("start", "confirmBrief", "submitScript"):
        _transition(client, admin, project["id"], action)

    episode = client.post(
        f"/api/v1/projects/{project['id']}/episodes",
        headers=admin["headers"],
        json={"episode_number": 1, "title": "第一集", "synopsis": ""},
    )
    assert episode.status_code == 201, episode.text
    episode_id = episode.json()["data"]["id"]

    script = client.post(
        f"/api/v1/episodes/{episode_id}/scripts",
        headers=admin["headers"],
        json={"title": "第一集剧本"},
    )
    assert script.status_code == 201, script.text
    script_id = script.json()["data"]["id"]

    version = client.post(
        f"/api/v1/scripts/{script_id}/versions",
        headers=admin["headers"],
        json={"content": "场景一：夜，外景。"},
    )
    assert version.status_code == 201, version.text
    return project, script_id, version.json()["data"]


def _review(client, admin, version_id, **body):
    return client.post(
        f"/api/v1/script-versions/{version_id}/reviews",
        headers=admin["headers"],
        json=body,
    )


def test_approve_reviews_script_and_moves_project_once(client, admin, db_session):
    project, script_id, version = _script_ready_for_review(
        client, admin, f"review-{uuid.uuid4().hex[:6]}"
    )
    response = _review(client, admin, version["id"], decision="approve")
    assert response.status_code == 201, response.text
    data = response.json()["data"]
    assert data["review"]["decision"] == "approve"
    assert data["transition"]["project"]["status"] == "生产准备中"

    project_after = client.get(f"/api/v1/projects/{project['id']}", headers=admin["headers"])
    assert project_after.json()["data"]["status"] == "生产准备中"

    versions = client.get(f"/api/v1/scripts/{script_id}/versions", headers=admin["headers"])
    assert versions.json()["data"][0]["status"] == "approved"

    reviews = client.get(f"/api/v1/scripts/{script_id}/reviews", headers=admin["headers"])
    assert len(reviews.json()["data"]) == 1

    repeat = _review(client, admin, version["id"], decision="approve")
    assert repeat.status_code == 409
    assert repeat.json()["error"]["code"] == "REVIEW_ALREADY_DECIDED"

    assert (
        db_session.scalar(
            select(func.count(ScriptReview.id)).where(
                ScriptReview.script_version_id == uuid.UUID(version["id"])
            )
        )
        == 1
    )
    transitions = db_session.scalars(
        select(ProjectTransition).where(
            ProjectTransition.project_id == uuid.UUID(project["id"]),
            ProjectTransition.action == "approveScript",
        )
    ).all()
    assert len(transitions) == 1


def test_reject_missing_reason_rolls_back_every_write(client, admin, db_session):
    project, script_id, version = _script_ready_for_review(
        client, admin, f"reject-{uuid.uuid4().hex[:6]}"
    )
    response = _review(client, admin, version["id"], decision="reject")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "REASON_REQUIRED"

    # The whole request rolled back: no review row, script still draft, project unmoved.
    assert (
        db_session.scalar(
            select(func.count(ScriptReview.id)).where(
                ScriptReview.script_version_id == uuid.UUID(version["id"])
            )
        )
        == 0
    )
    project_after = client.get(f"/api/v1/projects/{project['id']}", headers=admin["headers"])
    assert project_after.json()["data"]["status"] == "待剧本审核"
    versions = client.get(f"/api/v1/scripts/{script_id}/versions", headers=admin["headers"])
    assert versions.json()["data"][0]["status"] == "draft"
    assert (
        db_session.scalar(
            select(func.count(AuditLog.id)).where(
                AuditLog.action == "project.transition.rejectScript",
                AuditLog.resource_id == project["id"],
            )
        )
        == 0
    )

    ok = _review(client, admin, version["id"], decision="reject", reason="人物动机不足")
    assert ok.status_code == 201, ok.text
    assert ok.json()["data"]["transition"]["project"]["status"] == "剧本创作中"
    versions_after = client.get(f"/api/v1/scripts/{script_id}/versions", headers=admin["headers"])
    assert versions_after.json()["data"][0]["status"] == "rejected"


def test_review_requires_script_review_permission_and_membership(client, admin):
    project, _, version = _script_ready_for_review(
        client, admin, f"review-perm-{uuid.uuid4().hex[:6]}"
    )
    creator = client.post(
        "/api/v1/users",
        headers=admin["headers"],
        json={
            "email": f"reviewer-{uuid.uuid4().hex[:8]}@example.com",
            "full_name": "Reviewer",
            "password": "ReviewerPassword1",
            "role_ids": [],
        },
    )
    assert creator.status_code == 201, creator.text
    user_id = creator.json()["data"]["id"]
    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": creator.json()["data"]["email"],
            "password": "ReviewerPassword1",
        },
    )
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

    denied_non_member = client.post(
        f"/api/v1/script-versions/{version['id']}/reviews",
        headers=headers,
        json={"decision": "approve"},
    )
    assert denied_non_member.status_code == 403

    added = client.post(
        f"/api/v1/projects/{project['id']}/members",
        headers=admin["headers"],
        json={"user_id": user_id, "project_role": "reviewer"},
    )
    assert added.status_code == 201, added.text

    # Member but the role carries no script.review code.
    denied_by_permission = client.post(
        f"/api/v1/script-versions/{version['id']}/reviews",
        headers=headers,
        json={"decision": "approve"},
    )
    assert denied_by_permission.status_code == 403
    assert denied_by_permission.json()["error"]["code"] == "PERMISSION_DENIED"
