import uuid
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.config import get_settings
from apps.api.errors import AppError, not_found
from apps.api.models.assets import AssetReference, AssetVersion, ExportJob, MediaAsset
from apps.api.services import media as media_service
from apps.api.services import storage

MIME_KIND_MAP = (
    ("image/", "image"),
    ("video/", "video"),
    ("audio/", "audio"),
    ("text/vtt", "subtitle"),
    ("application/pdf", "document"),
)


def kind_for_mime(mime_type: str) -> str:
    lowered = (mime_type or "").lower()
    for prefix, kind in MIME_KIND_MAP:
        if lowered.startswith(prefix):
            return kind
    return "document"


def list_assets(db: Session, project_id: UUID, kind: str | None = None) -> list[MediaAsset]:
    query = select(MediaAsset).where(MediaAsset.project_id == project_id)
    if kind:
        query = query.where(MediaAsset.kind == kind)
    return list(db.scalars(query.order_by(MediaAsset.created_at.desc())).all())


def get_asset(db: Session, asset_id: UUID) -> MediaAsset:
    asset = db.get(MediaAsset, asset_id)
    if asset is None:
        raise not_found("Media asset not found")
    return asset


def get_versions(db: Session, asset_id: UUID) -> list[AssetVersion]:
    return list(
        db.scalars(
            select(AssetVersion)
            .where(AssetVersion.asset_id == asset_id)
            .order_by(AssetVersion.version_number)
        ).all()
    )


def _next_version(db: Session, asset_id: UUID) -> int:
    versions = get_versions(db, asset_id)
    return (versions[-1].version_number if versions else 0) + 1


def create_from_upload(
    db: Session,
    *,
    project_id: UUID,
    filename: str,
    data: bytes,
    mime_type: str,
    title: str,
    created_by: UUID | None,
) -> MediaAsset:
    settings = get_settings()
    if not data:
        raise AppError("Uploaded file is empty", code="VALIDATION_ERROR", status_code=422)
    if len(data) > settings.max_upload_size:
        raise AppError(
            "Uploaded file exceeds the configured size limit",
            code="PAYLOAD_TOO_LARGE",
            status_code=413,
            details={"limit_bytes": settings.max_upload_size},
        )

    checksum = storage.checksum_of(data)
    storage_key = storage.build_key(project_id, filename)
    stored = storage.write_bytes(storage_key, data)

    kind = kind_for_mime(mime_type)
    width = height = duration_ms = None
    if kind in ("image", "video"):
        metadata = media_service.probe(stored)
        width, height = metadata.get("width"), metadata.get("height")
        duration_ms = metadata.get("duration_ms")
    else:
        metadata = {}

    asset = MediaAsset(
        project_id=project_id,
        kind=kind,
        title=title or Path(filename).name,
        storage_key=storage_key,
        mime_type=mime_type or "application/octet-stream",
        size_bytes=len(data),
        checksum=checksum,
        width=width,
        height=height,
        duration_ms=duration_ms,
        status="draft",
        source="upload",
        created_by=created_by,
        metadata_json=metadata,
    )
    db.add(asset)
    db.flush()
    db.add(
        AssetVersion(
            asset_id=asset.id,
            version_number=1,
            storage_key=storage_key,
            checksum=checksum,
            size_bytes=len(data),
            mime_type=asset.mime_type,
            note="initial upload",
        )
    )
    db.flush()
    return asset


def add_version(
    db: Session, asset: MediaAsset, data: bytes, note: str | None = None
) -> AssetVersion:
    checksum = storage.checksum_of(data)
    storage_key = storage.build_key(asset.project_id, f"{asset.id}-v", prefix="asset-versions")
    storage.write_bytes(storage_key, data)
    version = AssetVersion(
        asset_id=asset.id,
        version_number=_next_version(db, asset.id),
        storage_key=storage_key,
        checksum=checksum,
        size_bytes=len(data),
        mime_type=asset.mime_type,
        note=note,
    )
    db.add(version)
    db.flush()
    return version


def export_slideshow(
    db: Session,
    *,
    project_id: UUID,
    asset_ids: list[UUID],
    width: int,
    height: int,
    fps: int,
    seconds_per_image: float,
    requested_by: UUID | None,
    title: str = "Episode export",
) -> tuple[ExportJob, MediaAsset]:
    if not asset_ids:
        raise AppError(
            "At least one image asset is required", code="VALIDATION_ERROR", status_code=422
        )

    assets = [get_asset(db, asset_id) for asset_id in asset_ids]
    if any(asset.project_id != project_id for asset in assets):
        raise AppError(
            "All assets must belong to this project", code="VALIDATION_ERROR", status_code=422
        )
    for asset in assets:
        if asset.kind != "image":
            raise AppError(
                f"Asset {asset.id} is not an image and cannot be used in a slideshow export",
                code="VALIDATION_ERROR",
                status_code=422,
            )
        if not storage.exists(asset.storage_key):
            raise AppError(
                f"Asset {asset.id} has no stored file",
                code="ASSET_FILE_MISSING",
                status_code=409,
            )

    job = ExportJob(
        project_id=project_id,
        status="running",
        spec={
            "asset_ids": [str(asset.id) for asset in assets],
            "width": width,
            "height": height,
            "fps": fps,
            "seconds_per_image": seconds_per_image,
        },
        requested_by=requested_by,
    )
    db.add(job)
    db.flush()

    output_key = storage.build_key(project_id, "export.mp4", prefix="exports")
    output_path = storage.resolve(output_key)
    try:
        metadata = media_service.render_image_sequence(
            [storage.path_of(asset.storage_key) for asset in assets],
            output_path,
            width=width,
            height=height,
            fps=fps,
            seconds_per_image=seconds_per_image,
        )
    except AppError as exc:
        job.status = "failed"
        job.error_code = exc.code
        job.error_message = exc.message
        job.finished_at = datetime.now(UTC)
        db.flush()
        raise

    size = output_path.stat().st_size
    checksum = storage.checksum_of(output_path.read_bytes())
    asset = MediaAsset(
        project_id=project_id,
        kind="video",
        title=title,
        storage_key=output_key,
        mime_type="video/mp4",
        size_bytes=size,
        checksum=checksum,
        width=metadata.get("width"),
        height=metadata.get("height"),
        duration_ms=metadata.get("duration_ms"),
        status="approved",
        source="render",
        created_by=requested_by,
        metadata_json=metadata,
    )
    db.add(asset)
    db.flush()
    db.add(
        AssetVersion(
            asset_id=asset.id,
            version_number=1,
            storage_key=output_key,
            checksum=checksum,
            size_bytes=size,
            mime_type="video/mp4",
            note="ffmpeg slideshow export",
        )
    )
    db.add(
        AssetReference(
            asset_id=asset.id, ref_type="export_job", ref_id=job.id, note="render output"
        )
    )

    job.status = "succeeded"
    job.asset_id = asset.id
    job.output_key = output_key
    job.finished_at = datetime.now(UTC)
    db.flush()
    return job, asset


def new_idempotency_key() -> str:
    return uuid.uuid4().hex
