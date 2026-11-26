"""Media asset data access: assets, versions, references and export jobs."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.assets.models import (
    AssetQualityCheck,
    AssetReference,
    AssetUploadSession,
    AssetVersion,
    ExportJob,
    MediaAsset,
)


def get_asset(db: Session, asset_id: UUID) -> MediaAsset | None:
    return db.get(MediaAsset, asset_id)


def list_assets(db: Session, project_id: UUID, kind: str | None = None) -> list[MediaAsset]:
    query = select(MediaAsset).where(MediaAsset.project_id == project_id)
    if kind:
        query = query.where(MediaAsset.kind == kind)
    return list(db.scalars(query.order_by(MediaAsset.created_at.desc())).all())


def list_versions(db: Session, asset_id: UUID) -> list[AssetVersion]:
    return list(
        db.scalars(
            select(AssetVersion)
            .where(AssetVersion.asset_id == asset_id)
            .order_by(AssetVersion.version_number)
        ).all()
    )


def next_version_number(db: Session, asset_id: UUID) -> int:
    latest = db.scalar(
        select(func.max(AssetVersion.version_number)).where(AssetVersion.asset_id == asset_id)
    )
    return int(latest or 0) + 1


def create_asset_row(db: Session, **fields) -> MediaAsset:
    asset = MediaAsset(**fields)
    db.add(asset)
    db.flush()
    return asset


def add_version_row(
    db: Session,
    *,
    asset_id: UUID,
    version_number: int,
    storage_key: str,
    checksum: str,
    size_bytes: int,
    mime_type: str,
    note: str | None,
) -> AssetVersion:
    version = AssetVersion(
        asset_id=asset_id,
        version_number=version_number,
        storage_key=storage_key,
        checksum=checksum,
        size_bytes=size_bytes,
        mime_type=mime_type,
        note=note,
    )
    db.add(version)
    db.flush()
    return version


def add_reference_row(
    db: Session, *, asset_id: UUID, ref_type: str, ref_id: UUID, note: str | None = None
) -> AssetReference:
    reference = AssetReference(asset_id=asset_id, ref_type=ref_type, ref_id=ref_id, note=note)
    db.add(reference)
    db.flush()
    return reference


def create_export_job(
    db: Session, *, project_id: UUID, spec: dict, requested_by: UUID | None
) -> ExportJob:
    job = ExportJob(project_id=project_id, status="running", spec=spec, requested_by=requested_by)
    db.add(job)
    db.flush()
    return job


def latest_version(db: Session, asset_id: UUID) -> AssetVersion | None:
    return db.scalar(
        select(AssetVersion)
        .where(AssetVersion.asset_id == asset_id)
        .order_by(AssetVersion.version_number.desc())
        .limit(1)
    )


def list_references(db: Session, asset_id: UUID) -> list[AssetReference]:
    return list(
        db.scalars(
            select(AssetReference)
            .where(AssetReference.asset_id == asset_id)
            .order_by(AssetReference.created_at)
        ).all()
    )


def find_reference(
    db: Session, *, asset_id: UUID, ref_type: str, ref_id: UUID
) -> AssetReference | None:
    return db.scalar(
        select(AssetReference).where(
            AssetReference.asset_id == asset_id,
            AssetReference.ref_type == ref_type,
            AssetReference.ref_id == ref_id,
        )
    )


def get_reference(db: Session, reference_id: UUID) -> AssetReference | None:
    return db.get(AssetReference, reference_id)


def list_quality_checks(db: Session, asset_id: UUID) -> list[AssetQualityCheck]:
    return list(
        db.scalars(
            select(AssetQualityCheck)
            .where(AssetQualityCheck.asset_id == asset_id)
            .order_by(AssetQualityCheck.created_at.desc())
        ).all()
    )


def get_upload_session(db: Session, upload_id: UUID) -> AssetUploadSession | None:
    return db.get(AssetUploadSession, upload_id)


def find_upload_by_token_hash(db: Session, token_hash: str) -> AssetUploadSession | None:
    return db.scalar(
        select(AssetUploadSession).where(AssetUploadSession.token_hash == token_hash)
    )
