from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, event, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db import Base, UUIDPrimaryKeyMixin


class AuditLogImmutableError(RuntimeError):
    """Raised when application code tries to update or delete an audit row."""


class AuditLog(Base, UUIDPrimaryKeyMixin):
    """Append-only record of privileged actions."""

    __tablename__ = "audit_logs"

    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(60), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    result: Mapped[str] = mapped_column(String(20), nullable=False, default="success")
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    actor = relationship("User", lazy="joined", foreign_keys=[actor_user_id])


@event.listens_for(AuditLog, "before_update")
def _reject_audit_update(mapper, connection, target: AuditLog) -> None:
    raise AuditLogImmutableError("Audit records are append-only and cannot be updated")


@event.listens_for(AuditLog, "before_delete")
def _reject_audit_delete(mapper, connection, target: AuditLog) -> None:
    raise AuditLogImmutableError("Audit records are append-only and cannot be deleted")
