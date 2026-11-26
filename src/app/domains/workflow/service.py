"""Persistent workflow engine.

Invariants (see docs/10-development/WORKFLOW_AND_TASKS.md):

* The API writes business state, node runs and outbox events in one transaction.
* A dispatcher publishes outbox events; duplicate delivery is allowed.
* A worker claims a node with a lease and is idempotent inside the lease.
* Every retry is a new attempt with bounded exponential backoff.
* An orphaned node (expired lease) is reclaimed from the last safe checkpoint.
"""

import hashlib
import json
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.domains.generation.models import GenerationTask
from app.domains.workflow import repository as workflow_repo
from app.domains.workflow.constants import (
    DEFAULT_LEASE_SECONDS,
    DEFAULT_NODE_MAX_ATTEMPTS,
    DEFAULT_TEMPLATE,
    DEFAULT_WORKFLOW_CODE,
    DISPATCH_TOPIC,
    MAX_BACKOFF_SECONDS,
    RETRY_BASE_SECONDS,
)
from app.domains.workflow.models import (
    NODE_STATUSES,
    TERMINAL_NODE_STATUSES,
    OutboxEvent,
    WorkflowCheckpoint,
    WorkflowDefinition,
    WorkflowNodeRun,
    WorkflowRun,
    WorkflowVersion,
)
from app.infrastructure.providers.base import Capability
from app.infrastructure.providers.registry import ProviderRegistry
from app.public.constants import ErrorCode
from app.public.exceptions import conflict, not_found, validation_error
from app.utils.datetime import utcnow


def checksum(definition: dict) -> str:
    return hashlib.sha256(json.dumps(definition, sort_keys=True, default=str).encode()).hexdigest()


def backoff_seconds(attempt: int) -> int:
    return min(RETRY_BASE_SECONDS * (2 ** max(attempt - 1, 0)), MAX_BACKOFF_SECONDS)


# --------------------------------------------------------------------------- definitions


def get_or_create_workflow(
    db: Session, project_id: UUID, code: str = DEFAULT_WORKFLOW_CODE
) -> tuple[WorkflowDefinition, WorkflowVersion | None]:
    workflow = workflow_repo.get_workflow(db, project_id, code)
    if workflow is not None:
        return workflow, workflow_repo.latest_version(db, workflow.id)

    definition = DEFAULT_TEMPLATE if code == DEFAULT_WORKFLOW_CODE else {"nodes": []}
    workflow = workflow_repo.add_row(
        db,
        WorkflowDefinition(
            project_id=project_id, code=code, name=code.replace("-", " ").title(), is_active=True
        ),
    )
    version = workflow_repo.add_row(
        db,
        WorkflowVersion(
            workflow_id=workflow.id,
            version_number=1,
            definition=definition,
            checksum=checksum(definition),
        ),
    )
    return workflow, version


def _assert_valid_definition(definition: dict) -> None:
    nodes = definition.get("nodes") or []
    keys = [node.get("key") for node in nodes]
    if not nodes or any(not key for key in keys):
        raise validation_error("Workflow definition must contain keyed nodes")
    if len(set(keys)) != len(keys):
        raise validation_error("Workflow node keys must be unique")
    for node in nodes:
        unknown = [dep for dep in node.get("depends_on", []) if dep not in keys]
        if unknown:
            raise validation_error(
                f"Node '{node.get('key')}' depends on unknown nodes: {unknown}"
            )
        if node.get("type", "generation") not in ("generation", "pass_through", "review_gate"):
            raise validation_error(f"Node '{node.get('key')}' has an unsupported type")


def add_workflow_version(
    db: Session, workflow: WorkflowDefinition, definition: dict
) -> WorkflowVersion:
    _assert_valid_definition(definition)
    version = workflow_repo.add_row(
        db,
        WorkflowVersion(
            workflow_id=workflow.id,
            version_number=workflow_repo.max_version_number(db, workflow.id) + 1,
            definition=definition,
            checksum=checksum(definition),
        ),
    )
    return version


# --------------------------------------------------------------------------- runs


def get_run_or_404(db: Session, run_id: UUID) -> WorkflowRun:
    run = workflow_repo.get_run(db, run_id)
    if run is None:
        raise not_found("Workflow run not found")
    return run


