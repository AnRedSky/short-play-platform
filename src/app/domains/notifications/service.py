"""Notification business rules: merge same object, mark read, project event fan-out."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.domains.notifications import repository as notifications_repo
from app.domains.notifications.models import Notification
from app.domains.projects.models import Project
from app.utils.datetime import utcnow

PENDING_STATE = "待处理"


def merge_notification(
    db: Session,
    *,
    organization_id: UUID,
    recipient_user_id: UUID,
    notification_type: str,
    title: str,
    link: str,
    object_type: str,
    object_key: str,
    project_id: UUID | None = None,
    reason: str = "",
    impact: str = "",
    action_hint: str = "",
    created_by: UUID | None = None,
    metadata: dict[str, Any] | None = None,
    at: datetime | None = None,
) -> Notification:
    """Refresh the unread notification for this object, or append a new one.

    Once a notification has been read, a later event starts a fresh row so the
    recipient sees the new occurrence again. That keeps deduplication limited to
    the window where the item is still actionable.
    """
    now = at or utcnow()
    existing = notifications_repo.find_unread_merge_target(
        db,
        organization_id=organization_id,
        recipient_user_id=recipient_user_id,
        notification_type=notification_type,
        object_type=object_type,
        object_key=object_key,
    )
    if existing is not None:
        existing.title = title
        existing.link = link
        existing.project_id = project_id
        existing.reason = reason
        existing.impact = impact
        existing.action_hint = action_hint
        existing.merge_count += 1
        existing.last_at = now
        if metadata:
            existing.metadata_json = {**existing.metadata_json, **metadata}
        db.flush()
        return existing

    notification = Notification(
        organization_id=organization_id,
        recipient_user_id=recipient_user_id,
        project_id=project_id,
        type=notification_type,
        title=title,
        reason=reason,
        impact=impact,
        action_hint=action_hint,
        link=link,
        object_type=object_type,
        object_key=object_key,
        state=PENDING_STATE,
        unread=True,
        merge_count=1,
        last_at=now,
        created_by=created_by,
        metadata_json=metadata or {},
    )
    return notifications_repo.add_notification(db, notification)


def serialize(notification: Notification) -> dict[str, Any]:
    project = notification.project
    return {
        "id": str(notification.id),
        "type": notification.type,
        "project": project.code if project is not None else None,
        "project_name": project.title if project is not None else None,
        "title": notification.title,
        "reason": notification.reason,
        "impact": notification.impact,
        "action": notification.action_hint,
        "link": notification.link,
        "state": notification.state,
        "unread": notification.unread,
        "read_at": notification.read_at.isoformat() if notification.read_at else None,
        "at": notification.last_at.isoformat(),
        "merge_count": notification.merge_count,
        "object_type": notification.object_type,
        "object_key": notification.object_key,
    }


def list_for_user(
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
    return notifications_repo.list_notifications(
        db,
        organization_id=organization_id,
        recipient_user_id=recipient_user_id,
        project=project,
        unread=unread,
        state=state,
        notification_type=notification_type,
        query_text=query_text,
        offset=offset,
        limit=limit,
    )


def mark_read(
    db: Session,
    *,
    notification_id: UUID,
    organization_id: UUID,
    recipient_user_id: UUID,
    actor_user_id: UUID,
) -> Notification:
    notification = notifications_repo.get_for_recipient(
        db,
        notification_id=notification_id,
        organization_id=organization_id,
        recipient_user_id=recipient_user_id,
    )
    if notification is None:
        from app.public.exceptions import not_found

        raise not_found("Notification not found")
    if notification.unread:
        notification.unread = False
        notification.state = "已处理"
        notification.read_at = utcnow()
        notification.read_by = actor_user_id
        db.flush()
    return notification


def mark_all_read(
    db: Session,
    *,
    organization_id: UUID,
    recipient_user_id: UUID,
    actor_user_id: UUID,
    project: str | None,
    notification_type: str | None,
) -> int:
    return notifications_repo.mark_all_read(
        db,
        organization_id=organization_id,
        recipient_user_id=recipient_user_id,
        actor_user_id=actor_user_id,
        read_at=utcnow(),
        project=project,
        notification_type=notification_type,
    )


_PROJECT_EVENT_NOTIFICATIONS: dict[str, dict[str, str]] = {
    "submitScript": {
        "type": "待剧本审核",
        "link": "creation/review?project={code}",
        "object_type": "script_review",
        "reason": "剧本已提交审核，等待负责人逐集确认",
        "impact": "剧本审核通过前，后续生产环节全部阻塞",
        "action": "逐集预览后通过或退回",
    },
    "failQc": {
        "type": "质量不通过",
        "link": "quality/reports?project={code}",
        "object_type": "quality_report",
        "reason": "质检存在阻断项，需要人工判断处理",
        "impact": "阻断项关闭前，项目无法进入最终审核",
        "action": "查看质检报告并局部返工或记录接受理由",
    },
    "finalReject": {
        "type": "终审退回",
        "link": "post/review?project={code}",
        "object_type": "final_review",
        "reason": "终审未通过，项目退回后期处理",
        "impact": "项目退回后期，交付暂停",
        "action": "查看退回原因并安排返工",
    },
}


def notify_project_transition(
    db: Session,
    *,
    project: Project,
    action: str,
    actor_user_id: UUID | None,
    reason: str | None = None,
) -> Notification | None:
    """Create one actionable notification for the project owner on gate events."""
    spec = _PROJECT_EVENT_NOTIFICATIONS.get(action)
    if spec is None or project.owner_user_id is None:
        return None
    link = spec["link"].format(code=project.code)
    title = _project_event_title(action, project.title)
    return merge_notification(
        db,
        organization_id=project.organization_id,
        recipient_user_id=project.owner_user_id,
        notification_type=spec["type"],
        title=title,
        link=link,
        object_type=spec["object_type"],
        object_key=f"project:{project.id}:{spec['object_type']}",
        project_id=project.id,
        reason=(reason or "").strip() or spec["reason"],
        impact=spec["impact"],
        action_hint=spec["action"],
        created_by=actor_user_id,
        metadata={"action": action, "project_code": project.code},
    )


def notify_generation_failure(
    db: Session,
    *,
    project: Project,
    task_id: UUID,
    capability: str,
    error_code: str | None,
    error_message: str | None,
    actor_user_id: UUID | None = None,
) -> Notification | None:
    """Tell the project owner when a generation task reaches terminal failure."""
    if project.owner_user_id is None:
        return None
    return merge_notification(
        db,
        organization_id=project.organization_id,
        recipient_user_id=project.owner_user_id,
        notification_type="任务失败",
        title=f"《{project.title}》{capability} 任务失败",
        link=f"tasks/list?project={project.code}&task={task_id}",
        object_type="generation_task",
        object_key=f"task:{task_id}",
        project_id=project.id,
        reason=(error_message or "").strip(),
        impact="该任务无法产出可用结果，依赖它的镜头与交付仍被阻塞",
        action_hint="查看任务详情并重试，或调整参数后重新提交",
        created_by=actor_user_id,
        metadata={
            "capability": capability,
            "error_code": error_code,
            "project_code": project.code,
        },
    )


def _project_event_title(action: str, project_title: str) -> str:
    label = {
        "submitScript": "剧本待审核",
        "failQc": "质检存在阻断项",
        "finalReject": "终审被退回",
    }[action]
    return f"《{project_title}》{label}"
