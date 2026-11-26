"""Notification data access: merge target lookup, recipient inbox and read state."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.domains.notifications.models import Notification
from app.domains.projects.models import Project


def find_unread_merge_target(
    db: Session,
    *,
    organization_id: UUID,
    recipient_user_id: UUID,
    notification_type: str,
    object_type: str,
    object_key: str,
) -> Notification | None:
    return db.scalar(
        select(Notification)
        .where(
            Notification.organization_id == organization_id,
            Notification.recipient_user_id == recipient_user_id,
            Notification.type == notification_type,
            Notification.object_type == object_type,
            Notification.object_key == object_key,
            Notification.unread.is_(True),
        )
        .order_by(Notification.last_at.desc())
        .limit(1)
    )


def add_notification(db: Session, notification: Notification) -> Notification:
    db.add(notification)
    db.flush()
    return notification


def get_for_recipient(
    db: Session, *, notification_id: UUID, organization_id: UUID, recipient_user_id: UUID
) -> Notification | None:
    return db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.organization_id == organization_id,
            Notification.recipient_user_id == recipient_user_id,
        )
    )


def _filtered_query(
    *,
    organization_id: UUID,
    recipient_user_id: UUID,
    project: str | None,
    unread: bool | None,
    state: str | None,
    notification_type: str | None,
    query_text: str | None,
):
    statement = select(Notification).where(
        Notification.organization_id == organization_id,
        Notification.recipient_user_id == recipient_user_id,
    )
    count_statement = select(func.count(Notification.id)).where(
        Notification.organization_id == organization_id,
        Notification.recipient_user_id == recipient_user_id,
    )
    if project:
        statement = statement.join(Project, Project.id == Notification.project_id).where(
            or_(Project.code == project, Project.id == _as_uuid(project))
        )
        count_statement = count_statement.join(
            Project, Project.id == Notification.project_id
        ).where(or_(Project.code == project, Project.id == _as_uuid(project)))
    if unread is not None:
        statement = statement.where(Notification.unread.is_(unread))
        count_statement = count_statement.where(Notification.unread.is_(unread))
    if state:
        statement = statement.where(Notification.state == state)
        count_statement = count_statement.where(Notification.state == state)
    if notification_type:
        statement = statement.where(Notification.type == notification_type)
        count_statement = count_statement.where(Notification.type == notification_type)
    if query_text:
        pattern = f"%{query_text.strip()}%"
        statement = statement.where(
            or_(
                Notification.title.ilike(pattern),
                Notification.reason.ilike(pattern),
                Notification.impact.ilike(pattern),
                Notification.type.ilike(pattern),
            )
        )
        count_statement = count_statement.where(
            or_(
                Notification.title.ilike(pattern),
                Notification.reason.ilike(pattern),
                Notification.impact.ilike(pattern),
                Notification.type.ilike(pattern),
            )
        )
    return statement, count_statement


def _as_uuid(value: str):
    try:
        return UUID(value)
    except ValueError:
        return UUID(int=0)


def list_notifications(
    db: Session,
    *,
    organization_id: UUID,
    recipient_user_id: UUID,
    project: str | None,
    unread: bool | None,
    state: str | None,
    notification_type: str | None,
    query_text: str | None,
    offset: int,
    limit: int,
) -> tuple[list[Notification], int]:
    statement, count_statement = _filtered_query(
        organization_id=organization_id,
        recipient_user_id=recipient_user_id,
        project=project,
        unread=unread,
        state=state,
        notification_type=notification_type,
        query_text=query_text,
    )
    rows = db.scalars(
        statement.order_by(Notification.last_at.desc(), Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    total = int(db.scalar(count_statement) or 0)
    return list(rows), total


def mark_all_read(
    db: Session,
    *,
    organization_id: UUID,
    recipient_user_id: UUID,
    actor_user_id: UUID,
    read_at: datetime,
    project: str | None,
    notification_type: str | None,
) -> int:
    statement = (
        update(Notification)
        .where(
            Notification.organization_id == organization_id,
            Notification.recipient_user_id == recipient_user_id,
            Notification.unread.is_(True),
        )
        .values(
            unread=False,
            state="已处理",
            read_at=read_at,
            read_by=actor_user_id,
        )
    )
    if project:
        statement = statement.where(
            Notification.project_id.in_(
                select(Project.id).where(
                    or_(Project.code == project, Project.id == _as_uuid(project))
                )
            )
        )
    if notification_type:
        statement = statement.where(Notification.type == notification_type)
    result = db.execute(statement)
    return int(result.rowcount or 0)