def get_nodes(db: Session, run_id: UUID) -> list[WorkflowNodeRun]:
    return workflow_repo.list_nodes(db, run_id)


def get_node(db: Session, run_id: UUID, node_key: str) -> WorkflowNodeRun:
    node = workflow_repo.get_node_by_key(db, run_id, node_key)
    if node is None:
        raise not_found(f"Workflow node '{node_key}' not found in this run")
    return node


def list_runs(db: Session, project_id: UUID, limit: int = 50) -> list[WorkflowRun]:
    return workflow_repo.list_runs_for_project(db, project_id, limit=limit)


def create_run(
    db: Session,
    *,
    project_id: UUID,
    idempotency_key: str,
    triggered_by: UUID | None,
    context: dict | None = None,
    workflow_code: str = DEFAULT_WORKFLOW_CODE,
) -> tuple[WorkflowRun, bool]:
    if not idempotency_key.strip():
        raise validation_error("Idempotency-Key is required")

    existing = workflow_repo.find_run_by_idempotency(
        db, project_id=project_id, idempotency_key=idempotency_key
    )
    if existing is not None:
        return existing, False

    workflow, version = get_or_create_workflow(db, project_id, workflow_code)
    if version is None or not (version.definition or {}).get("nodes"):
        raise validation_error("Workflow has no runnable version")

    run = workflow_repo.add_row(
        db,
        WorkflowRun(
            project_id=project_id,
            workflow_id=workflow.id,
            version_id=version.id,
            status="running",
            idempotency_key=idempotency_key,
            context=context or {},
            triggered_by=triggered_by,
            started_at=utcnow(),
        ),
    )
    for ordinal, node in enumerate(version.definition.get("nodes", [])):
        depends_on = list(node.get("depends_on") or [])
        workflow_repo.add_row(
            db,
            WorkflowNodeRun(
                run_id=run.id,
                node_key=node["key"],
                ordinal=ordinal,
                node_type=node.get("type", "generation"),
                status="ready" if not depends_on else "pending",
                depends_on=depends_on,
                payload=dict(node.get("payload") or {}),
                max_attempts=int(node.get("max_attempts", DEFAULT_NODE_MAX_ATTEMPTS)),
            ),
        )
    enqueue_dispatch(db, run.id)
    return run, True


# --------------------------------------------------------------------------- outbox


def enqueue_dispatch(db: Session, run_id: UUID) -> OutboxEvent:
    return workflow_repo.add_row(
        db,
        OutboxEvent(topic=DISPATCH_TOPIC, payload={"run_id": str(run_id)}, status="pending"),
    )


def pending_events(db: Session, limit: int = 50) -> list[OutboxEvent]:
    return workflow_repo.list_pending_events(db, now=utcnow(), limit=limit)


def dispatch_outbox(db: Session, send: Any = None, limit: int = 50) -> int:
    """Publish pending outbox events. ``send`` is injectable so tests need no broker."""
    if send is None:
        from app.workers.celery_app import celery_app

        def send(topic: str, payload: dict) -> None:  # noqa: F811 - broker default
            celery_app.send_task(topic, kwargs=payload)

    dispatched = 0
    for event in pending_events(db, limit=limit):
        try:
            send(event.topic, dict(event.payload))
        except Exception as exc:  # noqa: BLE001 - a broker outage must not lose the event
            event.attempts += 1
            event.status = "failed"
            event.payload = {**event.payload, "last_error": str(exc)[:200]}
            continue
        event.status = "published"
        event.attempts += 1
        event.published_at = utcnow()
        dispatched += 1
    db.flush()
    return dispatched


# --------------------------------------------------------------------------- node lifecycle


def claim_next_node(
    db: Session, run_id: UUID, worker_id: str, lease_seconds: int = DEFAULT_LEASE_SECONDS
) -> WorkflowNodeRun | None:
    """Atomically lease one ready node. Safe for concurrent workers."""
    now = utcnow()
    candidate = workflow_repo.first_leasable_node(db, run_id, now)
    if candidate is None:
        return None
    candidate.status = "running"
    candidate.lease_owner = worker_id
    candidate.lease_expires_at = now + timedelta(seconds=lease_seconds)
    candidate.heartbeat_at = now
    candidate.started_at = candidate.started_at or now
    candidate.attempt_count += 1
    db.flush()
    return candidate


