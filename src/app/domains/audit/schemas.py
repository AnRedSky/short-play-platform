"""Audit log response contract.

The original technical fields stay available for integrations; the page-aligned
aliases (``time``, ``actor``, ``object``, ``src``) let the audit table render
without client-side joins.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_user_id: UUID | None
    action: str
    resource_type: str
    resource_id: str | None
    result: str
    result_code: str | None = None
    request_id: str | None
    details: dict[str, Any]
    created_at: datetime

    # Page-aligned aliases.
    time: datetime
    actor: str | None = None
    object: str
    src: str | None = None
    link: str | None = None
