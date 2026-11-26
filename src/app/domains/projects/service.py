"""Project business rules: access control, creation, membership and transitions."""

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.audit import service as audit_service
from app.domains.notifications import service as notifications_service
from app.domains.organizations import repository as organizations_repo
from app.domains.projects import repository as projects_repo
from app.domains.projects.constants import PROJECT_WRITE_ROLES
from app.domains.projects.models import Project, ProjectMember, ProjectTransition
from app.domains.projects.schemas import ProjectRead
from app.domains.projects.state_machine import (
    STATUS_PHASE,
    allowed_actions,
    find_action,
    normalize_status,
    resolve_target,
)
from app.public.constants import ErrorCode
from app.public.exceptions import AppError, conflict, not_found, permission_denied
from app.utils.datetime import utcnow


def _budget_state(project: Project) -> str:
    budget = float(project.budget or 0)
    actual = float(project.actual or 0)
    if budget <= 0:
        return "正常"
    ratio = actual / budget
    if ratio > 1:
        return "超限"
    if ratio >= 0.85:
        return "预警"
    return "正常"


def serialize_project(project: Project) -> dict[str, Any]:
    """The single Project -> page DTO boundary used by every project endpoint."""
    status = normalize_status(project.status)
    owner = project.owner
    return ProjectRead(
        record_id=project.id,
        id=project.code,
        name=project.title,
        summary=project.summary,
        genre=project.genre or "",
        audience=project.audience or "",
        episodes=int(project.episodes or 1),
        duration=project.duration or "",
        ratio=project.ratio or "",
        language=project.language or "",
        style=project.style or "",
        constraints=project.constraints or "",
        budget=float(project.budget or 0),
        actual=float(project.actual or 0),
        estimated=float(project.estimated or 0),
        status=status,
        phase=STATUS_PHASE.get(status, status),
        done=int(project.done_episodes or 0),
        delivered=int(project.delivered_episodes or 0),
        quality=project.quality or "",
        ownerId=str(project.owner_user_id) if project.owner_user_id else "",
        owner=owner.full_name if owner is not None else "",
        budgetState=_budget_state(project),
        created=project.created_at.strftime("%Y-%m-%d"),
        updated=project.updated_at.strftime("%Y-%m-%d %H:%M"),
        scriptVersion=project.script_version or "",
        timelineVersion=project.timeline_version or "",
    ).model_dump(mode="json")


def get_project_or_404(db: Session, project_id: UUID) -> Project:
    project = projects_repo.get_project(db, project_id)
    if project is None:
        raise not_found("Project not found")
    return project


def is_project_member(db: Session, project_id: UUID, user_id: UUID) -> bool:
    return projects_repo.member_role(db, project_id, user_id) is not None


def project_role(db: Session, project_id: UUID, user_id: UUID) -> str | None:
    return projects_repo.member_role(db, project_id, user_id)


def assert_project_access(
    db: Session,
    project: Project,
    *,
    user_id: UUID,
    permissions: frozenset[str],
    permission_needed: str = "project.read",
) -> None:
    """Server-side project authorization: permission code plus membership.

    The URL's project id is never the authorization basis: the caller must hold
    the endpoint permission *and* be an active member, unless they hold the
    project-manage permission.
    """
    if permission_needed not in permissions:
        raise permission_denied(f"Permission '{permission_needed}' is required")
    if "project.manage" in permissions:
        return
    role = project_role(db, project.id, user_id)
    if role is None:
        # Missing membership is reported as 403 so project existence does not leak.
        raise permission_denied("You are not a member of this project")
    if permission_needed == "creation.write" and role not in PROJECT_WRITE_ROLES:
        raise permission_denied(f"Project role '{role}' cannot modify this project")


def get_accessible_project(
    db: Session,
    project_id: UUID,
    *,
    user_id: UUID,
    permissions: frozenset[str],
    permission_needed: str = "project.read",
    for_update: bool = False,
) -> Project:
    """Resolve a project and enforce access in one step for every entry point."""
    project = (
        projects_repo.get_project_for_update(db, project_id)
        if for_update
        else get_project_or_404(db, project_id)
    )
    if project is None:
        raise not_found("Project not found")
    assert_project_access(
        db,
        project,
        user_id=user_id,
        permissions=permissions,
        permission_needed=permission_needed,
    )
    return project


def create_project(
    db: Session,
    *,
    organization_id: UUID,
    code: str,
    title: str,
    summary: str,
    owner_user_id: UUID | None,
    brief: dict[str, Any] | None = None,
) -> Project:
    if projects_repo.get_project_by_code(db, organization_id, code) is not None:
        raise conflict("Project code already exists", {"code": code})
    project = projects_repo.create_project_row(
        db,
        organization_id=organization_id,
        code=code,
        title=title,
        summary=summary,
        owner_user_id=owner_user_id,
        brief=brief,
    )
    if owner_user_id is not None:
        # The creator is always an owner so the project is reachable without a second write.
        add_member(
            db,
            project_id=project.id,
            organization_id=organization_id,
            user_id=owner_user_id,
            project_role="owner",
            actor_user_id=owner_user_id,
        )
    return project


def update_project(db: Session, project: Project, changes: dict) -> Project:
    for field, value in changes.items():
        setattr(project, field, value)
    db.flush()
    return project


def list_projects(
    db: Session,
    *,
    organization_id: UUID,
    user_id: UUID,
    permissions: frozenset[str],
    pagination: PaginationParams,
) -> tuple[list[Project], int]:
    manage = "project.manage" in permissions
    return projects_repo.list_projects(
        db, organization_id, user_id=user_id, manage=manage, pagination=pagination
    )


