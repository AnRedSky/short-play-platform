"""Generation task HTTP contract: queue, controls, callbacks and recovery."""

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.domains.audit import service as audit_service
from app.domains.generation import service as generation_service
from app.domains.generation.models import GenerationTask
from app.domains.generation.schemas import (
    GenerationTaskCreate,
    GenerationTaskDetailRead,
    GenerationTaskRead,
    ProviderCallback,
    ProviderHealthRead,
    TaskAttemptRead,
)
from app.domains.projects import service as projects_service
from app.infrastructure.providers.registry import ProviderRegistry, get_registry
from app.public.constants import IDEMPOTENCY_KEY_HEADER
from app.public.schemas import envelope

router = APIRouter(tags=["generation"])


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _task_access(
    db: Session,
    principal: Principal,
    task_id: UUID,
    *,
    need: str = "project.read",
) -> GenerationTask:
    task = generation_service.get_task_or_404(db, task_id)
    projects_service.get_accessible_project(
        db,
        task.project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed=need,
    )
    return task


@router.get("/models/providers")
def list_providers(
    principal: Principal = Depends(require_permission("project.read")),
    registry: ProviderRegistry = Depends(get_registry),
) -> dict:
    return envelope(
        [
            ProviderHealthRead(code=health.code, healthy=health.healthy).model_dump(mode="json")
            for health in registry.health()
        ]
    )


@router.get("/projects/{project_id}/generation/tasks")
def list_generation_tasks(
    project_id: UUID,
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    principal: Principal = Depends(require_permission("task.read")),
    db: Session = Depends(get_db),
) -> dict:
    projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="task.read",
    )
    rows, total = generation_service.list_tasks(
        db,
        project_id=project_id,
        status=status,
        offset=(page - 1) * page_size,
        limit=page_size,
    )
    return envelope(
        [generation_service.serialize_task(task) for task in rows],
        {"total": total, "page": page, "page_size": page_size},
    )


@router.post("/projects/{project_id}/generation/tasks", status_code=201)
def create_generation_task(
    project_id: UUID,
    payload: GenerationTaskCreate,
    request: Request,
    idempotency_key: str = Header(alias=IDEMPOTENCY_KEY_HEADER, min_length=1, max_length=120),
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
    registry: ProviderRegistry = Depends(get_registry),
) -> dict:
    projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="creation.write",
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
        idempotency_key=idempotency_key,
        requested_by=principal.user.id,
        shot_id=payload.shot_id,
        max_attempts=payload.max_attempts,
    )
    if created:
        audit_service.record(
            db,
            actor_user_id=principal.user.id,
            action="generation.task_enqueued",
            resource_type="generation_task",
            resource_id=str(task.id),
            request_id=_request_id(request),
            details={
                "capability": task.capability,
                "status": task.status,
                "idempotency_key": task.idempotency_key,
                "max_attempts": task.max_attempts,
            },
        )
        db.commit()
    return envelope(
        generation_service.serialize_task(task),
        {"created": created, "queued": task.status == "queued"},
    )


@router.get("/generation/tasks/{task_id}")
def read_generation_task(
    task_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    task = _task_access(db, principal, task_id)
    attempts = [
        TaskAttemptRead.model_validate(attempt)
        for attempt in generation_service.get_attempts(db, task.id)
    ]
    detail = GenerationTaskDetailRead(
        **GenerationTaskRead.model_validate(task).model_dump(), attempts=attempts
    )
    return envelope(detail.model_dump(mode="json"))


@router.post("/generation/queue/dispatch")
def dispatch_queue(
    request: Request,
    limit: int = Query(default=10, ge=1, le=50),
    principal: Principal = Depends(require_permission("platform.config")),
    db: Session = Depends(get_db),
    registry: ProviderRegistry = Depends(get_registry),
) -> dict:
    tasks = generation_service.dispatch_tasks(db, registry, limit=limit)
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="generation.queue_dispatched",
        resource_type="generation_queue",
        resource_id="dispatch",
        request_id=_request_id(request),
        details={"claimed": len(tasks), "task_ids": [str(task.id) for task in tasks]},
    )
    db.commit()
    return envelope(
        {
            "claimed": len(tasks),
            "tasks": [generation_service.serialize_task(task) for task in tasks],
        }
    )


