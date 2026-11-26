"""B-08 timeline freeze, episode output, final review and delivery package."""

import hashlib
import io
import json
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.audit import service as audit_service
from app.domains.creation.models import Episode
from app.domains.delivery import repository as delivery_repo
from app.domains.delivery.constants import (
    FINAL_APPROVED,
    FINAL_LABELS,
    FINAL_REJECTED,
    OUTPUT_STATUS,
    PACKAGE_FROZEN,
    POST_STATUSES,
    TIMELINE_DRAFT,
    TIMELINE_FROZEN,
    TIMELINE_LABELS,
    TIMELINE_SUPERSEDED,
)
from app.domains.delivery.models import (
    DeliveryPackage,
    EpisodeOutput,
    FinalReview,
    TimelineVersion,
)
from app.domains.delivery.schemas import DeliveryCreate, FinalReviewRequest, TimelineCreate
from app.domains.projects import service as projects_service
from app.domains.projects.state_machine import normalize_status
from app.domains.users.models import User
from app.infrastructure import storage
from app.public.constants import ErrorCode
from app.public.exceptions import AppError, not_found, validation_error
from app.utils.datetime import utcnow


def _canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def _checksum(value: Any) -> str:
    return hashlib.sha256(_canonical(value)).hexdigest()


def _stamp(value: datetime | None) -> str:
    if value is None:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).strftime("%Y-%m-%d %H:%M")


def _duration_label(duration_ms: int) -> str:
    seconds = round(duration_ms / 1000)
    if seconds < 60:
        return f"{seconds} 秒"
    return f"{seconds // 60} 分 {seconds % 60} 秒"


def _size_label(size_bytes: int) -> str:
    value = float(size_bytes)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if value < 1024 or unit == "TB":
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} TB"


def _actor_name(db: Session, user_id: UUID | None) -> str:
    if user_id is None:
        return ""
    user = db.get(User, user_id)
    return user.full_name if user is not None else ""


def _ensure_post_state(project: Any) -> None:
    if normalize_status(project.status) not in POST_STATUSES:
        raise AppError(
            "项目当前不在后期制作中，不能修改时间线或输出分集",
            code=ErrorCode.TIMELINE_PROJECT_NOT_IN_POST,
            status_code=409,
            details={"status": project.status},
        )


def _timeline_checksum(timeline: TimelineVersion) -> str:
    return _checksum(
        {
            "episode": timeline.episode_number,
            "version": timeline.version_number,
            "timebase": timeline.timebase,
            "duration_ms": timeline.duration_ms,
            "tracks": timeline.tracks,
        }
    )


def serialize_timeline(timeline: TimelineVersion) -> dict:
    return {
        "id": timeline.code,
        "record_id": str(timeline.id),
        "project": timeline.project.code if timeline.project is not None else "",
        "ep": timeline.episode_number,
        "version": timeline.code,
        "versionNumber": timeline.version_number,
        "tracks": timeline.track_count,
        "trackItems": timeline.tracks,
        "clips": timeline.clip_count,
        "duration": _duration_label(timeline.duration_ms),
        "timebase": f"PTS + 1/{timeline.timebase} 时基",
        "status": TIMELINE_LABELS.get(timeline.status, timeline.status),
        "stale": timeline.stale_clips,
        "checksum": timeline.checksum,
        "note": timeline.note,
        "frozenAt": _stamp(timeline.frozen_at),
        "at": _stamp(timeline.created_at),
    }


