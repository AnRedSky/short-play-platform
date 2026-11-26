"""Request-scoped tenant context shared by services that write audit rows."""

from contextvars import ContextVar
from uuid import UUID

current_organization_id: ContextVar[UUID | None] = ContextVar(
    "audit_current_organization_id", default=None
)
