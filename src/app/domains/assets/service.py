"""Media asset business rules: upload, versioning, QC and formal release."""

import hashlib
import hmac
import secrets
from datetime import timedelta
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domains.assets import repository as assets_repo
from app.domains.assets.constants import (
    ASSET_FORMAL,
    ASSET_QC_PASSED,
    ASSET_REGISTERED,
    ASSET_REJECTED,
    AUTHORIZATION_CLEARED,
    AUTHORIZATION_PENDING,
    AUTHORIZATION_RESTRICTED,
    DEFAULT_MIME_TYPE,
    MIME_KIND_MAP,
    PROBED_KINDS,
    QC_FAILED,
    QC_PASSED,
    QC_PENDING,
    UPLOAD_COMPLETED,
    UPLOAD_PENDING,
    UPLOAD_UPLOADED,
    VERSION_DRAFT,
    VERSION_FORMAL,
    VERSION_SUPERSEDED,
)
from app.domains.assets.models import (
    AssetQualityCheck,
    AssetReference,
    AssetUploadSession,
    AssetVersion,
    ExportJob,
    MediaAsset,
)
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
        status=ASSET_REGISTERED,
        source="upload",
        qc_status=QC_PENDING,
        authorization_status="pending",
        reference_count=0,
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
    version = assets_repo.add_version_row(
        db,
        asset_id=asset.id,
        version_number=assets_repo.next_version_number(db, asset.id),
        storage_key=storage_key,
        checksum=checksum,
        size_bytes=len(data),
        mime_type=asset.mime_type,
        note=note,
    )
    version.status = VERSION_DRAFT
    asset.qc_status = QC_PENDING
    asset.qc_note = "new version uploaded"
    asset.qc_at = None
    asset.authorization_status = AUTHORIZATION_PENDING
    asset.authorization_scope = ""
    asset.authorization_note = "new version requires authorization review"
    asset.authorized_at = None
    asset.authorized_by = None
    asset.status = ASSET_REGISTERED
    db.flush()
    return version


def list_references(db: Session, asset: MediaAsset) -> list[AssetReference]:
    return assets_repo.list_references(db, asset.id)


def list_quality_checks(db: Session, asset: MediaAsset) -> list[AssetQualityCheck]:
    return assets_repo.list_quality_checks(db, asset.id)


def get_upload_session_or_404(db: Session, upload_id: UUID) -> AssetUploadSession:
    session = assets_repo.get_upload_session(db, upload_id)
    if session is None:
        raise not_found("Asset upload session")
    return session


def get_reference_or_404(
    db: Session, *, asset: MediaAsset, reference_id: UUID
) -> AssetReference:
    reference = assets_repo.get_reference(db, reference_id)
    if reference is None or reference.asset_id != asset.id:
        raise not_found("Asset reference")
    return reference


def _sync_reference_count(db: Session, asset: MediaAsset) -> int:
    asset.reference_count = len(assets_repo.list_references(db, asset.id))
    db.flush()
    return asset.reference_count


def add_reference(
    db: Session,
    *,
    asset: MediaAsset,
    ref_type: str,
    ref_id: UUID,
    note: str = "",
) -> AssetReference:
    existing = assets_repo.find_reference(
        db, asset_id=asset.id, ref_type=ref_type, ref_id=ref_id
    )
    if existing is not None:
        if note and not existing.note:
            existing.note = note
            db.flush()
        _sync_reference_count(db, asset)
        return existing
    reference = assets_repo.add_reference_row(
        db, asset_id=asset.id, ref_type=ref_type, ref_id=ref_id, note=note or None
    )
    _sync_reference_count(db, asset)
    return reference


def remove_reference(
    db: Session, *, asset: MediaAsset, reference: AssetReference
) -> None:
    db.delete(reference)
    db.flush()
    _sync_reference_count(db, asset)


def create_direct_upload(
    db: Session,
    *,
    project_id: UUID,
    payload,
    created_by: UUID | None,
    public_base_url: str,
    api_prefix: str,
) -> tuple[AssetUploadSession, str]:
    settings = get_settings()
    max_bytes = payload.max_bytes or settings.max_upload_size
    max_bytes = min(int(max_bytes), settings.max_upload_size)
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    storage_key = storage.build_key(project_id, payload.filename, prefix="asset-uploads")
    session = AssetUploadSession(
        project_id=project_id,
        token_hash=token_hash,
        storage_key=storage_key,
        filename=payload.filename,
        mime_type=payload.mime_type or DEFAULT_MIME_TYPE,
        title=payload.title,
        max_bytes=max_bytes,
        status=UPLOAD_PENDING,
        expires_at=utcnow() + timedelta(minutes=settings.direct_upload_ttl_minutes),
        created_by=created_by,
    )
    db.add(session)
    db.flush()
    upload_url = (
        f"{public_base_url.rstrip('/')}{api_prefix}/asset-uploads/"
        f"{session.id}/content?token={token}"
    )
    return session, upload_url