def heartbeat(
    db: Session, node: WorkflowNodeRun, lease_seconds: int = DEFAULT_LEASE_SECONDS
) -> None:
    now = utcnow()
    node.heartbeat_at = now
    node.lease_expires_at = now + timedelta(seconds=lease_seconds)
    db.flush()


def record_checkpoint(
    db: Session, node: WorkflowNodeRun, state: dict, note: str | None = None
) -> WorkflowCheckpoint:
    ordinal = workflow_repo.max_checkpoint_ordinal(db, node.id) + 1
    checkpoint = workflow_repo.add_row(
        db, WorkflowCheckpoint(node_run_id=node.id, ordinal=ordinal, state=state, note=note)
    )
    return checkpoint


def complete_node(db: Session, node: WorkflowNodeRun, output: dict) -> WorkflowRun:
    now = utcnow()
    node.status = "succeeded"
    node.output = output
    node.error_code = None
    node.error_message = None
    node.finished_at = now
    node.lease_owner = None
    node.lease_expires_at = None
    record_checkpoint(db, node, {"output": output, "stage": "completed"})
    db.flush()
    _release_dependents(db, node.run_id)
    run = get_run_or_404(db, node.run_id)
    _finalize_run(db, run)
    return run


def fail_node(
    db: Session, node: WorkflowNodeRun, error_code: str, error_message: str
) -> WorkflowRun:
    node.error_code = error_code
    node.error_message = error_message[:500]
    node.lease_owner = None
    node.lease_expires_at = None
    if node.attempt_count < node.max_attempts:
        node.status = "retry_wait"
    else:
        node.status = "failed"
        node.finished_at = utcnow()
    db.flush()
    run = get_run_or_404(db, node.run_id)
    _finalize_run(db, run)
    return run


def cancel_run(db: Session, run: WorkflowRun) -> WorkflowRun:
    if run.status in ("succeeded", "failed", "cancelled"):
        raise conflict(f"Workflow run is already terminal in state '{run.status}'")
    now = utcnow()
    run.status = "cancelled"
    run.finished_at = now
    for node in get_nodes(db, run.id):
        if node.status not in TERMINAL_NODE_STATUSES:
            node.status = "cancelled"
            node.finished_at = now
    db.flush()
    return run


def _release_dependents(db: Session, run_id: UUID) -> None:
    nodes = get_nodes(db, run_id)
    by_key = {node.node_key: node for node in nodes}
    for node in nodes:
        if node.status != "pending":
            continue
        ready = all(
            by_key.get(dep) is not None and by_key[dep].status == "succeeded"
            for dep in (node.depends_on or [])
        )
        if ready:
            node.status = "ready"
    db.flush()


def _finalize_run(db: Session, run: WorkflowRun) -> None:
    nodes = get_nodes(db, run.id)
    statuses = {node.status for node in nodes}
    if run.status == "cancelled":
        return
    if any(status == "failed" for status in statuses):
        run.status = "failed"
        failed = next(node for node in nodes if node.status == "failed")
        run.error_code = failed.error_code or ErrorCode.WORKFLOW_NODE_FAILED
        run.error_message = failed.error_message
        run.finished_at = utcnow()
    elif all(status in ("succeeded", "skipped") for status in statuses):
        run.status = "succeeded"
        run.finished_at = utcnow()
        run.error_code = None
        run.error_message = None
    else:
        run.status = "running"
    db.flush()
    if run.status == "running" and any(status == "ready" for status in statuses):
        enqueue_dispatch(db, run.id)


# --------------------------------------------------------------------------- execution