def create_timeline(
    db: Session,
    *,
    project: Any,
    payload: TimelineCreate,
    actor_user_id: UUID,
) -> TimelineVersion:
    _ensure_post_state(project)
    if payload.episode_number > int(project.episodes or 1):
        raise validation_error(
            "Episode number exceeds the project episode count",
            {"episode_number": payload.episode_number, "episodes": project.episodes},
        )
    latest = delivery_repo.latest_timeline(db, project.id, payload.episode_number)
    if latest is not None and latest.status == TIMELINE_DRAFT:
        latest.status = TIMELINE_SUPERSEDED
        db.flush()

    version_number = delivery_repo.next_timeline_version(db, project.id, payload.episode_number)
    clip_count = sum(
        len(track.get("items") or []) if isinstance(track, dict) else 0
        for track in payload.tracks
    )
    timeline = TimelineVersion(
        project_id=project.id,
        episode_number=payload.episode_number,
        version_number=version_number,
        code=f"TL-{project.code}-E{payload.episode_number:02d}-V{version_number}",
        status=TIMELINE_DRAFT,
        timebase=payload.timebase,
        duration_ms=payload.duration_ms,
        track_count=len(payload.tracks),
        clip_count=clip_count,
        stale_clips=0,
        tracks=payload.tracks,
        note=payload.note,
        created_by=actor_user_id,
    )
    timeline.checksum = _timeline_checksum(timeline)
    db.add(timeline)
    db.flush()
    audit_service.record(
        db,
        actor_user_id=actor_user_id,
        action="post.timeline.create",
        resource_type="timeline_version",
        resource_id=str(timeline.id),
        details={"code": timeline.code, "episode": timeline.episode_number},
    )
    return timeline


def freeze_timeline(
    db: Session, *, timeline: TimelineVersion, actor_user_id: UUID
) -> TimelineVersion:
    if timeline.status == TIMELINE_FROZEN:
        return timeline
    if timeline.status == TIMELINE_SUPERSEDED:
        raise AppError(
            "Time line version has been superseded",
            code=ErrorCode.TIMELINE_SUPERSEDED,
            status_code=409,
            details={"timeline": timeline.code},
        )
    checksum = _timeline_checksum(timeline)
    if checksum != timeline.checksum:
        raise AppError(
            "Time line content no longer matches its checksum",
            code=ErrorCode.TIMELINE_CHECKSUM_MISMATCH,
            status_code=409,
            details={"timeline": timeline.code},
        )
    timeline.status = TIMELINE_FROZEN
    timeline.frozen_at = utcnow()
    db.flush()
    audit_service.record(
        db,
        actor_user_id=actor_user_id,
        action="post.timeline.freeze",
        resource_type="timeline_version",
        resource_id=str(timeline.id),
        details={"code": timeline.code, "checksum": timeline.checksum},
    )
    return timeline


def _episode_title(db: Session, project_id: UUID, episode_number: int) -> str:
    title = db.scalar(
        select(Episode.title).where(
            Episode.project_id == project_id,
            Episode.episode_number == episode_number,
        )
    )
    return str(title or f"第 {episode_number} 集")


def serialize_output(
    db: Session,
    output: EpisodeOutput,
    *,
    quality_result: str | None = None,
) -> dict:
    timeline = output.timeline
    return {
        "id": f"EO-{output.project.code}-E{output.episode_number:02d}",
        "record_id": str(output.id),
        "project": output.project.code,
        "no": output.episode_number,
        "title": _episode_title(db, output.project_id, output.episode_number),
        "scenes": "",
        "shots": timeline.clip_count if timeline is not None else 0,
        "duration": _duration_label(timeline.duration_ms) if timeline is not None else "",
        "timeline": timeline.code if timeline is not None else "",
        "timelineChecksum": timeline.checksum if timeline is not None else "",
        "qc": quality_result or "待检",
        "status": output.status,
        "checksum": output.checksum,
        "size_bytes": output.size_bytes,
        "at": _stamp(output.created_at),
    }


