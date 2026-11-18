"""Generation task HTTP contract."""

import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.domains.audit import service as audit_service
from app.domains.generation import service as generation_service
from app.domains.generation.schemas import (
    GenerationTaskCreate,
    GenerationTaskDetailRead,
    GenerationTaskRead,
    ProviderHealthRead,
    TaskAttemptRead,
)
from app.domains.projects import service as projects_service
from app.infrastructure.providers.registry import ProviderRegistry, get_registry
from app.public.constants import IDEMPOTENCY_KEY_HEADER
from app.public.schemas import envelope

router = APIRouter(tags=["generation"])


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
    idempotency_key: str | None = Header(default=None, alias=IDEMPOTENCY_KEY_HEADER),
    principal: Principal = Depends(require_permission(projects:write)),
    db: Session = Depends(get_db),
    registry: ProviderRegistry = Depends(get_registry),
) -> dict:
    projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="projects:write",
    )
    capability = generation_service.resolve_capability(payload.capability)
    generation_service.assert_provider_supports(registry, capability, payload.provider_code)

    task, created = generation_service.create_task(
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
        generation_service.execute_task(db, registry, task)
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
    task = generation_service.get_task_or_404(db, task_id)
    projects_service.get_accessible_project(
        db,
        task.project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
    )
    attempts = [
        TaskAttemptRead.model_validate(attempt)
        for attempt in generation_service.get_attempts(db, task.id)
    ]
    detail = GenerationTaskDetailRead(
        **GenerationTaskRead.model_validate(task).model_dump(), attempts=attempts
    )
    return envelope(detail.model_dump(mode="json"))


@router.post("/generation/tasks/{task_id}/cancel")
def cancel_generation_task(
    task_id: UUID,
    principal: Principal = Depends(require_permission(projects:write)),
    db: Session = Depends(get_db),
) -> dict:
    task = generation_service.get_task_or_404(db, task_id)
    projects_service.get_accessible_project(
        db,
        task.project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="projects:write",
    )
    generation_service.request_cancel(db, task)
    db.commit()
    return envelope(GenerationTaskRead.model_validate(task).model_dump(mode="json"))
