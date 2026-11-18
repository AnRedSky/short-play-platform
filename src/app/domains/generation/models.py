from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db import Base, TimestampMixin, UUIDPrimaryKeyMixin

TASK_STATUSES = (
    "pending",
    "queued",
    "running",
    "retry_wait",
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
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    capability: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    provider_code: Mapped[str] = mapped_column(String(60), nullable=False, default="mock")
    model_code: Mapped[str] = mapped_column(String(80), nullable=False, default="mock-default")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
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
    cancel_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


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

    task_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("generation_tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    provider_code: Mapped[str] = mapped_column(String(60), nullable=False)
    model_code: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    unit: Mapped[str] = mapped_column(String(40), nullable=False, default="call")
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="provider")
