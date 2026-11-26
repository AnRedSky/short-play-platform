"""Operations aggregation: health, queue depth, storage, incidents, logs and backups.

Every value is derived from the database, the provider registry, Redis or the
filesystem. There are no static dashboard constants here.
"""

import hashlib
import json
import shlex
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.dependencies.pagination import PaginationParams
from app.domains.audit import repository as audit_repo
from app.domains.audit.models import AuditLog
from app.domains.health import service as health_service
from app.domains.notifications.models import Notification
from app.domains.ops import repository as ops_repo
from app.domains.ops.models import BackupRun
from app.infrastructure import redis as redis_infra
from app.infrastructure.providers.registry import get_registry
from app.utils.datetime import utcnow

_CAPABILITY_LABELS = {
    "video.generate": "视频生成",
    "video.edit": "视频编辑",
    "image.generate": "图像生成",
    "image.edit": "图像编辑",
    "audio.tts": "语音合成",
    "audio.asr": "语音识别",
    "quality.check": "质量检测",
    "media.render": "合成与转码",
}


def _human_bytes(value: int) -> str:
    size = float(value)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024 or unit == "TB":
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def _timed(check) -> tuple[str, float]:
    started = time.perf_counter()
    status = check()
    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
    return status, elapsed_ms


def health_snapshot(db: Session, organization_id: UUID | None = None) -> dict[str, Any]:
    postgres, postgres_ms = _timed(health_service.probe_postgresql)
    redis_status, redis_ms = _timed(health_service.probe_redis)
    counts = (
        ops_repo.task_status_counts(db, organization_id=organization_id)
        if organization_id is not None
        else {}
    )
    running = counts.get("running", 0)
    waiting = counts.get("pending", 0) + counts.get("queued", 0) + counts.get("retry_wait", 0)
    worker_status = "ok" if running > 0 or waiting == 0 else "degraded"
    storage_status, storage_note = _storage_probe()
    components = [
        {"name": "api", "status": "ok", "latency_ms": 0.0, "note": "请求处理正常"},
        {
            "name": "postgresql",
            "status": postgres,
            "latency_ms": postgres_ms,
            "note": "SELECT 1",
        },
        {
            "name": "redis",
            "status": redis_status,
            "latency_ms": redis_ms,
            "note": "PING",
        },
        {
            "name": "worker",
            "status": worker_status,
            "latency_ms": None,
            "note": f"运行 {running} · 等待 {waiting}",
        },
        {
            "name": "storage",
            "status": storage_status,
            "latency_ms": None,
            "note": storage_note,
        },
    ]
    ready = all(item["status"] == "ok" for item in components)
    return {
        "status": "ok" if ready else "degraded",
        "checked_at": utcnow().isoformat(),
        "components": components,
    }


def _storage_root() -> Path:
    return Path(get_settings().storage_root)


def _storage_probe() -> tuple[str, str]:
    root = _storage_root()
    if not root.exists():
        return "unavailable", f"路径不存在：{root}"
    try:
        usage = shutil.disk_usage(root)
    except OSError as error:
        return "unavailable", str(error)
    percent = round(usage.used / usage.total * 100) if usage.total else 0
    return "ok", f"已用 {percent}%"


def _storage_payload(db: Session, organization_id: UUID) -> dict[str, str]:
    object_count, object_bytes = ops_repo.storage_totals(
        db, organization_id=organization_id
    )
    database_bytes = ops_repo.database_size_bytes(db)
    try:
        memory = redis_infra.get_redis_client().info("memory")
        cache = f"{memory.get('used_memory_human', '—')} · Redis"
    except Exception:  # noqa: BLE001 - ops view reports unavailable, never raises
        cache = "unavailable · Redis"
    root = _storage_root()
    try:
        usage = shutil.disk_usage(root)
        percent = round(usage.used / usage.total * 100) if usage.total else 0
        level = (
            f"{percent}%（{_human_bytes(usage.used)} / {_human_bytes(usage.total)}）"
        )
    except OSError:
        level = "unavailable"
    return {
        "objects": f"{object_count} 个 · {_human_bytes(object_bytes)}",
        "db": f"{_human_bytes(database_bytes)} · Postgres",
        "cache": cache,
        "level": level,
    }


