import hashlib
import json
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from apps.api.errors import AppError, conflict, not_found
from apps.api.models.generation import (
    TERMINAL_TASK_STATUSES,
    GenerationTask,
    TaskAttempt,
    UsageRecord,
)
from apps.api.providers.base import Capability, GenerationRequest, ProviderAdapter
from apps.api.providers.registry import ProviderRegistry
from apps.api.services.creation import get_shot


def _digest(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def get_task(db: Session, task_id: UUID) -> GenerationTask:
    task = db.get(GenerationTask, task_id)
    if task is None:
        raise not_found("Generation task not found")
    return task


def get_attempts(db: Session, task_id: UUID) -> list[TaskAttempt]:
    return list(
        db.scalars(
            select(TaskAttempt)
            .where(TaskAttempt.task_id == task_id)
            .order_by(TaskAttempt.attempt_number)
        ).all()
    )


def create_task(
    db: Session,
    *,
    project_id: UUID,
    capability: Capability,
    prompt: str,
    parameters: dict,
    model_code: str,
    provider_code: str,
    idempotency_key: str,
    requested_by: UUID | None,
    shot_id: UUID | None = None,
) -> tuple[GenerationTask, bool]:
    if not idempotency_key.strip():
        raise AppError("Idempotency-Key is required", code="VALIDATION_ERROR", status_code=422)

    existing = db.scalar(
        select(GenerationTask).where(
            GenerationTask.project_id == project_id,
            GenerationTask.idempotency_key == idempotency_key,
        )
    )
    if existing is not None:
        return existing, False

    payload: dict = {"prompt": prompt, "parameters": parameters}
    if shot_id is not None:
        get_shot(db, shot_id)
        payload["shot_id"] = str(shot_id)

    task = GenerationTask(
        project_id=project_id,
        capability=capability.value,
        provider_code=provider_code,
        model_code=model_code,
        status="pending",
        idempotency_key=idempotency_key,
        request_payload=payload,
        requested_by=requested_by,
    )
    db.add(task)
    db.flush()
    return task, True


def execute_task(db: Session, registry: ProviderRegistry, task: GenerationTask) -> GenerationTask:
    adapter: ProviderAdapter = registry.get(task.provider_code)
    attempt_number = (
        int(
            db.scalar(
                select(func.max(TaskAttempt.attempt_number)).where(TaskAttempt.task_id == task.id)
            )
            or 0
        )
        + 1
    )
    started_at = datetime.now(UTC)
    attempt = TaskAttempt(
        task_id=task.id,
        attempt_number=attempt_number,
        status="running",
        started_at=started_at,
        request_digest=_digest(task.request_payload),
    )
    task.status = "running"
    db.add(attempt)
    db.flush()

    request = GenerationRequest(
        capability=Capability(task.capability),
        prompt=str(task.request_payload.get("prompt", "")),
        model_code=task.model_code,
        parameters=dict(task.request_payload.get("parameters") or {}),
    )
    result = adapter.generate(request)
    finished_at = datetime.now(UTC)
    attempt.finished_at = finished_at
    attempt.duration_ms = int((finished_at - started_at).total_seconds() * 1000)
    attempt.provider_task_id = result.provider_task_id

    if result.succeeded:
        task.status = "succeeded"
        task.result_payload = result.output
        task.error_code = None
        task.error_message = None
        attempt.status = "succeeded"
        attempt.response_digest = _digest(result.output)
        db.add(
            UsageRecord(
                task_id=task.id,
                provider_code=task.provider_code,
                model_code=task.model_code,
                unit=str(result.usage.get("unit", "call")),
                quantity=int(result.usage.get("quantity", 1)),
                source=str(result.usage.get("source", "provider")),
            )
        )
    else:
        error = result.error
        task.status = "failed"
        task.error_code = error.code if error else "PROVIDER_UNAVAILABLE"
        task.error_message = error.message if error else "Provider call failed"
        attempt.status = "failed"
        attempt.error_code = task.error_code

    task.finished_at = finished_at
    db.flush()
    return task


def request_cancel(db: Session, task: GenerationTask) -> GenerationTask:
    if task.status in TERMINAL_TASK_STATUSES:
        raise conflict(
            f"Task is already terminal in state '{task.status}'",
            {"code": "TASK_NOT_RETRYABLE"},
        )
    task.status = "cancel_requested"
    task.cancel_requested_at = datetime.now(UTC)
    db.flush()
    return task