def list_members(db: Session, project_id: UUID) -> list[ProjectMember]:
    return projects_repo.list_members(db, project_id)


def add_member(
    db: Session,
    *,
    project_id: UUID,
    organization_id: UUID,
    user_id: UUID,
    project_role: str,
    actor_user_id: UUID | None = None,
) -> ProjectMember:
    if not organizations_repo.is_active_member(db, organization_id, user_id):
        raise not_found("User not found in this organization")
    project = projects_repo.get_project(db, project_id)
    if project is None:
        raise not_found("Project not found")
    if project_role == "owner" and project.owner_user_id != user_id:
        raise AppError(
            "Only the project owner can hold the owner role",
            code=ErrorCode.PROJECT_OWNER_IMMUTABLE,
            status_code=409,
        )
    existing = projects_repo.find_member(db, project_id, user_id)
    now = utcnow()
    if existing is not None:
        existing.project_role = project_role
        existing.is_active = True
        existing.granted_by = actor_user_id
        existing.granted_at = now
        existing.revoked_by = None
        existing.revoked_at = None
        db.flush()
        return existing
    return projects_repo.add_member_row(
        db,
        project_id=project_id,
        user_id=user_id,
        project_role=project_role,
        granted_by=actor_user_id,
        granted_at=now,
    )


def update_member_role(
    db: Session,
    *,
    project: Project,
    user_id: UUID,
    project_role: str,
    actor_user_id: UUID,
) -> ProjectMember:
    member = projects_repo.find_member(db, project.id, user_id)
    if member is None or not member.is_active:
        raise not_found("Project member not found")
    if member.project_role == "owner" and project_role != "owner":
        raise AppError(
            "Project owner role cannot be demoted; transfer ownership instead",
            code=ErrorCode.PROJECT_OWNER_IMMUTABLE,
            status_code=409,
        )
    if project_role == "owner" and project.owner_user_id != user_id:
        raise AppError(
            "Only the project owner can hold the owner role",
            code=ErrorCode.PROJECT_OWNER_IMMUTABLE,
            status_code=409,
        )
    member.project_role = project_role
    member.granted_by = actor_user_id
    member.granted_at = utcnow()
    db.flush()
    return member


def remove_member(
    db: Session, *, project_id: UUID, user_id: UUID, actor_user_id: UUID
) -> ProjectMember:
    member = projects_repo.find_member(db, project_id, user_id)
    if member is None or not member.is_active:
        raise not_found("Project member not found")
    if member.project_role == "owner":
        raise AppError(
            "Project owner cannot be removed; transfer ownership instead",
            code=ErrorCode.PROJECT_OWNER_IMMUTABLE,
            status_code=409,
        )
    member.is_active = False
    member.revoked_by = actor_user_id
    member.revoked_at = utcnow()
    db.flush()
    return member


def transition_project(
    db: Session,
    project: Project,
    *,
    action: str,
    reason: str,
    expected_state: str | None,
    permissions: frozenset[str],
    actor_user_id: UUID,
    request_id: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """Validate and apply one transition in the caller's transaction.

    The caller owns the commit so a composed flow (B-04 script review) can write
    the review record, the status update and the audit entry atomically.
    """
    current = normalize_status(project.status)
    target_action = find_action(current, action)
    if target_action is None:
        raise AppError(
            f"状态「{current}」不允许动作 {action}",
            code=ErrorCode.ILLEGAL_TRANSITION,
            status_code=409,
            details={"status": current, "action": action},
        )

    assert_project_access(
        db,
        project,
        user_id=actor_user_id,
        permissions=permissions,
        permission_needed=target_action.permission,
    )

    if expected_state is not None and normalize_status(expected_state) != current:
        raise AppError(
            "项目状态已被其他操作更新，请刷新后重试",
            code=ErrorCode.STATE_CONFLICT,
            status_code=409,
            details={
                "expected_state": normalize_status(expected_state),
                "actual_state": current,
            },
        )

    reason_text = (reason or "").strip()
    if target_action.need_reason and not reason_text:
        raise AppError(
            "该动作必须填写原因",
            code=ErrorCode.REASON_REQUIRED,
            status_code=422,
            details={"action": action},
        )

    target_status = resolve_target(current, target_action, project.previous_status)
    project.status = target_status
    project.previous_status = current if target_status == "已暂停" else None
    db.flush()
    db.refresh(project)

    allowed = allowed_actions(target_status, permissions)
    payload: dict[str, Any] = {
        "project": serialize_project(project),
        "allowed_actions": allowed,
        "message": f"{current} → {target_status}",
    }

    db.add(
        ProjectTransition(
            project_id=project.id,
            actor_user_id=actor_user_id,
            action=action,
            from_status=current,
            to_status=target_status,
            reason=reason_text,
            idempotency_key=idempotency_key,
            result_payload=payload,
        )
    )
    audit_service.record(
        db,
        actor_user_id=actor_user_id,
        action=f"project.transition.{action}",
        resource_type="project",
        resource_id=str(project.id),
        request_id=request_id,
        details={
            "action": action,
            "from": current,
            "to": target_status,
            "reason": reason_text,
            "expected_state": expected_state,
        },
    )
    notifications_service.notify_project_transition(
        db,
        project=project,
        action=action,
        actor_user_id=actor_user_id,
        reason=reason_text,
    )
    db.flush()
    return payload


def replay_transition(
    db: Session, *, project_id: UUID, idempotency_key: str
) -> ProjectTransition | None:
    return projects_repo.find_transition(db, project_id, idempotency_key)
