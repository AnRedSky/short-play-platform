"""Generation task data access."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.generation.models import GenerationTask, TaskAttempt, UsageRecord


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
) -> GenerationTask:
    task = GenerationTask(
        project_id=project_id,
        capability=capability,
        provider_code=provider_code,
        model_code=model_code,
        status="pending",
        idempotency_key=idempotency_key,
        request_payload=request_payload,
        requested_by=requested_by,
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
