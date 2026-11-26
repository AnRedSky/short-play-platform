"""Operational data access: queue depth, failures, storage totals and backups."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.assets.models import MediaAsset
from app.domains.generation.models import GenerationTask, TaskAttempt
from app.domains.ops.models import BackupRun
from app.domains.projects.models import Project


def capability_queue_counts(db: Session, *, organization_id: UUID) -> list[dict]:
    rows = db.execute(
        select(
            GenerationTask.capability,
            GenerationTask.status,
            GenerationTask.provider_code,
            func.count(GenerationTask.id),
        )
        .join(Project, Project.id == GenerationTask.project_id)
        .where(Project.organization_id == organization_id)
        .group_by(
            GenerationTask.capability,
            GenerationTask.status,
            GenerationTask.provider_code,
        )
    ).all()
    buckets: dict[str, dict] = {}
    for capability, status, provider_code, count in rows:
        bucket = buckets.setdefault(
            capability,
            {
                "capability": capability,
                "provider": provider_code,
                "running": 0,
                "waiting": 0,
                "retry": 0,
                "paused": 0,
                "failed": 0,
                "total": 0,
            },
        )
        count = int(count)
        bucket["total"] += count
        if status == "running":
            bucket["running"] += count
        elif status in ("pending", "queued"):
            bucket["waiting"] += count
        elif status == "retry_wait":
            bucket["retry"] += count
        elif status == "paused":
            bucket["paused"] += count
        elif status == "failed":
            bucket["failed"] += count
    return list(buckets.values())


def capability_p95_seconds(db: Session, *, organization_id: UUID) -> dict[str, float]:
    rows = db.execute(
        select(
            GenerationTask.capability,
            func.percentile_cont(0.95).within_group(TaskAttempt.duration_ms),
        )
        .join(Project, Project.id == GenerationTask.project_id)
        .join(TaskAttempt, TaskAttempt.task_id == GenerationTask.id)
        .where(
            Project.organization_id == organization_id,
            TaskAttempt.duration_ms.is_not(None),
        )
        .group_by(GenerationTask.capability)
    ).all()
    return {
        capability: round(float(value) / 1000, 2)
        for capability, value in rows
        if value is not None
    }


def failed_tasks(
    db: Session, *, organization_id: UUID, limit: int = 20
) -> list[tuple[GenerationTask, str]]:
    rows = db.execute(
        select(GenerationTask, Project.code)
        .join(Project, Project.id == GenerationTask.project_id)
        .where(
            Project.organization_id == organization_id,
            GenerationTask.status == "failed",
        )
        .order_by(GenerationTask.finished_at.desc().nullslast())
        .limit(limit)
    ).all()
    return [(task, code) for task, code in rows]


def task_status_counts(db: Session, *, organization_id: UUID) -> dict[str, int]:
    rows = db.execute(
        select(GenerationTask.status, func.count(GenerationTask.id))
        .join(Project, Project.id == GenerationTask.project_id)
        .where(Project.organization_id == organization_id)
        .group_by(GenerationTask.status)
    ).all()
    return {status: int(count) for status, count in rows}


def storage_totals(db: Session, *, organization_id: UUID) -> tuple[int, int]:
    count, total_bytes = db.execute(
        select(func.count(MediaAsset.id), func.coalesce(func.sum(MediaAsset.size_bytes), 0))
        .join(Project, Project.id == MediaAsset.project_id)
        .where(Project.organization_id == organization_id)
    ).one()
    return int(count), int(total_bytes)


def database_size_bytes(db: Session) -> int:
    return int(db.scalar(select(func.pg_database_size(func.current_database()))) or 0)


def add_backup_run(db: Session, run: BackupRun) -> BackupRun:
    db.add(run)
    db.flush()
    return run


def list_backup_runs(
    db: Session, *, organization_id: UUID, pagination: PaginationParams
) -> tuple[list[BackupRun], int]:
    query = select(BackupRun).where(BackupRun.organization_id == organization_id)
    count_query = select(func.count(BackupRun.id)).where(
        BackupRun.organization_id == organization_id
    )
    rows = db.scalars(
        query.order_by(BackupRun.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()
    total = int(db.scalar(count_query) or 0)
    return list(rows), total
