"""Generation queue: idempotent enqueue, leasing, retries, callbacks and recovery.

Every state change is made in the caller's transaction. Providers are called
only from :func:`dispatch_tasks`; callbacks never create a second business
effect for the same ``(task, callback_id)``.
"""

import hashlib
import json
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.domains.costs import service as cost_service
from app.domains.creation import service as creation_service
from app.domains.generation import repository as generation_repo
from app.domains.generation.constants import (
    DEFAULT_LEASE_SECONDS,
    PAUSABLE_TASK_STATUSES,
    TERMINAL_TASK_STATUSES,
    retry_delay,
)
from app.domains.generation.models import GenerationTask, TaskAttempt
from app.domains.generation.schemas import GenerationTaskRead, ProviderCallback
from app.domains.projects.models import Project
from app.infrastructure.providers.base import (
    Capability,
    GenerationRequest,
    GenerationResult,
    ProviderAdapter,
    ProviderError,
)
from app.infrastructure.providers.registry import ProviderRegistry
from app.public.constants import ErrorCode
from app.public.exceptions import conflict, not_found, permission_denied, validation_error
from app.utils.datetime import utcnow


def digest(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def serialize_task(task: GenerationTask) -> dict:
    return GenerationTaskRead.model_validate(task).model_dump(mode="json")


def get_task_or_404(db: Session, task_id: UUID) -> GenerationTask:
    task = generation_repo.get_task(db, task_id)
    if task is None:
        raise not_found("Generation task not found")
    return task


def get_attempts(db: Session, task_id: UUID) -> list[TaskAttempt]:
    return generation_repo.list_attempts(db, task_id)


def list_tasks(
    db: Session, *, project_id: UUID, status: str | None, offset: int, limit: int
) -> tuple[list[GenerationTask], int]:
    return (
        generation_repo.list_tasks(
            db, project_id=project_id, status=status, offset=offset, limit=limit
        ),
        generation_repo.count_tasks(db, project_id=project_id, status=status),
    )


def resolve_capability(raw: str) -> Capability:
    try:
        return Capability(raw)
    except ValueError:
        raise validation_error(f"Unknown capability '{raw}'") from None


def assert_provider_supports(registry: ProviderRegistry, capability: Capability, code: str) -> None:
    if code not in {adapter.code for adapter in registry.candidates(capability)}:
        raise validation_error(f"Provider '{code}' cannot serve '{capability}'")


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
    max_attempts: int = 3,
) -> tuple[GenerationTask, bool]:
    """Returns ``(task, created)``; the same key always resolves to the same task."""
    if not idempotency_key.strip():
        raise validation_error("Idempotency-Key is required")

    existing = generation_repo.find_by_idempotency_key(
        db, project_id=project_id, idempotency_key=idempotency_key
    )
    if existing is not None:
        return existing, False

    project = db.get(Project, project_id)
    if project is None:
        raise not_found("Project not found")
    cost_service.assert_budget_available(db, project)

    payload: dict = {"prompt": prompt, "parameters": parameters}
    if shot_id is not None:
        creation_service.get_shot_or_404(db, shot_id)
        if creation_service.project_of_shot(db, shot_id) != project_id:
            raise permission_denied(
                "A generation task cannot reference a shot from another project"
            )
        payload["shot_id"] = str(shot_id)

    task = generation_repo.create_task_row(
        db,
        project_id=project_id,
        capability=capability.value,
        provider_code=provider_code,
        model_code=model_code,
        idempotency_key=idempotency_key,
        request_payload=payload,
        requested_by=requested_by,
        max_attempts=max_attempts,
    )
    return task, True


def _attempt_duration(attempt: TaskAttempt, finished_at: datetime) -> int:
    if attempt.started_at is None:
        return 0
    return max(0, int((finished_at - attempt.started_at).total_seconds() * 1000))


def _record_success(
    db: Session,
    task: GenerationTask,
    attempt: TaskAttempt,
    result: GenerationResult,
    finished_at: datetime,
) -> None:
    attempt.status = "succeeded"
    attempt.finished_at = finished_at
    attempt.duration_ms = _attempt_duration(attempt, finished_at)
    attempt.provider_task_id = result.provider_task_id
    attempt.response_digest = digest(result.output)
    task.last_provider_task_id = result.provider_task_id
    task.lease_expires_at = None
    task.next_run_at = None

    cost_service.record_attempt_usage(
        db,
        task=task,
        attempt=attempt,
        failure=False,
        usage=result.usage,
        source="provider",
    )

    if task.status == "cancel_requested":
        task.status = "cancelled"
        task.finished_at = finished_at
        return

    task.status = "succeeded"
    task.result_payload = result.output
    task.error_code = None
    task.error_message = None
    task.finished_at = finished_at


