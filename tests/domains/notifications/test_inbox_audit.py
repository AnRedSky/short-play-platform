"""B-11 acceptance: notification merge/read links and immutable audit trail."""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.domains.audit.models import AuditLog, AuditLogImmutableError
from app.domains.notifications import service as notifications_service
from app.domains.users.models import User
from app.utils.datetime import utcnow


def _admin_id(db, admin) -> uuid.UUID:
    return db.scalar(select(User.id).where(User.email == admin["email"]))


def _create_project(client, admin, code: str | None = None) -> dict:
    code = code or f"n-{uuid.uuid4().hex[:6]}"
    response = client.post(
        "/api/v1/projects",
        headers=admin["headers"],
        json={"code": code, "title": f"Notify {code}", "summary": "notification test"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _transition(client, admin, project_id: str, action: str, **body):
    return client.post(
        f"/api/v1/projects/{project_id}/transitions",
        headers=admin["headers"],
        json={"action": action, **body},
    )


def test_unread_notification_merges_same_object_and_marks_read(client, admin, db_session):
    project = _create_project(client, admin)
    organization_id = uuid.UUID(admin["organization_id"])
    project_id = uuid.UUID(project["record_id"])
    recipient = _admin_id(db_session, admin)

    first = notifications_service.merge_notification(
        db_session,
        organization_id=organization_id,
        recipient_user_id=recipient,
        notification_type="待剧本审核",
        title="第一集剧本待审核",
        link=f"creation/review?project={project['id']}",
        object_type="script_review",
        object_key=f"project:{project_id}:script_review",
        project_id=project_id,
        impact="审核前阻塞生产",
        action_hint="预览并审核",
        at=utcnow() - timedelta(minutes=3),
    )
    flush = db_session.flush()
    assert flush is None
    first_id = first.id

    second = notifications_service.merge_notification(
        db_session,
        organization_id=organization_id,
        recipient_user_id=recipient,
        notification_type="待剧本审核",
        title="第一集剧本再次送审",
        link=f"creation/review?project={project['id']}",
        object_type="script_review",
        object_key=f"project:{project_id}:script_review",
        project_id=project_id,
    )
    assert second.id == first_id
    assert second.merge_count == 2
    assert second.title == "第一集剧本再次送审"
    assert second.unread is True

    response = client.get(
        "/api/v1/notifications",
        headers=admin["headers"],
        params={"limit": 10, "project": project["id"]},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["meta"]["total"] == 1
    row = body["data"][0]
    assert row["merge_count"] == 2
    assert row["link"].startswith("creation/review?project=")
    assert row["project"] == project["id"]
    assert row["unread"] is True

    read = client.post(f"/api/v1/notifications/{row['id']}/read", headers=admin["headers"])
    assert read.status_code == 200, read.text
    assert read.json()["data"]["unread"] is False
    assert read.json()["data"]["read_at"]

    refreshed = client.get("/api/v1/notifications", headers=admin["headers"])
    assert refreshed.json()["data"][0]["unread"] is False

    notifications_service.merge_notification(
        db_session,
        organization_id=organization_id,
        recipient_user_id=recipient,
        notification_type="待剧本审核",
        title="第三次送审",
        link=f"creation/review?project={project['id']}",
        object_type="script_review",
        object_key=f"project:{project_id}:script_review",
        project_id=project_id,
    )
    db_session.flush()
    read_all = client.post("/api/v1/notifications/read-all", headers=admin["headers"])
    assert read_all.status_code == 200, read_all.text
    assert read_all.json()["data"]["updated"] == 1


def test_project_gate_transition_creates_linked_notification(client, admin):
    project = _create_project(client, admin)
    for action in ("start", "confirmBrief", "submitScript"):
        response = _transition(client, admin, project["record_id"], action)
        assert response.status_code == 200, response.text

    inbox = client.get(
        "/api/v1/notifications",
        headers=admin["headers"],
        params={"type": "待剧本审核", "project": project["id"]},
    )
    assert inbox.status_code == 200, inbox.text
    rows = inbox.json()["data"]
    assert len(rows) == 1
    row = rows[0]
    assert row["link"] == f"creation/review?project={project['id']}"
    assert row["reason"]
    assert row["object_key"].endswith(f"{project['record_id']}:script_review")
    assert row["action"] == "逐集预览后通过或退回"


def test_audit_log_has_page_aliases_and_rejects_update(client, admin, db_session):
    response = client.get("/api/v1/audit-logs", headers=admin["headers"])
    assert response.status_code == 200, response.text
    rows = response.json()["data"]
    assert rows
    assert {"time", "actor", "object", "src"} <= set(rows[0])
    assert rows[0]["actor"] == "Admin"
    assert rows[0]["result"] in {"成功", "失败"}
    assert rows[0]["result_code"] in {"success", "failure"}

    audit_id = db_session.scalar(select(AuditLog.id).limit(1))
    with pytest.raises(DBAPIError, match="append-only"):
        db_session.execute(
            text("UPDATE audit_logs SET action = 'tampered' WHERE id = :id"),
            {"id": audit_id},
        )
    db_session.rollback()


def test_orm_rejects_audit_update_and_delete(client, admin, db_session):
    client.get("/api/v1/audit-logs", headers=admin["headers"])
    log = db_session.scalar(select(AuditLog).limit(1))
    assert log is not None

    log.action = "tampered"
    with pytest.raises(AuditLogImmutableError):
        db_session.flush()
    db_session.rollback()

    log = db_session.scalar(select(AuditLog).limit(1))
    assert log is not None
    db_session.delete(log)
    with pytest.raises(AuditLogImmutableError):
        db_session.flush()
    db_session.rollback()


def test_audit_log_rejects_truncate(db_session):
    with pytest.raises(DBAPIError, match="append-only"):
        db_session.execute(text("TRUNCATE audit_logs"))
    db_session.rollback()