def create_output(
    db: Session,
    *,
    project: Any,
    episode_number: int,
    timeline: TimelineVersion,
    asset: Any,
    note: str,
    actor_user_id: UUID,
) -> EpisodeOutput:
    _ensure_post_state(project)
    if timeline.project_id != project.id or timeline.episode_number != episode_number:
        raise validation_error("Timeline does not belong to this episode")
    if timeline.status != TIMELINE_FROZEN:
        raise AppError(
            "Time line must be frozen before output",
            code=ErrorCode.TIMELINE_NOT_FROZEN,
            status_code=409,
            details={"timeline": timeline.code, "status": timeline.status},
        )
    if timeline.checksum != _timeline_checksum(timeline):
        raise AppError(
            "Time line content no longer matches its checksum",
            code=ErrorCode.TIMELINE_CHECKSUM_MISMATCH,
            status_code=409,
            details={"timeline": timeline.code},
        )
    if asset.project_id != project.id:
        raise validation_error("Asset does not belong to this project")
    if asset.kind != "video":
        raise validation_error("Episode output must reference a video asset")
    if not storage.exists(asset.storage_key):
        raise AppError(
            "The stored file for this asset is missing",
            code=ErrorCode.ASSET_FILE_MISSING,
            status_code=409,
            details={"asset_id": str(asset.id)},
        )
    if delivery_repo.find_output(db, project.id, episode_number, timeline.id) is not None:
        raise AppError(
            "This episode already has an output for the frozen time line",
            code=ErrorCode.OUTPUT_ALREADY_EXISTS,
            status_code=409,
            details={"episode": episode_number, "timeline": timeline.code},
        )

    output = EpisodeOutput(
        project_id=project.id,
        episode_number=episode_number,
        timeline_version_id=timeline.id,
        asset_id=asset.id,
        status=OUTPUT_STATUS,
        checksum=asset.checksum,
        size_bytes=asset.size_bytes,
        note=note,
        created_by=actor_user_id,
    )
    db.add(output)
    db.flush()
    episodes_done = len({row.episode_number for row in delivery_repo.list_outputs(db, project.id)})
    project.done_episodes = episodes_done
    db.flush()
    audit_service.record(
        db,
        actor_user_id=actor_user_id,
        action="post.episode.output",
        resource_type="episode_output",
        resource_id=str(output.id),
        details={
            "episode": episode_number,
            "timeline": timeline.code,
            "asset": str(asset.id),
            "checksum": output.checksum,
        },
    )
    return output


def serialize_review(db: Session, review: FinalReview) -> dict:
    return {
        "id": f"FR-{review.project.code}-{str(review.id)[:4].upper()}",
        "record_id": str(review.id),
        "project": review.project.code,
        "node": "最终审核",
        "result": FINAL_LABELS.get(review.decision, review.decision),
        "auditor": _actor_name(db, review.actor_user_id),
        "note": review.note,
        "at": _stamp(review.created_at),
    }


def create_final_review(
    db: Session,
    *,
    project: Any,
    payload: FinalReviewRequest,
    permissions: frozenset[str],
    actor_user_id: UUID,
    request_id: str | None = None,
) -> FinalReview:
    if normalize_status(project.status) != "待最终审核":
        raise AppError(
            "Project is not waiting for final review",
            code=ErrorCode.FINAL_REVIEW_PROJECT_NOT_READY,
            status_code=409,
            details={"status": project.status},
        )
    report = delivery_repo.latest_quality_report(db, project.id)
    if report is None or report.result != "PASS":
        raise AppError(
            "Final review requires a passing quality report",
            code=ErrorCode.FINAL_REVIEW_QUALITY_NOT_PASSED,
            status_code=409,
            details={"result": report.result if report is not None else None},
        )

    decision = FINAL_APPROVED if payload.result == "通过" else FINAL_REJECTED
    review = FinalReview(
        project_id=project.id,
        decision=decision,
        note=payload.note,
        quality_report_id=report.id,
        actor_user_id=actor_user_id,
    )
    db.add(review)
    db.flush()

    action = "finalApprove" if decision == FINAL_APPROVED else "finalReject"
    projects_service.transition_project(
        db,
        project,
        action=action,
        reason=payload.note,
        expected_state=None,
        permissions=permissions,
        actor_user_id=actor_user_id,
        request_id=request_id,
    )
    audit_service.record(
        db,
        actor_user_id=actor_user_id,
        action=f"post.final_review.{decision}",
        resource_type="final_review",
        resource_id=str(review.id),
        request_id=request_id,
        details={
            "project": project.code,
            "decision": decision,
            "quality_report": report.code,
        },
    )
    return review


def _latest_outputs(outputs: list[EpisodeOutput]) -> dict[int, EpisodeOutput]:
    latest: dict[int, EpisodeOutput] = {}
    for output in outputs:
        latest.setdefault(output.episode_number, output)
    return latest


