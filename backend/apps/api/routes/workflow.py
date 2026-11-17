from uuid import UUID

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.deps import Principal, require_permission
from apps.api.models.workflow import WorkflowRun
from apps.api.schemas.common import envelope
from apps.api.schemas.workflow import (
    WorkflowDefinitionRead,
    WorkflowNodeRead,
    WorkflowRunCreate,
    WorkflowRunDetailRead,
    WorkflowRunRead,
)
from apps.api.services import workflow as workflow_service
from apps.api.services.projects import assert_project_access, get_project

router = APIRouter(tags=["workflow"])


def _access(
    db: Session, principal: Principal, project_id: UUID, need: str = "projects:read"
) -> None:
    assert_project_access(
        db,
        get_project(db, project_id),
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed=need,
    )


@router.get("/projects/{project_id}/workflows")
def read_workflow_definition(
    project_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id)
    workflow, version = workflow_service.get_or_create_workflow(db, project_id)
    db.commit()
    definition = version.definition or {}
    return envelope(
        WorkflowDefinitionRead(
            workflow_id=workflow.id,
            version_id=version.id,
            code=workflow.code,
            version_number=version.version_number,
            checksum=version.checksum,
            nodes=list(definition.get("nodes") or []),
        ).model_dump(mode="json")
    )


@router.post("/projects/{project_id}/workflow-runs", status_code=201)
def start_workflow_run(
    project_id: UUID,
    payload: WorkflowRunCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id, need="projects:write")
    import uuid as _uuid

    run, created = workflow_service.create_run(
        db,
        project_id=project_id,
        idempotency_key=idempotency_key or str(_uuid.uuid4()),
        triggered_by=principal.user.id,
        context=payload.context,
        workflow_code=payload.workflow_code,
    )
    db.commit()
    return envelope(
        WorkflowRunRead.model_validate(run).model_dump(mode="json"), {"created": created}
    )


@router.get("/projects/{project_id}/workflow-runs")
def list_workflow_runs(
    project_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id)
    runs = db.scalars(
        select(WorkflowRun)
        .where(WorkflowRun.project_id == project_id)
        .order_by(WorkflowRun.created_at.desc())
        .limit(50)
    ).all()
    return envelope([WorkflowRunRead.model_validate(run).model_dump(mode="json") for run in runs])


@router.get("/workflow-runs/{run_id}")
def read_workflow_run(
    run_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    run = workflow_service.get_run(db, run_id)
    _access(db, principal, run.project_id)
    nodes = [
        WorkflowNodeRead.model_validate(node).model_dump(mode="json")
        for node in workflow_service.get_nodes(db, run.id)
    ]
    detail = WorkflowRunDetailRead(**WorkflowRunRead.model_validate(run).model_dump(), nodes=nodes)
    return envelope(detail.model_dump(mode="json"))


@router.post("/workflow-runs/{run_id}/cancel")
def cancel_workflow_run(
    run_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    run = workflow_service.get_run(db, run_id)
    _access(db, principal, run.project_id, need="projects:write")
    workflow_service.cancel_run(db, run)
    db.commit()
    return envelope(WorkflowRunRead.model_validate(run).model_dump(mode="json"))


@router.post("/workflow-runs/{run_id}/recover")
def recover_workflow_run(
    run_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    """Reclaim orphaned nodes for an operator-initiated recovery."""
    run = workflow_service.get_run(db, run_id)
    _access(db, principal, run.project_id, need="projects:write")
    recovered = workflow_service.recover_orphans(db, run.id)
    promoted = workflow_service.promote_retries(db, run.id)
    db.commit()
    return envelope(
        {
            "run_id": str(run.id),
            "status": run.status,
            "recovered": recovered,
            "promoted": promoted,
        }
    )