def _record_failure(
    db: Session,
    task: GenerationTask,
    attempt: TaskAttempt,
    *,
    code: str,
    message: str,
    retryable: bool,
    finished_at: datetime,
    usage: dict | None = None,
) -> None:
    attempt.status = "failed"
    attempt.error_code = code
    attempt.finished_at = finished_at
    attempt.duration_ms = _attempt_duration(attempt, finished_at)
    task.error_code = code
    task.error_message = message
    task.lease_expires_at = None
    task.next_run_at = None

    cost_service.record_attempt_usage(
        db,
        task=task,
        attempt=attempt,
        failure=True,
        usage=usage,
        source="provider",
    )

    if task.status == "cancel_requested":
        task.status = "cancelled"
        task.finished_at = finished_at
        return

    if retryable and task.attempt_count < task.max_attempts:
        task.status = "retry_wait"
        task.next_run_at = finished_at + timedelta(seconds=retry_delay(task.attempt_count))
        task.finished_at = None
        return

    task.status = "failed"
    task.finished_at = finished_at


def _provider_request(task: GenerationTask) -> GenerationRequest:
    return GenerationRequest(
        capability=Capability(task.capability),
        prompt=str(task.request_payload.get("prompt", "")),
        model_code=task.model_code,
        parameters=dict(task.request_payload.get("parameters") or {}),
    )


def _run_claimed(
    db: Session, registry: ProviderRegistry, task: GenerationTask, attempt: TaskAttempt
) -> GenerationTask:
    adapter: ProviderAdapter = registry.get(task.provider_code)
    try:
        result = adapter.generate(_provider_request(task))
    except Exception as error:  # noqa: BLE001 - any adapter crash is a provider failure
        result = GenerationResult(
            status="failed",
            error=ProviderError.unavailable(str(error) or "Provider call crashed"),
        )

    finished_at = utcnow()
    if result.succeeded:
        _record_success(db, task, attempt, result, finished_at)
    else:
        provider_error = result.error
        _record_failure(
            db,
            task,
            attempt,
            code=(provider_error.code if provider_error else ErrorCode.PROVIDER_UNAVAILABLE),
            message=(provider_error.message if provider_error else "Provider call failed"),
            retryable=bool(provider_error.retryable) if provider_error else True,
            finished_at=finished_at,
            usage=result.usage,
        )
    db.flush()
    return task


def execute_task_now(
    db: Session, registry: ProviderRegistry, task: GenerationTask
) -> GenerationTask:
    """Run a freshly enqueued task in the caller's transaction, bypassing the queue.

    Used by the workflow domain, which owns its own node retry budget and must observe
    the provider outcome synchronously. The task is given a single attempt so a failed
    inline run never leaves a duplicate retry behind in the shared queue.
    """
    if task.status not in {"pending", "queued"}:
        raise conflict(
            "Task is not waiting for an inline run", {"code": ErrorCode.TASK_NOT_RETRYABLE}
        )

    now = utcnow()
    task.attempt_count = max(
        task.attempt_count + 1, generation_repo.next_attempt_number(db, task.id)
    )
    attempt = generation_repo.add_attempt_row(
        db,
        task_id=task.id,
        attempt_number=task.attempt_count,
        request_digest=digest(task.request_payload),
        started_at=now,
    )
    task.status = "running"
    task.next_run_at = None
    task.lease_expires_at = now + timedelta(seconds=DEFAULT_LEASE_SECONDS)
    db.flush()
    return _run_claimed(db, registry, task, attempt)


def dispatch_tasks(
    db: Session, registry: ProviderRegistry, *, limit: int = 10
) -> list[GenerationTask]:
    """Claim due tasks and run them once; each claim is serialized by a row lock."""
    now = utcnow()
    claimed = generation_repo.claim_due_tasks(db, now=now, limit=limit)
    results: list[GenerationTask] = []
    for task in claimed:
        task.attempt_count = max(
            task.attempt_count + 1, generation_repo.next_attempt_number(db, task.id)
        )
        attempt = generation_repo.add_attempt_row(
            db,
            task_id=task.id,
            attempt_number=task.attempt_count,
            request_digest=digest(task.request_payload),
            started_at=now,
        )
        task.status = "running"
        task.lease_expires_at = now + timedelta(seconds=DEFAULT_LEASE_SECONDS)
        task.next_run_at = None
        db.flush()
        results.append(_run_claimed(db, registry, task, attempt))
    return results