@router.post("/generation/queue/recover")
def recover_queue(
    request: Request,
    limit: int = Query(default=20, ge=1, le=50),
    principal: Principal = Depends(require_permission("platform.config")),
    db: Session = Depends(get_db),
) -> dict:
    tasks = generation_service.recover_expired_tasks(db, limit=limit)
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="generation.queue_recovered",
        resource_type="generation_queue",
        resource_id="recover",
        request_id=_request_id(request),
        details={"recovered": len(tasks), "task_ids": [str(task.id) for task in tasks]},
    )
    db.commit()
    return envelope(
        {
            "recovered": len(tasks),
            "tasks": [generation_service.serialize_task(task) for task in tasks],
        }
    )


@router.post("/generation/tasks/{task_id}/pause")
def pause_generation_task(
    task_id: UUID,
    request: Request,
    principal: Principal = Depends(require_permission("task.operate")),
    db: Session = Depends(get_db),
) -> dict:
    task = _task_access(db, principal, task_id, need="task.operate")
    generation_service.pause_task(db, task)
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="generation.task_paused",
        resource_type="generation_task",
        resource_id=str(task.id),
        request_id=_request_id(request),
    )
    db.commit()
    return envelope(generation_service.serialize_task(task))


@router.post("/generation/tasks/{task_id}/resume")
def resume_generation_task(
    task_id: UUID,
    request: Request,
    principal: Principal = Depends(require_permission("task.operate")),
    db: Session = Depends(get_db),
) -> dict:
    task = _task_access(db, principal, task_id, need="task.operate")
    generation_service.resume_task(db, task)
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="generation.task_resumed",
        resource_type="generation_task",
        resource_id=str(task.id),
        request_id=_request_id(request),
    )
    db.commit()
    return envelope(generation_service.serialize_task(task))


@router.post("/generation/tasks/{task_id}/retry")
def retry_generation_task(
    task_id: UUID,
    request: Request,
    principal: Principal = Depends(require_permission("task.operate")),
    db: Session = Depends(get_db),
) -> dict:
    task = _task_access(db, principal, task_id, need="task.operate")
    generation_service.retry_task(db, task)
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="generation.task_retried",
        resource_type="generation_task",
        resource_id=str(task.id),
        request_id=_request_id(request),
        details={"attempt_count": task.attempt_count, "max_attempts": task.max_attempts},
    )
    db.commit()
    return envelope(generation_service.serialize_task(task))


@router.post("/generation/tasks/{task_id}/cancel")
def cancel_generation_task(
    task_id: UUID,
    request: Request,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    task = _task_access(db, principal, task_id, need="creation.write")
    generation_service.request_cancel(db, task)
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="generation.task_cancel_requested",
        resource_type="generation_task",
        resource_id=str(task.id),
        request_id=_request_id(request),
        details={"status": task.status},
    )
    db.commit()
    return envelope(generation_service.serialize_task(task))


@router.post("/generation/providers/{provider_code}/callbacks")
def provider_callback(
    provider_code: str,
    payload: ProviderCallback,
    request: Request,
    principal: Principal = Depends(require_permission("platform.config")),
    db: Session = Depends(get_db),
) -> dict:
    task = generation_service.get_task_or_404(db, payload.task_id)
    result = generation_service.handle_provider_callback(
        db, task, payload, provider_code=provider_code
    )
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="generation.provider_callback",
        resource_type="generation_task",
        resource_id=str(task.id),
        request_id=_request_id(request),
        details={
            "callback_id": payload.callback_id,
            "event": payload.event,
            "applied": result.get("applied"),
            "duplicate": result.get("duplicate"),
        },
    )
    db.commit()
    return envelope(result)
