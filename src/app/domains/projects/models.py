"""Project and project membership tables."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Project(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_projects_org_code"),)

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(60), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="草稿")
    # Set when a project is paused so ``resume`` can return to the exact state.
    previous_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Brief fields persisted from the creation page. They are plain columns so
    # PATCH can store them without a second metadata table.
    owner_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    genre: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    audience: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    episodes: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    duration: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    ratio: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    language: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    style: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    constraints: Mapped[str] = mapped_column(Text, nullable=False, default="")
    budget: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    actual: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    estimated: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    done_episodes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    delivered_episodes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quality: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    script_version: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    timeline_version: Mapped[str] = mapped_column(String(120), nullable=False, default="")

    owner = relationship("User", lazy="joined", foreign_keys=[owner_user_id])


class ProjectMember(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_role: Mapped[str] = mapped_column(String(20), nullable=False, default="writer")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    granted_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    granted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ProjectTransition(Base, UUIDPrimaryKeyMixin):
    """Append-only transition ledger, also the idempotency store.

    A transition and its audit record are written in the same transaction as the
    status update. ``result_payload`` keeps the first response so a retry with
    the same ``Idempotency-Key`` can return it without double-writing.
    """

    __tablename__ = "project_transitions"
    __table_args__ = (
        UniqueConstraint(
            "project_id", "idempotency_key", name="uq_project_transitions_project_key"
        ),
        Index("ix_project_transitions_project_created", "project_id", "created_at"),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    from_status: Mapped[str] = mapped_column(String(20), nullable=False)
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    result_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