def delivery_checklist(db: Session, project: Any) -> list[dict]:
    outputs = delivery_repo.list_outputs(db, project.id)
    latest_outputs = _latest_outputs(outputs)
    expected = int(project.episodes or 1)
    missing = [number for number in range(1, expected + 1) if number not in latest_outputs]
    frozen = bool(latest_outputs) and all(
        output.timeline is not None and output.timeline.status == TIMELINE_FROZEN
        for output in latest_outputs.values()
    )
    files_ready = bool(latest_outputs) and all(
        output.asset is not None and storage.exists(output.asset.storage_key)
        for output in latest_outputs.values()
    )
    checksums = bool(latest_outputs) and all(
        bool(output.checksum) and bool(output.asset and output.asset.checksum == output.checksum)
        for output in latest_outputs.values()
    )
    report = delivery_repo.latest_quality_report(db, project.id)
    quality_ok = report is not None and report.result == "PASS"
    review = delivery_repo.latest_review(db, project.id)
    review_ok = review is not None and review.decision == FINAL_APPROVED
    completed = normalize_status(project.status) == "已完成"

    return [
        {
            "item": "完整短剧成片（整剧打包）",
            "required": True,
            "status": "已就绪" if not missing else f"缺 {len(missing)} 集",
        },
        {
            "item": "分集视频文件",
            "required": True,
            "status": "已就绪" if files_ready and not missing else "待补齐",
        },
        {
            "item": "时间线已冻结",
            "required": True,
            "status": "已就绪" if frozen and not missing else "存在未冻结版本",
        },
        {
            "item": "质检报告 PASS",
            "required": True,
            "status": "已就绪" if quality_ok else "未通过",
        },
        {
            "item": "终审通过",
            "required": True,
            "status": "已就绪" if review_ok and completed else "未通过",
        },
        {
            "item": "校验和留存",
            "required": True,
            "status": "已就绪" if checksums and not missing else "待补齐",
        },
        {
            "item": "字幕与音轨合成",
            "required": False,
            "status": "按时间线口径",
        },
        {
            "item": "封面与宣传素材",
            "required": False,
            "status": "待补充",
        },
        {
            "item": "交付清单与校验摘要",
            "required": False,
            "status": "交付时生成",
        },
    ]


