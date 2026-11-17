import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.deps import Principal, require_permission
from apps.api.errors import AppError
from apps.api.models.generation import GenerationTask
from apps.api.providers.base import Capability
from apps.api.providers.registry import ProviderRegistry, build_registry
from apps.api.schemas.common import envelope
from apps.api.schemas.generation import (
    GenerationTaskCreate,
    GenerationTaskDetailRead,
    GenerationTaskRead,
    ProviderHealthRead,
    TaskAttemptRead,
)
from apps.api.services import audit as audit_service
from apps.api.services.generation import (
    create_task,
    execute_task,
    get_attempts,
    get_task,
    request_cancel,
)
from apps.api.services.projects import assert_project_access, get_project

router = APIRouter(tags=["generation"])

_registry: ProviderRegistry | None = None


def get_registry() -> ProviderRegistry:
    global _registry
    if _registry is None:
        _registry = build_registry()
    return _registry


def _project_access(
    db: Session, principal: Principal, project_id, need: str = "projects:read"
) -> None:
    assert_project_access(
        db,
        get_project(db, project_id),
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed=need,
    )


@router.get("/models/providers")
def list_providers(
    principal: Principal = Depends(require_permission("projects:read")),
    registry: ProviderRegistry = Depends(get_registry),
) -> dict:
    return envelope(
        [
            ProviderHealthRead(code=health.code, healthy=health.healthy).model_dump(mode="json")
            for health in registry.health()
        ]
    )


@router.post("/projects/{project_id}/generation/tasks", status_code=201)
def create_generation_task(
    project_id: UUID,
    payload: GenerationTaskCreate,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
    registry: ProviderRegistry = Depends(get_registry),
) -> dict:
    _project_access(db, principal, project_id, need="projects:write")
    try:
        capability = Capability(payload.capability)
    except ValueError:
        raise AppError(
            f"Unknown capability '{payload.capability}'",
            code="VALIDATION_ERROR",
            status_code=422,
        ) from None
    if payload.provider_code not in {adapter.code for adapter in registry.candidates(capability)}:
        raise AppError(
            f"Provider '{payload.provider_code}' cannot serve '{capability}'",
            code="VALIDATION_ERROR",
            status_code=422,
        )

    task, created = create_task(
        db,
        project_id=project_id,
        capability=capability,
        prompt=payload.prompt,
        parameters=payload.parameters,
        model_code=payload.model_code,
        provider_code=payload.provider_code,
        idempotency_key=idempotency_key or str(uuid.uuid4()),
        requested_by=principal.user.id,
        shot_id=payload.shot_id,
    )
    if created:
        execute_task(db, registry, task)
        audit_service.record(
            db,
            actor_user_id=principal.user.id,
            action="generation.task_created",
            resource_type="generation_task",
            resource_id=str(task.id),
            request_id=getattr(request.state, "request_id", None),
            details={
                "capability": task.capability,
                "status": task.status,
                "idempotency_key": task.idempotency_key,
            },
        )
        db.commit()
    return envelope(
        GenerationTaskRead.model_validate(task).model_dump(mode="json"),
        {"created": created},
    )


@router.get("/generation/tasks/{task_id}")
def read_generation_task(
    task_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    task: GenerationTask = get_task(db, task_id)
    _project_access(db, principal, task.project_id)
    attempts = [TaskAttemptRead.model_validate(attempt) for attempt in get_attempts(db, task.id)]
    detail = GenerationTaskDetailRead(
        **GenerationTaskRead.model_validate(task).model_dump(), attempts=attempts
    )
    return envelope(detail.model_dump(mode="json"))


@router.post("/generation/tasks/{task_id}/cancel")
def cancel_generation_task(
    task_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    task: GenerationTask = get_task(db, task_id)
    _project_access(db, principal, task.project_id, need="projects:write")
    request_cancel(db, task)
    db.commit()
    return envelope(GenerationTaskRead.model_validate(task).model_dump(mode="json"))
