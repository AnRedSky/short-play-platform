"""Media assets. File bodies live in storage; the database holds metadata only."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db import Base, TimestampMixin, UUIDPrimaryKeyMixin

ASSET_KINDS = ("image", "video", "audio", "subtitle", "document", "archive")


class MediaAsset(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "media_assets"

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    storage_key: Mapped[str] = mapped_column(String(300), nullable=False)
    mime_type: Mapped[str] = mapped_column(
        String(120), nullable=False, default="application/octet-stream"
    )
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="upload")
    qc_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", index=True
    )
    qc_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    qc_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    authorization_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", index=True
    )
    authorization_scope: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    authorization_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    authorized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    authorized_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    formal_version_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("asset_versions.id", ondelete="SET NULL"), nullable=True
    )
    reference_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    generation_task_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("generation_tasks.id", ondelete="SET NULL"), nullable=True
    )
    created_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class AssetVersion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "asset_versions"
    __table_args__ = (
        UniqueConstraint("asset_id", "version_number", name="uq_asset_versions_asset_number"),
    )

    asset_id: Mapped[UUID] = mapped_column(
        ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)
    storage_key: Mapped[str] = mapped_column(String(300), nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class AssetReference(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "asset_references"
    __table_args__ = (
        UniqueConstraint(
            "asset_id", "ref_type", "ref_id", name="uq_asset_references_asset_type_ref"
        ),
    )

    asset_id: Mapped[UUID] = mapped_column(
        ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ref_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    ref_id: Mapped[UUID] = mapped_column(nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class ExportJob(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "export_jobs"
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    spec: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    asset_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    output_key: Mapped[str | None] = mapped_column(String(300), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AssetUploadSession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Signed direct-upload ticket; only the token hash is persisted."""

    __tablename__ = "asset_upload_sessions"

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    storage_key: Mapped[str] = mapped_column(String(300), nullable=False)
    filename: Mapped[str] = mapped_column(String(200), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    max_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    asset_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    created_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class AssetQualityCheck(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "asset_qc_checks"

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_id: Mapped[UUID] = mapped_column(
        ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("asset_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    result: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    checksum: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
