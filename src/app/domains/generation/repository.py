"""Generation task data access."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.domains.generation.constants import CLAIMABLE_TASK_STATUSES
from app.domains.generation.models import (
    GenerationTask,
    ProviderCallbackEvent,
    TaskAttempt,
    UsageRecord,
)
from app.utils.datetime import utcnow


def get_task(db: Session, task_id: UUID) -> GenerationTask | None:
    return db.get(GenerationTask, task_id)


def find_by_idempotency_key(
    db: Session, *, project_id: UUID, idempotency_key: str
) -> GenerationTask | None:
    return db.scalar(
        select(GenerationTask).where(
            GenerationTask.project_id == project_id,
            GenerationTask.idempotency_key == idempotency_key,
        )
    )


def create_task_row(
    db: Session,
    *,
    project_id: UUID,
    capability: str,
    provider_code: str,
    model_code: str,
    idempotency_key: str,
    request_payload: dict,
    requested_by: UUID | None,
    max_attempts: int,
) -> GenerationTask:
    task = GenerationTask(
        project_id=project_id,
        capability=capability,
        provider_code=provider_code,
        model_code=model_code,
        status="queued",
        idempotency_key=idempotency_key,
        request_payload=request_payload,
        requested_by=requested_by,
        max_attempts=max_attempts,
        attempt_count=0,
        next_run_at=utcnow(),
    )
    db.add(task)
    db.flush()
    return task


def list_attempts(db: Session, task_id: UUID) -> list[TaskAttempt]:
    return list(
        db.scalars(
            select(TaskAttempt)
            .where(TaskAttempt.task_id == task_id)
            .order_by(TaskAttempt.attempt_number)
        ).all()
    )


def next_attempt_number(db: Session, task_id: UUID) -> int:
    latest = db.scalar(
        select(func.max(TaskAttempt.attempt_number)).where(TaskAttempt.task_id == task_id)
    )
    return int(latest or 0) + 1


def add_attempt_row(
    db: Session, *, task_id: UUID, attempt_number: int, request_digest: str, started_at
) -> TaskAttempt:
    attempt = TaskAttempt(
        task_id=task_id,
        attempt_number=attempt_number,
        status="running",
        started_at=started_at,
        request_digest=request_digest,
    )
    db.add(attempt)
    db.flush()
    return attempt


def add_usage_row(
    db: Session,
    *,
    task_id: UUID,
    provider_code: str,
    model_code: str,
    unit: str,
    quantity: int,
    source: str,
) -> UsageRecord:
    record = UsageRecord(
        task_id=task_id,
        provider_code=provider_code,
        model_code=model_code,
        unit=unit,
        quantity=quantity,
        source=source,
    )
    db.add(record)
    db.flush()
    return record


def claim_due_tasks(db: Session, *, now: datetime, limit: int) -> list[GenerationTask]:
    """Claim queued/retry tasks with row locks; concurrent workers skip locked rows."""
    tasks = list(
        db.scalars(
            select(GenerationTask)
            .where(
                GenerationTask.status.in_(CLAIMABLE_TASK_STATUSES),
                GenerationTask.next_run_at.is_not(None),
                GenerationTask.next_run_at <= now,
            )
            .order_by(GenerationTask.next_run_at, GenerationTask.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        ).all()
    )
    return tasks


def latest_attempt(db: Session, task_id: UUID) -> TaskAttempt | None:
    return db.scalar(
        select(TaskAttempt)
        .where(TaskAttempt.task_id == task_id)
        .order_by(TaskAttempt.attempt_number.desc())
    )


def find_attempt(
    db: Session, task_id: UUID, *, attempt_number: int | None, provider_task_id: str | None
) -> TaskAttempt | None:
    query = select(TaskAttempt).where(TaskAttempt.task_id == task_id)
    if attempt_number is not None:
        query = query.where(TaskAttempt.attempt_number == attempt_number)
    if provider_task_id is not None:
        query = query.where(TaskAttempt.provider_task_id == provider_task_id)
    return db.scalar(query.order_by(TaskAttempt.attempt_number.desc()))


def find_callback_event(
    db: Session, task_id: UUID, callback_id: str
) -> ProviderCallbackEvent | None:
    return db.scalar(
        select(ProviderCallbackEvent).where(
            ProviderCallbackEvent.task_id == task_id,
            ProviderCallbackEvent.callback_id == callback_id,
        )
    )


def add_callback_event(
    db: Session,
    *,
    task_id: UUID,
    provider_code: str,
    callback_id: str,
    event_type: str,
    provider_task_id: str | None,
    attempt_number: int | None,
    payload: dict,
    applied: bool,
    outcome: dict,
    occurred_at: datetime,
) -> ProviderCallbackEvent:
    event = ProviderCallbackEvent(
        task_id=task_id,
        provider_code=provider_code,
        callback_id=callback_id,
        event_type=event_type,
        provider_task_id=provider_task_id,
        attempt_number=attempt_number,
        payload=payload,
        applied=applied,
        outcome=outcome,
        occurred_at=occurred_at,
    )
    db.add(event)
    db.flush()
    return event


def list_expired_leases(
    db: Session, *, now: datetime, limit: int = 20
) -> list[GenerationTask]:
    return list(
        db.scalars(
            select(GenerationTask)
            .where(
                GenerationTask.status == "running",
                GenerationTask.lease_expires_at.is_not(None),
                GenerationTask.lease_expires_at < now,
            )
            .order_by(GenerationTask.lease_expires_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        ).all()
    )


def list_tasks(
    db: Session, *, project_id: UUID, status: str | None, offset: int, limit: int
) -> list[GenerationTask]:
    query = select(GenerationTask).where(GenerationTask.project_id == project_id)
    if status:
        query = query.where(GenerationTask.status == status)
    return list(
        db.scalars(
            query.order_by(GenerationTask.created_at.desc()).offset(offset).limit(limit)
        ).all()
    )


def count_tasks(db: Session, *, project_id: UUID, status: str | None) -> int:
    query = select(func.count(GenerationTask.id)).where(
        GenerationTask.project_id == project_id
    )
    if status:
        query = query.where(GenerationTask.status == status)
    return int(db.scalar(query) or 0)


def has_non_terminal_tasks(db: Session, project_id: UUID) -> bool:
    return (
        db.scalar(
            select(GenerationTask.id).where(
                GenerationTask.project_id == project_id,
                or_(
                    GenerationTask.status.in_(CLAIMABLE_TASK_STATUSES),
                    GenerationTask.status.in_(("running", "cancel_requested")),
                ),
            )
        )
        is not None
    )