def upload_direct_content(
    db: Session,
    *,
    upload_id: UUID,
    token: str,
    data: bytes,
    mime_type: str | None = None,
) -> AssetUploadSession:
    session = assets_repo.get_upload_session(db, upload_id)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    if session is None or not hmac.compare_digest(session.token_hash, token_hash):
        raise AppError(
            "Direct upload token is invalid",
            code=ErrorCode.UPLOAD_TOKEN_INVALID,
            status_code=403,
        )
    if session.expires_at <= utcnow():
        raise AppError(
            "Direct upload session has expired",
            code=ErrorCode.UPLOAD_SESSION_EXPIRED,
            status_code=409,
        )
    if session.status == UPLOAD_COMPLETED:
        raise AppError(
            "Direct upload session has already been completed",
            code=ErrorCode.UPLOAD_ALREADY_COMPLETED,
            status_code=409,
        )
    if session.status != UPLOAD_PENDING:
        raise AppError(
            "Direct upload content has already been written",
            code=ErrorCode.CONFLICT,
            status_code=409,
        )
    if not data:
        raise validation_error("Uploaded file is empty")
    if len(data) > session.max_bytes:
        raise AppError(
            "Uploaded file exceeds this session's limit",
            code=ErrorCode.PAYLOAD_TOO_LARGE,
            status_code=413,
            details={"limit_bytes": session.max_bytes},
        )
    storage.write_bytes(session.storage_key, data)
    session.checksum = storage.checksum_of(data)
    session.size_bytes = len(data)
    if mime_type and mime_type != DEFAULT_MIME_TYPE:
        session.mime_type = mime_type
    session.status = UPLOAD_UPLOADED
    db.flush()
    return session


def complete_direct_upload(
    db: Session,
    *,
    project: Any,
    session: AssetUploadSession,
    checksum: str | None,
    title: str | None,
    actor_user_id: UUID,
) -> MediaAsset:
    if session.project_id != project.id:
        raise validation_error("Upload session does not belong to this project")
    if session.expires_at <= utcnow():
        raise AppError(
            "Direct upload session has expired",
            code=ErrorCode.UPLOAD_SESSION_EXPIRED,
            status_code=409,
        )
    if session.status == UPLOAD_COMPLETED:
        raise AppError(
            "Direct upload session has already been completed",
            code=ErrorCode.UPLOAD_ALREADY_COMPLETED,
            status_code=409,
            details={"asset_id": str(session.asset_id) if session.asset_id else None},
        )
    if session.status != UPLOAD_UPLOADED:
        raise AppError(
            "Direct upload content has not been written yet",
            code=ErrorCode.CONFLICT,
            status_code=409,
        )
    if checksum and checksum != session.checksum:
        raise AppError(
            "Uploaded file checksum does not match the advertised checksum",
            code=ErrorCode.UPLOAD_CHECKSUM_MISMATCH,
            status_code=409,
            details={"expected": session.checksum, "received": checksum},
        )

    path = storage.path_of(session.storage_key)
    if not path.is_file():
        raise AppError(
            "The direct-upload file is missing from storage",
            code=ErrorCode.ASSET_FILE_MISSING,
            status_code=409,
        )
    kind = kind_for_mime(session.mime_type)
    metadata: dict = {}
    width = height = duration_ms = None
    if kind in PROBED_KINDS:
        metadata = media_service.probe(path)
        width, height = metadata.get("width"), metadata.get("height")
        duration_ms = metadata.get("duration_ms")
    asset = assets_repo.create_asset_row(
        db,
        project_id=session.project_id,
        kind=kind,
        title=title or session.title or session.filename,
        storage_key=session.storage_key,
        mime_type=session.mime_type,
        size_bytes=session.size_bytes,
        checksum=session.checksum,
        width=width,
        height=height,
        duration_ms=duration_ms,
        status=ASSET_REGISTERED,
        source="direct_upload",
        qc_status=QC_PENDING,
        authorization_status="pending",
        reference_count=0,
        created_by=actor_user_id,
        metadata_json=metadata,
    )
    version = assets_repo.add_version_row(
        db,
        asset_id=asset.id,
        version_number=1,
        storage_key=session.storage_key,
        checksum=session.checksum,
        size_bytes=session.size_bytes,
        mime_type=session.mime_type,
        note="direct upload",
    )
    version.status = VERSION_DRAFT
    session.status = UPLOAD_COMPLETED
    session.asset_id = asset.id
    session.completed_at = utcnow()
    db.flush()
    return asset


