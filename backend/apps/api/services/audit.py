from uuid import UUID

from sqlalchemy.orm import Session

CHUNK_LIMIT = 4000


def record(
    db: Session,
    *,
    actor_user_id: UUID | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    result: str = "success",
    request_id: str | None = None,
    details: dict | None = None,
) -> None:
    from apps.api.models.audit import AuditLog

    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            result=result,
            request_id=request_id,
            details=details or {},
        )
    )