def _write_delivery_archive(
    *,
    project: Any,
    package_code: str,
    outputs: dict[int, EpisodeOutput],
    generated_at: str,
) -> tuple[bytes, dict, int]:
    items: list[dict] = []
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for episode_number in sorted(outputs):
            output = outputs[episode_number]
            asset = output.asset
            timeline = output.timeline
            if asset is None or timeline is None:
                raise AppError(
                    "Episode output is missing its asset or timeline",
                    code=ErrorCode.DELIVERY_CHECKLIST_INCOMPLETE,
                    status_code=409,
                    details={"episode": episode_number},
                )
            source = storage.path_of(asset.storage_key)
            data = source.read_bytes()
            actual = storage.checksum_of(data)
            if actual != output.checksum or actual != asset.checksum:
                raise AppError(
                    "Episode file checksum does not match the frozen output",
                    code=ErrorCode.DELIVERY_CHECKSUM_MISMATCH,
                    status_code=409,
                    details={"episode": episode_number, "expected": output.checksum},
                )
            suffix = Path(asset.storage_key).suffix or ".bin"
            arcname = f"EP{episode_number:02d}{suffix}"
            info = zipfile.ZipInfo(arcname, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
            items.append(
                {
                    "episode": episode_number,
                    "file": arcname,
                    "size_bytes": len(data),
                    "checksum": actual,
                    "timeline": {
                        "code": timeline.code,
                        "version": timeline.version_number,
                        "checksum": timeline.checksum,
                        "frozen_at": _stamp(timeline.frozen_at),
                    },
                    "output_id": str(output.id),
                    "asset_id": str(asset.id),
                }
            )
        manifest = {
            "package": package_code,
            "project": {
                "code": project.code,
                "name": project.title,
                "episodes": int(project.episodes or 1),
            },
            "generated_at": generated_at,
            "items": items,
        }
        manifest_info = zipfile.ZipInfo("manifest.json", date_time=(1980, 1, 1, 0, 0, 0))
        manifest_info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(manifest_info, _canonical(manifest))
    return buffer.getvalue(), manifest, len(items)


def create_delivery(
    db: Session,
    *,
    project: Any,
    payload: DeliveryCreate,
    permissions: frozenset[str],
    actor_user_id: UUID,
    request_id: str | None = None,
) -> DeliveryPackage:
    if delivery_repo.find_package_for_project(db, project.id) is not None:
        raise AppError(
            "A frozen delivery package already exists for this project",
            code=ErrorCode.DELIVERY_ALREADY_FROZEN,
            status_code=409,
            details={"project": project.code},
        )
    if normalize_status(project.status) != "已完成":
        raise AppError(
            "Project must pass final review before delivery",
            code=ErrorCode.DELIVERY_PROJECT_NOT_COMPLETED,
            status_code=409,
            details={"status": project.status},
        )
    checklist = delivery_checklist(db, project)
    missing = [row for row in checklist if row["required"] and row["status"] != "已就绪"]
    if missing:
        raise AppError(
            "Delivery checklist is incomplete",
            code=ErrorCode.DELIVERY_CHECKLIST_INCOMPLETE,
            status_code=409,
            details={"missing": [row["item"] for row in missing]},
        )

    outputs = _latest_outputs(delivery_repo.list_outputs(db, project.id))
    package_code = f"DP-{project.code}-01"
    generated_at = utcnow()
    archive_bytes, manifest, file_count = _write_delivery_archive(
        project=project,
        package_code=package_code,
        outputs=outputs,
        generated_at=generated_at.isoformat(),
    )
    package_checksum = storage.checksum_of(archive_bytes)
    storage_key = f"deliveries/{project.id}/{package_code}.zip"
    storage.write_bytes(storage_key, archive_bytes)

    package = DeliveryPackage(
        project_id=project.id,
        code=package_code,
        version_number=1,
        status=PACKAGE_FROZEN,
        episode_count=len(outputs),
        file_count=file_count,
        size_bytes=len(archive_bytes),
        checksum=package_checksum,
        receiver=payload.receiver,
        manifest=manifest,
        storage_key=storage_key,
        frozen_at=generated_at,
        created_by=actor_user_id,
    )
    db.add(package)
    db.flush()

    projects_service.transition_project(
        db,
        project,
        action="deliver",
        reason=payload.note or f"交付包 {package_code} 已冻结",
        expected_state=None,
        permissions=permissions,
        actor_user_id=actor_user_id,
        request_id=request_id,
    )
    project.delivered_episodes = len(outputs)
    db.flush()
    audit_service.record(
        db,
        actor_user_id=actor_user_id,
        action="post.delivery.freeze",
        resource_type="delivery_package",
        resource_id=str(package.id),
        request_id=request_id,
        details={
            "code": package_code,
            "episodes": package.episode_count,
            "checksum": package_checksum,
            "storage_key": storage_key,
        },
    )
    return package


def serialize_package(db: Session, package: DeliveryPackage) -> dict:
    return {
        "id": package.code,
        "record_id": str(package.id),
        "project": package.project.code,
        "version": f"V{package.version_number}",
        "episodes": package.episode_count,
        "files": package.file_count,
        "size": _size_label(package.size_bytes),
        "size_bytes": package.size_bytes,
        "checksum": package.checksum,
        "reviewer": _actor_name(db, package.created_by),
        "at": _stamp(package.created_at),
        "status": package.status,
        "receiver": package.receiver,
        "frozen": package.frozen_at is not None,
        "manifest": package.manifest,
    }


def verify_package_file(package: DeliveryPackage) -> Path:
    path = storage.path_of(package.storage_key)
    if not path.is_file():
        raise AppError(
            "Delivery package file is missing",
            code=ErrorCode.ASSET_FILE_MISSING,
            status_code=409,
            details={"package": package.code},
        )
    checksum = storage.checksum_of(path.read_bytes())
    if checksum != package.checksum:
        raise AppError(
            "Delivery package checksum no longer matches the frozen manifest",
            code=ErrorCode.DELIVERY_CHECKSUM_MISMATCH,
            status_code=409,
            details={"package": package.code, "expected": package.checksum},
        )
    return path


def require_timeline(db: Session, timeline_id: UUID) -> TimelineVersion:
    timeline = delivery_repo.get_timeline(db, timeline_id)
    if timeline is None:
        raise not_found("Timeline version not found")
    return timeline


def require_output(db: Session, output_id: UUID) -> EpisodeOutput:
    output = delivery_repo.get_output(db, output_id)
    if output is None:
        raise not_found("Episode output not found")
    return output


def require_package(db: Session, package_id: UUID) -> DeliveryPackage:
    package = delivery_repo.get_package(db, package_id)
    if package is None:
        raise not_found("Delivery package not found")
    return package
