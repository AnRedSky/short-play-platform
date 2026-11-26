"""B-06: cost ledger, project totals and budget gating."""

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.costs import repository as costs_repo
from app.domains.costs.constants import (
    BILLING_STATUS_CONFIRMED,
    BILLING_STATUS_PENDING,
    BUDGET_STATE_EXCEEDED,
    BUDGET_STATE_NORMAL,
    BUDGET_STATE_UNSET,
    BUDGET_STATE_WARNING,
    CAPABILITY_LABELS,
    DEFAULT_CURRENCY,
    DEFAULT_FAILURE_RATIO,
    DEFAULT_UNIT_PRICES,
)
from app.domains.generation.models import GenerationTask, TaskAttempt, UsageRecord
from app.domains.projects.models import Project
from app.public.constants import ErrorCode
from app.public.exceptions import AppError, conflict
from app.utils.datetime import utcnow


def _money(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.0001"))


def _quantity(usage: dict | None) -> tuple[str, int]:
    usage = usage or {}
    unit = str(usage.get("unit") or "call")
    raw = usage.get("quantity")
    if raw is None:
        raw = usage.get("seconds") or usage.get("duration_seconds") or 1
    try:
        quantity = max(int(raw), 1)
    except (TypeError, ValueError):
        quantity = 1
    return unit, quantity


def _rate_values(
    db: Session, *, provider_code: str, model_code: str, capability: str
) -> tuple[Decimal, Decimal, str, UUID | None]:
    rate = costs_repo.get_rate(
        db,
        provider_code=provider_code,
        model_code=model_code,
        capability=capability,
        at=utcnow(),
    )
    if rate is not None:
        return _money(rate.unit_price), _money(rate.failure_ratio), rate.currency, rate.id
    return (
        DEFAULT_UNIT_PRICES.get(capability, Decimal("0")),
        DEFAULT_FAILURE_RATIO,
        DEFAULT_CURRENCY,
        None,
    )


def refresh_project_totals(db: Session, project_id: UUID) -> Project:
    """Recompute the project DTO's cost fields from the ledger.

    The row lock serializes two attempts finishing at the same time; totals are
    always a full aggregate, never an increment, so retries cannot drift.
    """
    project = db.scalar(
        select(Project).where(Project.id == project_id).with_for_update(of=Project)
    )
    if project is None:
        raise conflict("Project not found for cost rollup", {"project_id": str(project_id)})
    estimated, actual, _ = costs_repo.project_usage_sums(db, project_id)
    project.estimated = estimated
    project.actual = actual
    db.flush()
    return project


def record_attempt_usage(
    db: Session,
    *,
    task: GenerationTask,
    attempt: TaskAttempt,
    failure: bool,
    usage: dict | None,
    source: str = "provider",
) -> UsageRecord:
    """Write exactly one ledger row for one attempt.

    The unique ``attempt_id`` key is the hard idempotency boundary: a repeated
    callback or a recovery pass returns the first row instead of double billing.
    """
    existing = costs_repo.find_usage_for_attempt(db, attempt.id)
    if existing is not None:
        return existing

    unit_price, failure_ratio, currency, rate_id = _rate_values(
        db,
        provider_code=task.provider_code,
        model_code=task.model_code,
        capability=task.capability,
    )
    unit, quantity = _quantity(usage)
    estimate = _money(unit_price * quantity)
    amount = _money(estimate * failure_ratio) if failure else estimate
    payload = task.request_payload or {}
    parameters = payload.get("parameters") or {}
    episode_number = payload.get("episode_number") or parameters.get("episode_number")
    try:
        episode_number = int(episode_number) if episode_number is not None else None
    except (TypeError, ValueError):
        episode_number = None
    shot_id = payload.get("shot_id")
    try:
        shot_id = UUID(str(shot_id)) if shot_id else None
    except (TypeError, ValueError):
        shot_id = None

    project = db.get(Project, task.project_id)
    project_code = project.code if project is not None else "PROJECT"
    code = f"CR-{project_code}-{attempt.id.hex[:6].upper()}"
    row = costs_repo.add_usage(
        db,
        task_id=task.id,
        attempt_id=attempt.id,
        project_id=task.project_id,
        cost_rate_id=rate_id,
        code=code,
        provider_code=task.provider_code,
        model_code=task.model_code,
        capability=task.capability,
        unit=unit,
        quantity=quantity,
        unit_price=unit_price,
        estimated_amount=estimate,
        amount=amount,
        currency=currency,
        failure=failure,
        billing_status=(
            BILLING_STATUS_CONFIRMED
            if not failure and source == "provider"
            else BILLING_STATUS_PENDING
        ),
        billing_basis="provider" if not failure else "failure_estimate",
        episode_number=episode_number,
        shot_id=shot_id,
        source=source,
    )
    refresh_project_totals(db, task.project_id)
    return row


def budget_state(project: Project) -> str:
    total = float(project.budget or 0)
    if total <= 0:
        return BUDGET_STATE_UNSET
    used = float(project.actual or 0)
    if used >= total:
        return BUDGET_STATE_EXCEEDED
    if used >= total * 0.85:
        return BUDGET_STATE_WARNING
    return BUDGET_STATE_NORMAL


def assert_budget_available(db: Session, project: Project) -> None:
    """Block new work at 100%; an unset (0) budget means uncapped."""
    refreshed = refresh_project_totals(db, project.id)
    total = float(refreshed.budget or 0)
    used = float(refreshed.actual or 0)
    if total > 0 and used >= total:
        raise AppError(
            "项目预算已用尽，新生成任务已被阻断",
            code=ErrorCode.BUDGET_EXCEEDED,
            status_code=409,
            details={
                "budget": total,
                "actual": used,
                "budgetState": BUDGET_STATE_EXCEEDED,
            },
        )


def serialize_usage(row: UsageRecord) -> dict:
    project = row.project
    task = row.task
    payload = (task.request_payload if task is not None else {}) or {}
    parameters = payload.get("parameters") or {}
    shot = parameters.get("shot_label") or (str(row.shot_id) if row.shot_id else "—")
    task_code = f"T-{task.id.hex[:8].upper()}" if task is not None else "—"
    return {
        "id": row.code or f"CR-{row.id.hex[:6].upper()}",
        "project": project.code if project is not None else "—",
        "name": project.title if project is not None else "—",
        "ep": row.episode_number if row.episode_number is not None else "—",
        "shot": shot,
        "task": task_code,
        "cap": CAPABILITY_LABELS.get(row.capability, row.capability),
        "est": float(row.estimated_amount),
        "actual": float(row.amount) if not row.failure else 0.0,
        "failed": float(row.amount) if row.failure else 0.0,
        "bearer": "企业承担",
        "source": row.provider_code,
        "status": row.billing_status,
        "bill": row.code or "—",
        "attempt": row.attempt.attempt_number if row.attempt is not None else "—",
        "at": row.created_at.strftime("%Y-%m-%d %H:%M") if row.created_at else "—",
        "currency": row.currency,
    }


def serialize_budget(project: Project, *, scope: str | None = None) -> dict:
    total = float(project.budget or 0)
    used = float(project.actual or 0)
    reserve = float(project.estimated or 0)
    return {
        "scope": scope or "项目",
        "name": f"{project.code} · {project.title}",
        "project": project.code,
        "total": total,
        "used": used,
        "reserve": max(reserve - used, 0),
        "state": budget_state(project),
        "owner": project.owner.full_name if project.owner is not None else "—",
        "currency": DEFAULT_CURRENCY,
    }
