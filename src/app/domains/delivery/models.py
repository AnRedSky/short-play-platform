"""B-08 post-production models: timelines, episode outputs, reviews and packages."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db import Base, TimestampMixin, UUIDPrimaryKeyMixin


class TimelineVersion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "timeline_versions"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "episode_number",
            "version_number",
            name="uq_timeline_versions_project_ep_version",
        ),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    episode_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    code: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)
    timebase: Mapped[int] = mapped_column(Integer, nullable=False, default=25)
    duration_ms: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    track_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clip_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stale_clips: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tracks: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False, default="", index=True)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    frozen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    project = relationship("Project", lazy="joined")


class EpisodeOutput(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "episode_outputs"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "episode_number",
            "timeline_version_id",
            name="uq_episode_outputs_project_ep_timeline",
        ),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    episode_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    timeline_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("timeline_versions.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    asset_id: Mapped[UUID] = mapped_column(
        ForeignKey("media_assets.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="已输出", index=True)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    project = relationship("Project", lazy="joined")
    timeline = relationship("TimelineVersion", lazy="joined")
    asset = relationship("MediaAsset", lazy="joined")


class FinalReview(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "final_reviews"

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    decision: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    quality_report_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("quality_reports.id", ondelete="SET NULL"), nullable=True
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    project = relationship("Project", lazy="joined")


class DeliveryPackage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "delivery_packages"
    __table_args__ = (UniqueConstraint("project_id", name="uq_delivery_packages_project"),)

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="已冻结", index=True)
    episode_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    file_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    receiver: Mapped[str] = mapped_column(String(120), nullable=False, default="企业内容库")
    manifest: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    storage_key: Mapped[str] = mapped_column(String(300), nullable=False)
    frozen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    project = relationship("Project", lazy="joined")
