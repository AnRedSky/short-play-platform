"""B-06 acceptance: attempt-level ledger, failed cost and budget gating."""

import uuid

from sqlalchemy import select

from app.domains.generation.models import UsageRecord


def _project(client, admin, budget=None) -> dict:
    payload = {
        "code": f"cost-{uuid.uuid4().hex[:6]}",
        "name": "Cost Pilot",
        "budget": budget if budget is not None else 1000,
    }
    response = client.post("/api/v1/projects", headers=admin["headers"], json=payload)
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _task(client, admin, project_id, *, key=None, **overrides) -> dict:
    body = {
        "capability": "text_generation",
        "prompt": "ledger test prompt",
        "model_code": "mock-text-1",
        "provider_code": "mock",
    }
    body.update(overrides)
    headers = dict(admin["headers"])
    headers["Idempotency-Key"] = key or uuid.uuid4().hex
    response = client.post(
        f"/api/v1/projects/{project_id}/generation/tasks", headers=headers, json=body
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _dispatch(client, admin) -> dict:
    response = client.post("/api/v1/generation/queue/dispatch", headers=admin["headers"])
    assert response.status_code == 200, response.text
    return response.json()["data"]


def _retry(client, admin, task_id):
    return client.post(f"/api/v1/generation/tasks/{task_id}/retry", headers=admin["headers"])


def test_every_attempt_has_exactly_one_cost_row_and_project_totals_roll_up(
    client, admin, db_session
):
    project = _project(client, admin, budget=100)
    success = _task(client, admin, project["record_id"])
    failure = _task(
        client, admin, project["record_id"], provider_code="mock-failing", max_attempts=1
    )
    dispatched = _dispatch(client, admin)
    statuses = {row["id"]: row["status"] for row in dispatched["tasks"]}
    assert statuses[success["id"]] == "succeeded"
    assert statuses[failure["id"]] == "failed"

    usage = list(
        db_session.scalars(
            select(UsageRecord).where(
                UsageRecord.project_id == uuid.UUID(project["record_id"])
            )
        ).all()
    )
    assert len(usage) == 2
    assert len({row.attempt_id for row in usage}) == 2

    for task in (success, failure):
        detail = client.get(
            f"/api/v1/generation/tasks/{task['id']}", headers=admin["headers"]
        ).json()["data"]
        assert len(detail["attempts"]) == 1
        attempt = db_session.scalar(
            select(UsageRecord).where(
                UsageRecord.task_id == uuid.UUID(task["id"]),
                UsageRecord.attempt_id.is_not(None),
            )
        )
        assert attempt is not None
        assert attempt.attempt_id is not None

    ledger = client.get(
        f"/api/v1/costs?project={project['id']}&page_size=100", headers=admin["headers"]
    )
    assert ledger.status_code == 200, ledger.text
    rows = ledger.json()["data"]
    assert len(rows) == 2
    assert {row["attempt"] for row in rows} == {1}
    assert {row["currency"] for row in rows} == {"CNY"}
    success_row = next(row for row in rows if row["actual"] > 0)
    failure_row = next(row for row in rows if row["failed"] > 0)
    assert success_row["est"] == 3.5
    assert success_row["actual"] == 3.5
    assert failure_row["est"] == 3.5
    assert failure_row["failed"] == 1.75
    assert failure_row["status"] == "待对账"

    refreshed = client.get(
        f"/api/v1/projects/{project['record_id']}", headers=admin["headers"]
    ).json()["data"]
    assert refreshed["actual"] == 5.25
    assert refreshed["estimated"] == 7.0
    assert refreshed["budgetState"] == "正常"


def test_retry_produces_a_second_ledger_row(client, admin):
    project = _project(client, admin, budget=100)
    task = _task(
        client, admin, project["record_id"], provider_code="mock-failing", max_attempts=2
    )
    first = _dispatch(client, admin)["tasks"][0]
    assert first["status"] == "retry_wait"

    assert _retry(client, admin, task["id"]).status_code == 200
    second = _dispatch(client, admin)["tasks"][0]
    assert second["status"] == "failed"
    assert second["attempt_count"] == 2

    rows = client.get(
        f"/api/v1/costs?project={project['id']}&page_size=100", headers=admin["headers"]
    ).json()["data"]
    assert len(rows) == 2
    assert {row["attempt"] for row in rows} == {1, 2}
    assert sum(row["failed"] for row in rows) == 3.5

    project_row = client.get(
        f"/api/v1/projects/{project['record_id']}", headers=admin["headers"]
    ).json()["data"]
    assert project_row["actual"] == 3.5
    assert project_row["estimated"] == 7.0


def test_budget_100_percent_blocks_new_tasks(client, admin):
    project = _project(client, admin, budget=3.4)
    _task(client, admin, project["record_id"])
    _dispatch(client, admin)

    refreshed = client.get(
        f"/api/v1/projects/{project['record_id']}", headers=admin["headers"]
    ).json()["data"]
    assert refreshed["actual"] == 3.5
    assert refreshed["budgetState"] == "超限"

    headers = dict(admin["headers"])
    headers["Idempotency-Key"] = uuid.uuid4().hex
    blocked = client.post(
        f"/api/v1/projects/{project['record_id']}/generation/tasks",
        headers=headers,
        json={
            "capability": "text_generation",
            "prompt": "this must be blocked",
            "provider_code": "mock",
        },
    )
    assert blocked.status_code == 409, blocked.text
    assert blocked.json()["error"]["code"] == "BUDGET_EXCEEDED"
    assert blocked.json()["error"]["details"]["budgetState"] == "超限"


def test_budget_and_summary_views_match_the_ledger(client, admin):
    project = _project(client, admin, budget=3.4)
    _task(client, admin, project["record_id"])
    _dispatch(client, admin)

    summary = client.get("/api/v1/costs/summary", headers=admin["headers"])
    assert summary.status_code == 200, summary.text
    data = summary.json()["data"]
    assert data["actual"] == 3.5
    assert data["failed"] == 0.0
    assert data["count"] == 1
    assert data["byCapability"][0]["capability"] == "text_generation"

    budgets = client.get("/api/v1/budgets", headers=admin["headers"])
    assert budgets.status_code == 200, budgets.text
    rows = budgets.json()["data"]
    project_row = next(row for row in rows if row["project"] == project["id"])
    assert project_row["total"] == 3.4
    assert project_row["used"] == 3.5
    assert project_row["state"] == "超限"


def test_duplicate_dispatch_does_not_duplicate_usage(client, admin, db_session):
    project = _project(client, admin, budget=100)
    _task(client, admin, project["record_id"])
    first = _dispatch(client, admin)["tasks"][0]
    assert first["status"] == "succeeded"

    assert _dispatch(client, admin)["claimed"] == 0
    count = len(
        db_session.scalars(
            select(UsageRecord).where(UsageRecord.project_id == uuid.UUID(project["record_id"]))
        ).all()
    )
    assert count == 1