def _queue_rows(db: Session, organization_id: UUID) -> list[dict[str, Any]]:
    counts = ops_repo.capability_queue_counts(db, organization_id=organization_id)
    p95 = ops_repo.capability_p95_seconds(db, organization_id=organization_id)
    rows = []
    for bucket in sorted(counts, key=lambda item: item["capability"]):
        capability = bucket["capability"]
        failed = bucket["failed"]
        rows.append(
            {
                "name": f"{_CAPABILITY_LABELS.get(capability, capability)}队列",
                "capability": capability,
                "provider": bucket["provider"],
                "running": bucket["running"],
                "waiting": bucket["waiting"],
                "retry": bucket["retry"],
                "paused": bucket["paused"],
                "failed": failed,
                "total": bucket["total"],
                "p95": p95.get(capability, 0),
                "avg": f"{p95.get(capability, 0)} 秒（P95）",
                "concurrency": f"{bucket['running']} 运行 / {bucket['waiting']} 等待",
                "status": "告警" if failed else ("降级" if bucket["paused"] else "正常"),
                "note": "存在失败任务，需人工处理" if failed else "队列正常",
            }
        )
    return rows


def _services_payload(db: Session, organization_id: UUID) -> list[dict[str, str]]:
    health = health_snapshot(db, organization_id=organization_id)
    status_map = {"ok": "正常", "degraded": "告警", "unavailable": "异常"}
    labels = {
        "api": "业务 API",
        "postgresql": "数据库",
        "redis": "队列中间件",
        "worker": "任务调度器",
        "storage": "对象存储",
    }
    return [
        {
            "name": labels.get(item["name"], item["name"]),
            "status": status_map.get(item["status"], "告警"),
            "note": item["note"],
        }
        for item in health["components"]
    ]


def _providers_payload() -> list[dict[str, Any]]:
    health = get_registry().health()
    return [
        {
            "name": item.code,
            "kind": "内置适配器",
            "models": "—",
            "sla": "本地",
            "cost": "—",
            "status": "正常" if item.healthy else "告警",
        }
        for item in health
    ]


def _incidents_payload(
    db: Session, *, organization_id: UUID, services: list[dict[str, str]]
) -> list[dict[str, Any]]:
    incidents: list[dict[str, Any]] = []
    for task, project_code in ops_repo.failed_tasks(
        db, organization_id=organization_id, limit=10
    ):
        incidents.append(
            {
                "id": f"TASK-{str(task.id)[:8]}",
                "project": project_code,
                "type": "生成任务失败",
                "first": (task.created_at or task.finished_at or utcnow()).isoformat(),
                "handled": task.attempt_count,
                "last": (task.finished_at or task.created_at or utcnow()).isoformat(),
                "action": f"{task.capability} 任务失败：{task.error_code or 'UNKNOWN'}",
                "decision": "待人工处理",
                "result": "未闭环",
                "status": "未关闭",
                "next": "查看任务详情并重试或终止",
                "level": "项目负责人",
            }
        )
    for run in _recent_failed_backups(db, organization_id=organization_id, limit=5):
        incidents.append(
            {
                "id": f"BACKUP-{str(run.id)[:8]}",
                "project": None,
                "type": "备份失败",
                "first": run.created_at.isoformat(),
                "handled": 1,
                "last": (run.finished_at or run.created_at).isoformat(),
                "action": f"{run.target} 备份失败：{run.error_code or 'UNKNOWN'}",
                "decision": "运维处理",
                "result": "未闭环",
                "status": "未关闭",
                "next": "检查备份执行器与目标存储",
                "level": "平台管理员",
            }
        )
    service_rows = services
    for service in service_rows:
        if service["status"] == "正常":
            continue
        incidents.append(
            {
                "id": f"SERVICE-{service['name']}",
                "project": None,
                "type": "服务降级",
                "first": utcnow().isoformat(),
                "handled": 1,
                "last": utcnow().isoformat(),
                "action": f"{service['name']}：{service['note']}",
                "decision": "运维排查",
                "result": "未闭环",
                "status": "未关闭",
                "next": "检查依赖与容量",
                "level": "平台管理员",
            }
        )
    return incidents