def pause_task(db: Session, task: GenerationTask) -> GenerationTask:
    if task.status == "paused":
        return task
    if task.status not in PAUSABLE_TASK_STATUSES:
        raise conflict(
            f"Task in state '{task.status}' cannot be paused",
            {"code": ErrorCode.TASK_NOT_RETRYABLE},
        )
    task.status = "paused"
    task.paused_at = utcnow()
    db.flush()
    return task


def resume_task(db: Session, task: GenerationTask) -> GenerationTask:
    if task.status != "paused":
        raise conflict(
            f"Task in state '{task.status}' is not paused",
            {"code": ErrorCode.TASK_NOT_RETRYABLE},
        )
    task.status = "queued"
    task.paused_at = None
    task.next_run_at = utcnow()
    db.flush()
    return task


def retry_task(db: Session, task: GenerationTask) -> GenerationTask:
    if task.status in ("queued", "running", "cancel_requested"):
        raise conflict(
            f"Task in state '{task.status}' cannot be retried now",
            {"code": ErrorCode.TASK_NOT_RETRYABLE},
        )
    if task.status == "paused":
        raise conflict(
            "Resume the paused task instead of retrying it",
            {"code": ErrorCode.TASK_NOT_RETRYABLE},
        )
    if task.status == "succeeded":
        raise conflict("Task already succeeded", {"code": ErrorCode.TASK_NOT_RETRYABLE})
    if task.attempt_count >= task.max_attempts:
        raise conflict(
            "Task exhausted its retry budget",
            {"code": ErrorCode.TASK_NOT_RETRYABLE, "attempts": task.attempt_count},
        )
    task.status = "queued"
    task.next_run_at = utcnow()
    task.error_code = None
    task.error_message = None
    task.lease_expires_at = None
    task.finished_at = None
    db.flush()
    return task


def request_cancel(db: Session, task: GenerationTask) -> GenerationTask:
    if task.status == "cancelled":
        return task
    if task.status == "cancel_requested":
        return task
    if task.status in TERMINAL_TASK_STATUSES:
        raise conflict(
            f"Task is already terminal in state '{task.status}'",
            {"code": ErrorCode.TASK_NOT_RETRYABLE},
        )
    now = utcnow()
    task.cancel_requested_at = now
    if task.status == "running":
        task.status = "cancel_requested"
    else:
        task.status = "cancelled"
        task.finished_at = now
        task.lease_expires_at = None
        task.next_run_at = None
    db.flush()
    return task


def recover_expired_tasks(db: Session, *, limit: int = 20) -> list[GenerationTask]:
    now = utcnow()
    expired = generation_repo.list_expired_leases(db, now=now, limit=limit)
    recovered: list[GenerationTask] = []
    for task in expired:
        attempt = generation_repo.latest_attempt(db, task.id)
        if attempt is not None and attempt.status == "running":
            attempt.status = "failed"
            attempt.error_code = ErrorCode.PROVIDER_TIMEOUT
            attempt.finished_at = now
            attempt.duration_ms = _attempt_duration(attempt, now)
            cost_service.record_attempt_usage(
                db,
                task=task,
                attempt=attempt,
                failure=True,
                usage=None,
                source="provider",
            )
        task.attempt_count = max(task.attempt_count, attempt.attempt_number if attempt else 0)
        task.error_code = ErrorCode.PROVIDER_TIMEOUT
        task.error_message = "Worker lease expired before a provider callback"
        task.lease_expires_at = None
        if task.attempt_count < task.max_attempts:
            task.status = "retry_wait"
            task.next_run_at = now + timedelta(seconds=retry_delay(task.attempt_count))
            task.finished_at = None
        else:
            task.status = "failed"
            task.finished_at = now
            task.next_run_at = None
        db.flush()
        recovered.append(task)
    return recovered


def _as_aware(value: datetime | None) -> datetime:
    if value is None:
        return utcnow()
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def _event_outcome(task: GenerationTask, *, applied: bool, reason: str = "") -> dict:
    outcome: dict = {"task": serialize_task(task), "applied": applied}
    if reason:
        outcome["reason"] = reason
    return outcome