def run_asset_qc(
    db: Session,
    *,
    asset: MediaAsset,
    result: str,
    note: str,
    actor_user_id: UUID,
) -> AssetQualityCheck:
    if asset.status == ASSET_FORMAL:
        raise AppError(
            "Formal assets are immutable; upload a new version to re-check",
            code=ErrorCode.ASSET_ALREADY_FORMAL,
            status_code=409,
        )
    version = assets_repo.latest_version(db, asset.id)
    if version is None:
        raise AppError("Asset has no version to check", code=ErrorCode.CONFLICT, status_code=409)
    passed = result == "通过"
    check = AssetQualityCheck(
        project_id=asset.project_id,
        asset_id=asset.id,
        asset_version_id=version.id,
        result=QC_PASSED if passed else QC_FAILED,
        note=note,
        checksum=version.checksum,
        actor_user_id=actor_user_id,
    )
    db.add(check)
    asset.qc_status = QC_PASSED if passed else QC_FAILED
    asset.qc_note = note
    asset.qc_at = utcnow()
    asset.status = ASSET_QC_PASSED if passed else ASSET_REJECTED
    db.flush()
    return check


def update_authorization(
    db: Session,
    *,
    asset: MediaAsset,
    status: str,
    scope: str,
    note: str,
    actor_user_id: UUID,
) -> MediaAsset:
    asset.authorization_status = status
    asset.authorization_scope = scope
    asset.authorization_note = note
    authorized = status in {AUTHORIZATION_CLEARED, AUTHORIZATION_RESTRICTED}
    asset.authorized_at = utcnow() if authorized else None
    asset.authorized_by = actor_user_id if asset.authorized_at is not None else None
    db.flush()
    return asset


def formalize_asset(
    db: Session, *, asset: MediaAsset, actor_user_id: UUID
) -> tuple[MediaAsset, AssetVersion]:
    if asset.formal_version_id is not None and asset.status == ASSET_FORMAL:
        formal = db.get(AssetVersion, asset.formal_version_id)
        if formal is not None:
            return asset, formal
    if asset.qc_status != QC_PASSED:
        raise AppError(
            "Asset must pass QC before it can become formal",
            code=ErrorCode.ASSET_QC_NOT_PASSED,
            status_code=409,
            details={"qc_status": asset.qc_status},
        )
    if asset.authorization_status != AUTHORIZATION_CLEARED:
        raise AppError(
            "Asset authorization must be cleared before it can become formal",
            code=ErrorCode.ASSET_AUTH_NOT_CLEARED,
            status_code=409,
            details={"authorization_status": asset.authorization_status},
        )
    version = assets_repo.latest_version(db, asset.id)
    if version is None:
        raise AppError(
            "Asset has no version to formalize",
            code=ErrorCode.CONFLICT,
            status_code=409,
        )
    if not storage.exists(version.storage_key):
        raise AppError(
            "The stored file for this asset version is missing",
            code=ErrorCode.ASSET_FILE_MISSING,
            status_code=409,
        )
    if storage.checksum_of(storage.path_of(version.storage_key).read_bytes()) != version.checksum:
        raise AppError(
            "Asset version checksum no longer matches the stored file",
            code=ErrorCode.UPLOAD_CHECKSUM_MISMATCH,
            status_code=409,
        )
    if asset.formal_version_id and asset.formal_version_id != version.id:
        previous = db.get(AssetVersion, asset.formal_version_id)
        if previous is not None:
            previous.status = VERSION_SUPERSEDED
    version.status = VERSION_FORMAL
    asset.formal_version_id = version.id
    asset.status = ASSET_FORMAL
    db.flush()
    return asset, version



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
        qc_status=QC_PASSED,
        authorization_status=AUTHORIZATION_CLEARED,
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
    add_reference(
        db, asset=asset, ref_type="export_job", ref_id=job.id, note="render output"
    )

    job.status = "succeeded"
    job.asset_id = asset.id
    job.output_key = output_key
    job.finished_at = utcnow()
    db.flush()
    return job, asset
