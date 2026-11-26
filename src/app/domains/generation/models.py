from datetime import datetime
from decimal import Decimal
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
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db import Base, TimestampMixin, UUIDPrimaryKeyMixin

TASK_STATUSES = (
    "pending",
    "queued",
    "running",
    "retry_wait",
    "paused",
    "succeeded",
    "failed",
    "cancel_requested",
    "cancelled",
)
TERMINAL_TASK_STATUSES = ("succeeded", "failed", "cancelled")


class GenerationTask(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "generation_tasks"
    __table_args__ = (
        UniqueConstraint(
            "project_id", "idempotency_key", name="uq_generation_tasks_project_idempotency"
        ),
        Index("ix_generation_tasks_status_next_run", "status", "next_run_at"),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    capability: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    provider_code: Mapped[str] = mapped_column(String(60), nullable=False, default="mock")
    model_code: Mapped[str] = mapped_column(String(80), nullable=False, default="mock-default")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued", index=True)
    idempotency_key: Mapped[str] = mapped_column(String(120), nullable=False)
    request_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    result_payload: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    error_code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_provider_task_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    last_callback_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ProviderCallbackEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Every provider callback is appended once per ``(task, callback_id)``.

    ``outcome`` keeps the first response so a repeated callback returns the same
    body instead of re-applying a terminal transition.
    """

    __tablename__ = "provider_callback_events"
    __table_args__ = (
        UniqueConstraint(
            "task_id", "callback_id", name="uq_provider_callback_task_callback"
        ),
    )

    task_id: Mapped[UUID] = mapped_column(
        ForeignKey("generation_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider_code: Mapped[str] = mapped_column(String(60), nullable=False)
    callback_id: Mapped[str] = mapped_column(String(120), nullable=False)
    event_type: Mapped[str] = mapped_column(String(20), nullable=False, default="completed")
    provider_task_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    attempt_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    applied: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    outcome: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class TaskAttempt(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "task_attempts"
    __table_args__ = (
        UniqueConstraint("task_id", "attempt_number", name="uq_task_attempts_task_number"),
    )

    task_id: Mapped[UUID] = mapped_column(
        ForeignKey("generation_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")
    provider_task_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    request_digest: Mapped[str | None] = mapped_column(String(64), nullable=True)
    response_digest: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)


class UsageRecord(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "usage_records"
    __table_args__ = (
        UniqueConstraint("attempt_id", name="uq_usage_records_attempt"),
        UniqueConstraint("code", name="uq_usage_records_code"),
    )

    task_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("generation_tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    attempt_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("task_attempts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    project_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    cost_rate_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("cost_rates.id", ondelete="SET NULL"), nullable=True
    )
    code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    provider_code: Mapped[str] = mapped_column(String(60), nullable=False)
    model_code: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    capability: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    unit: Mapped[str] = mapped_column(String(40), nullable=False, default="call")
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), nullable=False, default=Decimal("0")
    )
    estimated_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 4), nullable=False, default=Decimal("0")
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 4), nullable=False, default=Decimal("0")
    )
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="CNY")
    failure: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    billing_status: Mapped[str] = mapped_column(String(20), nullable=False, default="待对账")
    billing_basis: Mapped[str] = mapped_column(String(30), nullable=False, default="provider")
    episode_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    shot_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("shots.id", ondelete="SET NULL"), nullable=True
    )
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="provider")

    project = relationship("Project", lazy="joined", foreign_keys=[project_id])
    task = relationship("GenerationTask", lazy="joined", foreign_keys=[task_id])
    attempt = relationship("TaskAttempt", lazy="joined", foreign_keys=[attempt_id])
