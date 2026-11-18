"""Media asset business rules: upload, versioning and export orchestration."""

from pathlib import Path
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domains.assets import repository as assets_repo
from app.domains.assets.constants import DEFAULT_MIME_TYPE, MIME_KIND_MAP, PROBED_KINDS
from app.domains.assets.models import AssetVersion, ExportJob, MediaAsset
from app.infrastructure import media as media_service
from app.infrastructure import storage
from app.public.constants import ErrorCode
from app.public.exceptions import AppError, not_found, permission_denied, validation_error
from app.utils.datetime import utcnow


def kind_for_mime(mime_type: str) -> str:
    lowered = (mime_type or "").lower()
    for prefix, kind in MIME_KIND_MAP:
        if lowered.startswith(prefix):
            return kind
    return "document"


def list_assets(db: Session, project_id: UUID, kind: str | None = None) -> list[MediaAsset]:
    return assets_repo.list_assets(db, project_id, kind=kind)


def get_asset_or_404(db: Session, asset_id: UUID) -> MediaAsset:
    asset = assets_repo.get_asset(db, asset_id)
    if asset is None:
        raise not_found("Media asset not found")
    return asset


def get_versions(db: Session, asset_id: UUID) -> list[AssetVersion]:
    return assets_repo.list_versions(db, asset_id)


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
        raise validation_error("Uploaded file is empty")
    if len(data) > settings.max_upload_size:
        raise AppError(
            "Uploaded file exceeds the configured size limit",
            code=ErrorCode.PAYLOAD_TOO_LARGE,
            status_code=413,
            details={"limit_bytes": settings.max_upload_size},
        )

    checksum = storage.checksum_of(data)
    storage_key = storage.build_key(project_id, filename)
    stored = storage.write_bytes(storage_key, data)

    kind = kind_for_mime(mime_type)
    metadata: dict = {}
    width = height = duration_ms = None
    if kind in PROBED_KINDS:
        metadata = media_service.probe(stored)
        width, height = metadata.get("width"), metadata.get("height")
        duration_ms = metadata.get("duration_ms")

    asset = assets_repo.create_asset_row(
        db,
        project_id=project_id,
        kind=kind,
        title=title or Path(filename).name,
        storage_key=storage_key,
        mime_type=mime_type or DEFAULT_MIME_TYPE,
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
    assets_repo.add_version_row(
        db,
        asset_id=asset.id,
        version_number=1,
        storage_key=storage_key,
        checksum=checksum,
        size_bytes=len(data),
        mime_type=asset.mime_type,
        note="initial upload",
    )
    return asset


def add_version(
    db: Session, asset: MediaAsset, data: bytes, note: str | None = None
) -> AssetVersion:
    if not data:
        raise validation_error("Uploaded file is empty")
    checksum = storage.checksum_of(data)
    storage_key = storage.build_key(asset.project_id, f"{asset.id}-v", prefix="asset-versions")
    storage.write_bytes(storage_key, data)
    return assets_repo.add_version_row(
        db,
        asset_id=asset.id,
        version_number=assets_repo.next_version_number(db, asset.id),
        storage_key=storage_key,
        checksum=checksum,
        size_bytes=len(data),
        mime_type=asset.mime_type,
        note=note,
    )


def _assert_slideshow_sources(
    db: Session, project_id: UUID, asset_ids: list[UUID]
) -> list[MediaAsset]:
    sources = [get_asset_or_404(db, asset_id) for asset_id in asset_ids]
    if any(asset.project_id != project_id for asset in sources):
        raise permission_denied("An export cannot reference assets from another project")
    for asset in sources:
        if asset.kind != "image":
            raise validation_error(
                f"Asset {asset.id} is not an image and cannot be used in a slideshow export"
            )
        if not storage.exists(asset.storage_key):
            raise AppError(
                f"Asset {asset.id} has no stored file",
                code=ErrorCode.ASSET_FILE_MISSING,
                status_code=409,
            )
    return sources


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
        raise validation_error("At least one image asset is required")
    sources = _assert_slideshow_sources(db, project_id, asset_ids)

    job = assets_repo.create_export_job(
        db,
        project_id=project_id,
        spec={
            "asset_ids": [str(asset.id) for asset in sources],
            "width": width,
            "height": height,
            "fps": fps,
            "seconds_per_image": seconds_per_image,
        },
        requested_by=requested_by,
    )

    output_key = storage.build_key(project_id, "export.mp4", prefix="exports")
    output_path = storage.resolve(output_key)
    try:
        metadata = media_service.render_image_sequence(
            [storage.path_of(asset.storage_key) for asset in sources],
            output_path,
            width=width,
            height=height,
            fps=fps,
            seconds_per_image=seconds_per_image,
        )
    except AppError as exc:
        job.status = "failed"
        job.error_code = str(exc.code)
        job.error_message = exc.message
        job.finished_at = utcnow()
        db.flush()
        raise

    size = output_path.stat().st_size
    checksum = storage.checksum_of(output_path.read_bytes())
    asset = assets_repo.create_asset_row(
        db,
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
    assets_repo.add_version_row(
        db,
        asset_id=asset.id,
        version_number=1,
        storage_key=output_key,
        checksum=checksum,
        size_bytes=size,
        mime_type="video/mp4",
        note="ffmpeg slideshow export",
    )
    assets_repo.add_reference_row(
        db, asset_id=asset.id, ref_type="export_job", ref_id=job.id, note="render output"
    )

    job.status = "succeeded"
    job.asset_id = asset.id
    job.output_key = output_key
    job.finished_at = utcnow()
    db.flush()
    return job, asset