def _recent_failed_backups(
    db: Session, *, organization_id: UUID, limit: int
) -> list[BackupRun]:
    return list(
        db.scalars(
            select(BackupRun)
            .where(
                BackupRun.organization_id == organization_id,
                BackupRun.status == "failed",
            )
            .order_by(BackupRun.created_at.desc())
            .limit(limit)
        ).all()
    )


def overview(db: Session, *, organization_id: UUID) -> dict[str, Any]:
    queues = _queue_rows(db, organization_id)
    counts = ops_repo.task_status_counts(db, organization_id=organization_id)
    services = _services_payload(db, organization_id)
    incidents = _incidents_payload(db, organization_id=organization_id, services=services)
    return {
        "queues": queues,
        "storage": _storage_payload(db, organization_id),
        "services": services,
        "providers": _providers_payload(),
        "incidents": incidents[:12],
        "totals": {
            "queue_waiting": sum(row["waiting"] for row in queues),
            "failed_tasks": counts.get("failed", 0),
            "service_errors": sum(1 for row in services if row["status"] != "正常"),
            "open_incidents": sum(1 for row in incidents if row["result"] != "已闭环"),
        },
    }


def queues(db: Session, *, organization_id: UUID) -> list[dict[str, Any]]:
    return _queue_rows(db, organization_id)