def execute_node_run(
    db: Session,
    registry: ProviderRegistry,
    node: WorkflowNodeRun,
    *,
    worker_id: str = "worker",
) -> WorkflowRun:
    """Run one leased node to completion or to a recorded failure.

    The node is claimed by ``claim_next_node``; execution is idempotent per attempt because
    the generation idempotency key embeds run, node and attempt number.
    """
    if node.status != "running" or node.lease_owner != worker_id:
        raise conflict("Node is not leased by this worker", {"code": ErrorCode.NODE_NOT_LEASED})

    from app.domains.generation import service as generation_service

    record_checkpoint(
        db, node, {"attempt": node.attempt_count, "worker": worker_id, "stage": "started"}
    )
    run = get_run_or_404(db, node.run_id)

    if node.node_type == "pass_through":
        complete_node(db, node, {"kind": "pass_through", "payload": node.payload})
        return get_run_or_404(db, node.run_id)

    if node.node_type == "review_gate":
        node.status = "waiting_review"
        node.lease_owner = None
        node.lease_expires_at = None
        db.flush()
        return run

    payload = dict(node.payload or {})
    capability_name = str(payload.get("capability", "text_generation"))
    try:
        capability = Capability(capability_name)
    except ValueError:
        return fail_node(
            db, node, ErrorCode.WORKFLOW_NODE_INVALID, f"Unknown capability {capability_name}"
        )

    task, _ = generation_service.create_task(
        db,
        project_id=run.project_id,
        capability=capability,
        prompt=str(payload.get("prompt", "")),
        parameters=dict(payload.get("parameters") or {}),
        model_code=str(payload.get("model_code", "mock-default")),
        provider_code=str(payload.get("provider_code", "mock")),
        idempotency_key=f"wf:{run.id}:{node.node_key}:{node.attempt_count}",
        requested_by=run.triggered_by,
        max_attempts=1,
    )
    node.generation_task_id = task.id
    db.flush()

    task = generation_service.execute_task_now(db, registry, task)
    if task.status != "succeeded":
        return fail_node(
            db,
            node,
            task.error_code or ErrorCode.PROVIDER_UNAVAILABLE,
            task.error_message or "Generation failed",
        )
    return complete_node(
        db, node, {"kind": "generation", "task_id": str(task.id), "result": task.result_payload}
    )


def run_one_step(
    db: Session,
    registry: ProviderRegistry,
    run_id: UUID,
    worker_id: str,
    lease_seconds: int = DEFAULT_LEASE_SECONDS,
) -> WorkflowNodeRun | None:
    """Claim and execute one node; returns the node it processed, or None when idle."""
    node = claim_next_node(db, run_id, worker_id, lease_seconds=lease_seconds)
    if node is None:
        return None
    execute_node_run(db, registry, node, worker_id=worker_id)
    return node


# --------------------------------------------------------------------------- recovery


def promote_retries(
    db: Session, run_id: UUID | None = None, *, now: datetime | None = None
) -> int:
    """Move retry_wait nodes to ready once their backoff window has elapsed."""
    promoted = 0
    reference = now or utcnow()
    for node in workflow_repo.list_nodes_with_status(db, "retry_wait", run_id=run_id):
        if node.updated_at is None:
            node.status = "ready"
            promoted += 1
            continue
        if reference >= node.updated_at + timedelta(seconds=backoff_seconds(node.attempt_count)):
            node.status = "ready"
            promoted += 1
    db.flush()
    return promoted


def recover_orphans(db: Session, run_id: UUID | None = None) -> int:
    """Reclaim nodes whose worker died: an expired lease means the attempt is lost.

    The node resumes from its last safe checkpoint by being re-queued, or fails once the
    attempt budget is exhausted. Nothing is silently marked successful.
    """
    recovered = 0
    now = utcnow()
    for node in workflow_repo.list_nodes_with_status(db, "running", run_id=run_id):
        if node.lease_expires_at is not None and node.lease_expires_at > now:
            continue
        node.lease_owner = None
        node.error_code = ErrorCode.WORKER_LEASE_EXPIRED
        node.error_message = "Recovered after the worker lease expired"
        if node.attempt_count >= node.max_attempts:
            node.status = "failed"
            node.finished_at = now
        else:
            node.status = "retry_wait"
        recovered += 1
        run = get_run_or_404(db, node.run_id)
        _finalize_run(db, run)
    db.flush()
    return recovered


def node_status_counts(db: Session, run_id: UUID) -> dict[str, int]:
    counts = {status: 0 for status in NODE_STATUSES}
    for node in get_nodes(db, run_id):
        counts[node.status] = counts.get(node.status, 0) + 1
    return counts


def pending_generation_task(db: Session, node: WorkflowNodeRun) -> GenerationTask | None:
    if node.generation_task_id is None:
        return None
    return workflow_repo.get_generation_task(db, node.generation_task_id)
