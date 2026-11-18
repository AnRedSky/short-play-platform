"""Generation business rules: idempotent task creation, provider execution, cancel."""

import hashlib
import json
from uuid import UUID

from sqlalchemy.orm import Session

from app.domains.creation import service as creation_service
from app.domains.generation import repository as generation_repo
from app.domains.generation.constants import TERMINAL_TASK_STATUSES
from app.domains.generation.models import GenerationTask, TaskAttempt
from app.infrastructure.providers.base import Capability, GenerationRequest, ProviderAdapter
from app.infrastructure.providers.registry import ProviderRegistry
from app.public.constants import ErrorCode
from app.public.exceptions import conflict, not_found, permission_denied, validation_error
from app.utils.datetime import utcnow


def digest(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def get_task_or_404(db: Session, task_id: UUID) -> GenerationTask:
    task = generation_repo.get_task(db, task_id)
    if task is None:
        raise not_found("Generation task not found")
    return task


def get_attempts(db: Session, task_id: UUID) -> list[TaskAttempt]:
    return generation_repo.list_attempts(db, task_id)


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
) -> tuple[GenerationTask, bool]:
    """Returns ``(task, created)``; the same key always resolves to the same task."""
    if not idempotency_key.strip():
        raise validation_error("Idempotency-Key is required")

    existing = generation_repo.find_by_idempotency_key(
        db, project_id=project_id, idempotency_key=idempotency_key
    )
    if existing is not None:
        return existing, False

    payload: dict = {"prompt": prompt, "parameters": parameters}
    if shot_id is not None:
        creation_service.get_shot_or_404(db, shot_id)
        if creation_service.project_of_shot(db, shot_id) != project_id:
            raise permission_denied("A generation task cannot reference a shot from another project")
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
    )
    return task, True


def execute_task(
    db: Session, registry: ProviderRegistry, task: GenerationTask
) -> GenerationTask:
    adapter: ProviderAdapter = registry.get(task.provider_code)
    started_at = utcnow()
    attempt = generation_repo.add_attempt_row(
        db,
        task_id=task.id,
        attempt_number=generation_repo.next_attempt_number(db, task.id),
        request_digest=digest(task.request_payload),
        started_at=started_at,
    )
    task.status = "running"
    db.flush()

    request = GenerationRequest(
        capability=Capability(task.capability),
        prompt=str(task.request_payload.get("prompt", "")),
        model_code=task.model_code,
        parameters=dict(task.request_payload.get("parameters") or {}),
    )
    result = adapter.generate(request)
    finished_at = utcnow()
    attempt.finished_at = finished_at
    attempt.duration_ms = int((finished_at - started_at).total_seconds() * 1000)
    attempt.provider_task_id = result.provider_task_id

    if result.succeeded:
        task.status = "succeeded"
        task.result_payload = result.output
        task.error_code = None
        task.error_message = None
        attempt.status = "succeeded"
        attempt.response_digest = digest(result.output)
        generation_repo.add_usage_row(
            db,
            task_id=task.id,
            provider_code=task.provider_code,
            model_code=task.model_code,
            unit=str(result.usage.get("unit", "call")),
            quantity=int(result.usage.get("quantity", 1)),
            source=str(result.usage.get("source", "provider")),
        )
    else:
        error = result.error
        task.status = "failed"
        task.error_code = error.code if error else ErrorCode.PROVIDER_UNAVAILABLE
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
            {"code": ErrorCode.TASK_NOT_RETRYABLE},
        )
    task.status = "cancel_requested"
    task.cancel_requested_at = utcnow()
    db.flush()
    return task
