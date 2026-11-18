"""Workflow data access: definitions, runs, node runs, checkpoints and outbox."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.generation.models import GenerationTask
from app.domains.workflow.models import (
    OutboxEvent,
    WorkflowCheckpoint,
    WorkflowDefinition,
    WorkflowNodeRun,
    WorkflowRun,
    WorkflowVersion,
)


def add_row(db: Session, row: object) -> object:
    db.add(row)
    db.flush()
    return row


def get_workflow(db: Session, project_id: UUID, code: str) -> WorkflowDefinition | None:
    return db.scalar(
        select(WorkflowDefinition).where(
            WorkflowDefinition.project_id == project_id, WorkflowDefinition.code == code
        )
    )


def latest_version(db: Session, workflow_id: UUID) -> WorkflowVersion | None:
    return db.scalar(
        select(WorkflowVersion)
        .where(WorkflowVersion.workflow_id == workflow_id)
        .order_by(WorkflowVersion.version_number.desc())
    )


def max_version_number(db: Session, workflow_id: UUID) -> int:
    latest = db.scalar(
        select(func.max(WorkflowVersion.version_number)).where(
            WorkflowVersion.workflow_id == workflow_id
        )
    )
    return int(latest or 0)


def get_run(db: Session, run_id: UUID) -> WorkflowRun | None:
    return db.get(WorkflowRun, run_id)


def find_run_by_idempotency(
    db: Session, *, project_id: UUID, idempotency_key: str
) -> WorkflowRun | None:
    return db.scalar(
        select(WorkflowRun).where(
            WorkflowRun.project_id == project_id, WorkflowRun.idempotency_key == idempotency_key
        )
    )


def list_runs_for_project(db: Session, project_id: UUID, limit: int = 50) -> list[WorkflowRun]:
    return list(
        db.scalars(
            select(WorkflowRun)
            .where(WorkflowRun.project_id == project_id)
            .order_by(WorkflowRun.created_at.desc())
            .limit(limit)
        ).all()
    )


def list_nodes(db: Session, run_id: UUID) -> list[WorkflowNodeRun]:
    return list(
        db.scalars(
            select(WorkflowNodeRun)
            .where(WorkflowNodeRun.run_id == run_id)
            .order_by(WorkflowNodeRun.ordinal, WorkflowNodeRun.node_key)
        ).all()
    )


def get_node_by_key(db: Session, run_id: UUID, node_key: str) -> WorkflowNodeRun | None:
    return db.scalar(
        select(WorkflowNodeRun).where(
            WorkflowNodeRun.run_id == run_id, WorkflowNodeRun.node_key == node_key
        )
    )


def list_nodes_with_status(
    db: Session, status: str, *, run_id: UUID | None = None
) -> list[WorkflowNodeRun]:
    query = select(WorkflowNodeRun).where(WorkflowNodeRun.status == status)
    if run_id is not None:
        query = query.where(WorkflowNodeRun.run_id == run_id)
    return list(db.scalars(query.order_by(WorkflowNodeRun.ordinal)).all())


def first_leasable_node(
    db: Session, run_id: UUID, now: datetime
) -> WorkflowNodeRun | None:
    """The ready node whose lease is free (or expired), lowest ordinal first."""
    return db.scalar(
        select(WorkflowNodeRun)
        .where(
            WorkflowNodeRun.run_id == run_id,
            WorkflowNodeRun.status == "ready",
            (WorkflowNodeRun.lease_expires_at.is_(None))
            | (WorkflowNodeRun.lease_expires_at < now),
        )
        .order_by(WorkflowNodeRun.ordinal)
        .limit(1)
    )


def max_checkpoint_ordinal(db: Session, node_run_id: UUID) -> int:
    latest = db.scalar(
        select(func.max(WorkflowCheckpoint.ordinal)).where(
            WorkflowCheckpoint.node_run_id == node_run_id
        )
    )
    return int(latest or 0)


def list_pending_events(
    db: Session, *, now: datetime, limit: int = 50
) -> list[OutboxEvent]:
    return list(
        db.scalars(
            select(OutboxEvent)
            .where(OutboxEvent.status == "pending", OutboxEvent.available_at <= now)
            .order_by(OutboxEvent.created_at)
            .limit(limit)
        ).all()
    )


def get_generation_task(db: Session, task_id: UUID) -> GenerationTask | None:
    return db.get(GenerationTask, task_id)