def _record_callback(
    db: Session,
    task: GenerationTask,
    payload: ProviderCallback,
    *,
    occurred_at: datetime,
    applied: bool,
    reason: str,
) -> dict:
    outcome = _event_outcome(task, applied=applied, reason=reason)
    generation_repo.add_callback_event(
        db,
        task_id=task.id,
        provider_code=task.provider_code,
        callback_id=payload.callback_id,
        event_type=payload.event,
        provider_task_id=payload.provider_task_id,
        attempt_number=payload.attempt_number,
        payload=payload.model_dump(mode="json"),
        applied=applied,
        outcome=outcome,
        occurred_at=occurred_at,
    )
    return outcome


def handle_provider_callback(
    db: Session, task: GenerationTask, payload: ProviderCallback, *, provider_code: str
) -> dict:
    """Apply one provider event; duplicate id and stale ordering never re-apply."""
    if provider_code != task.provider_code:
        raise validation_error(f"Callback provider '{provider_code}' does not match task provider")
    existing = generation_repo.find_callback_event(db, task.id, payload.callback_id)
    if existing is not None:
        duplicate = dict(existing.outcome)
        duplicate["duplicate"] = True
        return duplicate

    occurred_at = _as_aware(payload.occurred_at)
    if task.last_callback_at is not None and occurred_at < _as_aware(task.last_callback_at):
        return _record_callback(
            db,
            task,
            payload,
            occurred_at=occurred_at,
            applied=False,
            reason="STALE_CALLBACK",
        )

    if payload.event == "accepted":
        if task.status != "running":
            outcome = _record_callback(
                db,
                task,
                payload,
                occurred_at=occurred_at,
                applied=False,
                reason="TASK_NOT_RUNNING",
            )
            outcome["duplicate"] = False
            return outcome
        attempt = generation_repo.find_attempt(
            db,
            task.id,
            attempt_number=payload.attempt_number,
            provider_task_id=payload.provider_task_id,
        ) or generation_repo.latest_attempt(db, task.id)
        if attempt is None:
            outcome = _record_callback(
                db,
                task,
                payload,
                occurred_at=occurred_at,
                applied=False,
                reason="ATTEMPT_NOT_FOUND",
            )
            outcome["duplicate"] = False
            return outcome
        if payload.provider_task_id:
            attempt.provider_task_id = payload.provider_task_id
        task.last_provider_task_id = attempt.provider_task_id
        task.last_callback_at = occurred_at
        outcome = _record_callback(
            db, task, payload, occurred_at=occurred_at, applied=True, reason=""
        )
        outcome["duplicate"] = False
        db.flush()
        return outcome

    if task.status in TERMINAL_TASK_STATUSES:
        outcome = _record_callback(
            db,
            task,
            payload,
            occurred_at=occurred_at,
            applied=False,
            reason="TASK_TERMINAL",
        )
        outcome["duplicate"] = False
        return outcome

    if task.status not in ("running", "cancel_requested"):
        outcome = _record_callback(
            db,
            task,
            payload,
            occurred_at=occurred_at,
            applied=False,
            reason="TASK_NOT_RUNNING",
        )
        outcome["duplicate"] = False
        return outcome

    attempt = generation_repo.find_attempt(
        db,
        task.id,
        attempt_number=payload.attempt_number,
        provider_task_id=payload.provider_task_id,
    ) or generation_repo.latest_attempt(db, task.id)
    if attempt is None:
        outcome = _record_callback(
            db,
            task,
            payload,
            occurred_at=occurred_at,
            applied=False,
            reason="ATTEMPT_NOT_FOUND",
        )
        outcome["duplicate"] = False
        return outcome

    attempt.provider_task_id = payload.provider_task_id or attempt.provider_task_id
    task.last_provider_task_id = attempt.provider_task_id
    task.last_callback_at = occurred_at
    task.lease_expires_at = None
    if payload.status == "succeeded":
        result = GenerationResult(
            status="succeeded",
            output=payload.output,
            usage=payload.usage,
            provider_task_id=attempt.provider_task_id,
        )
        _record_success(db, task, attempt, result, occurred_at)
    else:
        error = payload.error
        _record_failure(
            db,
            task,
            attempt,
            code=error.code if error else ErrorCode.PROVIDER_UNAVAILABLE,
            message=error.message if error else "Provider call failed",
            retryable=bool(error.retryable) if error else False,
            finished_at=occurred_at,
            usage=payload.usage,
        )
    outcome = _record_callback(db, task, payload, occurred_at=occurred_at, applied=True, reason="")
    outcome["duplicate"] = False
    db.flush()
    return outcome