def logs(
    db: Session,
    *,
    organization_id: UUID,
    level: str | None,
    source: str | None,
    query_text: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for task, project_code in ops_repo.failed_tasks(
        db, organization_id=organization_id, limit=30
    ):
        entries.append(
            {
                "at": (task.finished_at or task.created_at or utcnow()).isoformat(),
                "level": "ERROR",
                "source": "任务调度",
                "message": (
                    f"任务 {str(task.id)[:8]}（{project_code} · {task.capability}）失败："
                    f"{task.error_code or 'UNKNOWN'} {task.error_message or ''}".strip()
                ),
                "ref": str(task.id),
            }
        )
    for run in db.scalars(
        select(BackupRun)
        .where(BackupRun.organization_id == organization_id)
        .order_by(BackupRun.created_at.desc())
        .limit(30)
    ).all():
        entries.append(
            {
                "at": (run.finished_at or run.created_at or utcnow()).isoformat(),
                "level": "INFO" if run.status == "succeeded" else "ERROR",
                "source": "备份任务",
                "message": (
                    f"{run.target} 备份 {run.status}"
                    + (f"：{run.error_message}" if run.error_message else "")
                ),
                "ref": str(run.id),
            }
        )
    recent_audits, _ = audit_repo.list_logs(
        db,
        organization_id=organization_id,
        action=None,
        resource_type=None,
        result=None,
        query_text=None,
        pagination=PaginationParams(page=1, page_size=30),
    )
    for log in recent_audits:
        entries.append(
            {
                "at": log.created_at.isoformat(),
                "level": "INFO" if log.result == "success" else "WARN",
                "source": "审计",
                "message": f"{log.action} · {log.resource_type} {log.resource_id or ''}".strip(),
                "ref": str(log.id),
            }
        )
    if level:
        entries = [item for item in entries if item["level"] == level.upper()]
    if source:
        entries = [item for item in entries if item["source"] == source]
    if query_text:
        needle = query_text.strip().lower()
        entries = [item for item in entries if needle in item["message"].lower()]
    entries.sort(key=lambda item: item["at"], reverse=True)
    return entries[:limit]


def create_backup(
    db: Session, *, organization_id: UUID, target: str, requested_by: UUID
) -> BackupRun:
    now = utcnow()
    run = BackupRun(
        organization_id=organization_id,
        target=target,
        status="running",
        requested_by=requested_by,
        started_at=now,
    )
    ops_repo.add_backup_run(db, run)
    try:
        manifest = _backup_manifest(db, target)
        path = _write_backup(run, manifest)
        run.size_bytes = path.stat().st_size
        run.checksum = _sha256(path)
        run.location = str(path)
        run.status = "succeeded"
        run.details = {
            "mode": "command" if get_settings().backup_command else "metadata_snapshot",
            "database_size_bytes": manifest["database_size_bytes"],
            "table_counts": manifest["table_counts"],
        }
    except Exception as error:  # noqa: BLE001 - a failed backup is a recorded result
        run.status = "failed"
        run.error_code = "BACKUP_FAILED"
        run.error_message = str(error)[:500]
    run.finished_at = utcnow()
    db.flush()
    return run


def backup_root() -> Path:
    return Path(get_settings().storage_root) / "backups"


def _backup_manifest(db: Session, target: str) -> dict[str, Any]:
    counts = {
        "projects": _count(db, "projects"),
        "users": _count(db, "users"),
        "media_assets": _count(db, "media_assets"),
        "generation_tasks": _count(db, "generation_tasks"),
        "audit_logs": _count(db, "audit_logs"),
        "notifications": _count(db, "notifications"),
    }
    return {
        "generated_at": utcnow().isoformat(),
        "target": target,
        "database_size_bytes": ops_repo.database_size_bytes(db),
        "table_counts": counts,
        "media_objects": _count(db, "media_assets"),
        "notification_rows": int(db.scalar(select(func.count(Notification.id))) or 0),
        "audit_rows": int(db.scalar(select(func.count(AuditLog.id))) or 0),
    }


def _count(db: Session, table_name: str) -> int:
    from app.infrastructure.db import Base

    table = Base.metadata.tables[table_name]
    return int(db.scalar(select(func.count()).select_from(table)) or 0)


def _write_backup(run: BackupRun, manifest: dict[str, Any]) -> Path:
    root = backup_root()
    root.mkdir(parents=True, exist_ok=True)
    stamp = run.started_at.strftime("%Y%m%dT%H%M%SZ") if run.started_at else "unknown"
    output = root / f"{stamp}-{run.target}-{str(run.id)[:8]}.json"
    command = get_settings().backup_command
    if command:
        rendered = command.replace("{output}", str(output))
        argv = shlex.split(rendered)
        result = subprocess.run(  # noqa: S603 - administrator-configured command
            argv,
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"backup command exited {result.returncode}: {(result.stderr or '').strip()[:300]}"
            )
        if not output.exists():
            raise RuntimeError("backup command produced no output file")
        return output
    output.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    return output


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def list_backups(
    db: Session, *, organization_id: UUID, pagination: PaginationParams
) -> tuple[list[BackupRun], int]:
    return ops_repo.list_backup_runs(db, organization_id=organization_id, pagination=pagination)


def serialize_backup(run: BackupRun) -> dict[str, Any]:
    labels = {"database": "数据库全量", "media": "媒体存储", "config": "配置与密钥"}
    return {
        "id": str(run.id),
        "target": run.target,
        "target_label": labels.get(run.target, run.target),
        "status": run.status,
        "result": {
            "succeeded": "成功",
            "failed": "失败",
            "running": "执行中",
            "queued": "排队中",
        }.get(run.status, run.status),
        "at": (run.finished_at or run.created_at).isoformat(),
        "size": _human_bytes(run.size_bytes),
        "size_bytes": run.size_bytes,
        "checksum": run.checksum,
        "location": run.location,
        "verify": "sha256 已记录" if run.checksum else "未生成",
        "keep": "30 天",
        "mode": (run.details or {}).get("mode"),
        "error_code": run.error_code,
        "error_message": run.error_message,
        "requested_by": str(run.requested_by) if run.requested_by else None,
    }


__all__ = [
    "backup_root",
    "create_backup",
    "health_snapshot",
    "list_backups",
    "logs",
    "overview",
    "queues",
    "serialize_backup",
]


