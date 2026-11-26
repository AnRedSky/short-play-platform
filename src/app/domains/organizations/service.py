"""Organization business rules: departments, members, authorization and offboarding."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.auth import repository as auth_repo
from app.domains.organizations import repository as organizations_repo
from app.domains.organizations.models import (
    Department,
    OffboardingRecord,
    Organization,
    OrganizationMember,
)
from app.domains.projects import repository as projects_repo
from app.domains.roles import repository as roles_repo
from app.domains.roles import service as roles_service
from app.domains.users import repository as users_repo
from app.public.constants import ErrorCode
from app.public.exceptions import AppError, conflict, not_found
from app.utils.datetime import utcnow
from app.utils.string import slugify


def get_organization_or_404(db: Session, organization_id: UUID) -> Organization:
    organization = organizations_repo.get_organization(db, organization_id)
    if organization is None:
        raise not_found("Organization not found")
    return organization


def get_organization_for_member_or_404(
    db: Session, organization_id: UUID, user_id: UUID
) -> Organization:
    organization = get_organization_or_404(db, organization_id)
    if not organizations_repo.is_active_member(db, organization_id, user_id):
        raise not_found("Organization not found")
    return organization


def create_organization(db: Session, *, name: str) -> Organization:
    return organizations_repo.create_organization(db, name=name, slug=slugify(name))


def list_user_organizations(db: Session, user_id: UUID) -> list[Organization]:
    return organizations_repo.list_organizations_for_user(db, user_id)


def get_department_or_404(db: Session, *, organization_id: UUID, department_id: UUID) -> Department:
    department = organizations_repo.get_department(db, department_id)
    if department is None or department.organization_id != organization_id:
        raise not_found("Department not found")
    return department


def list_departments(
    db: Session,
    organization_id: UUID,
    pagination: PaginationParams,
    *,
    include_inactive: bool = False,
) -> tuple[list[Department], int]:
    return organizations_repo.list_departments(
        db, organization_id, pagination, include_inactive=include_inactive
    )


def _validate_manager(db: Session, organization_id: UUID, manager_user_id: UUID | None) -> None:
    if manager_user_id is None:
        return
    if not organizations_repo.is_active_member(db, organization_id, manager_user_id):
        raise not_found("Department manager not found in this organization")


def create_department(
    db: Session,
    *,
    organization_id: UUID,
    name: str,
    parent_id: UUID | None,
    manager_user_id: UUID | None = None,
) -> Department:
    if organizations_repo.find_department_by_name(db, organization_id, name) is not None:
        raise conflict("Department name already exists", {"name": name})
    if parent_id is not None:
        parent = get_department_or_404(
            db, organization_id=organization_id, department_id=parent_id
        )
        if not parent.is_active:
            raise AppError(
                "Parent department is inactive",
                code=ErrorCode.DEPARTMENT_INACTIVE,
                status_code=409,
            )
    _validate_manager(db, organization_id, manager_user_id)
    return organizations_repo.create_department_row(
        db,
        organization_id=organization_id,
        name=name,
        parent_id=parent_id,
        manager_user_id=manager_user_id,
    )


def _descendant_ids(db: Session, department_id: UUID) -> set[UUID]:
    found: set[UUID] = set()
    pending = [department_id]
    while pending:
        current = pending.pop()
        for child_id in organizations_repo.list_child_department_ids(
            db, department_id=current
        ):
            if child_id not in found:
                found.add(child_id)
                pending.append(child_id)
    return found


def update_department(
    db: Session, *, department: Department, changes: dict
) -> Department:
    if not department.is_active and any(field != "is_active" for field in changes):
        raise AppError(
            "Inactive departments cannot be edited",
            code=ErrorCode.DEPARTMENT_INACTIVE,
            status_code=409,
        )

    name = changes.get("name")
    if name is not None and name != department.name:
        existing = organizations_repo.find_department_by_name(
            db, department.organization_id, name
        )
        if existing is not None and existing.id != department.id:
            raise conflict("Department name already exists", {"name": name})

    if "parent_id" in changes:
        parent_id = changes["parent_id"]
        if parent_id == department.id:
            raise AppError(
                "A department cannot be its own parent",
                code=ErrorCode.DEPARTMENT_CYCLE,
                status_code=409,
            )
        if parent_id is not None:
            parent = get_department_or_404(
                db,
                organization_id=department.organization_id,
                department_id=parent_id,
            )
            if not parent.is_active:
                raise AppError(
                    "Parent department is inactive",
                    code=ErrorCode.DEPARTMENT_INACTIVE,
                    status_code=409,
                )
            if parent_id in _descendant_ids(db, department.id):
                raise AppError(
                    "Department hierarchy cannot contain a cycle",
                    code=ErrorCode.DEPARTMENT_CYCLE,
                    status_code=409,
                )

    if "manager_user_id" in changes:
        _validate_manager(db, department.organization_id, changes["manager_user_id"])

    for field, value in changes.items():
        setattr(department, field, value)
    db.flush()
    return department


def deactivate_department(db: Session, department: Department) -> Department:
    if not department.is_active:
        return department
    if organizations_repo.list_child_department_ids(db, department_id=department.id):
        raise AppError(
            "Department still has active child departments",
            code=ErrorCode.DEPARTMENT_HAS_CHILDREN,
            status_code=409,
        )
    if organizations_repo.active_members_in_department(db, department_id=department.id) > 0:
        raise AppError(
            "Department still has active members",
            code=ErrorCode.DEPARTMENT_HAS_MEMBERS,
            status_code=409,
        )
    department.is_active = False
    db.flush()
    return department


def list_members(
    db: Session,
    organization_id: UUID,
    pagination: PaginationParams,
    *,
    department_id: UUID | None = None,
    include_inactive: bool = True,
) -> tuple[list[OrganizationMember], int]:
    return organizations_repo.list_members(
        db,
        organization_id,
        pagination,
        department_id=department_id,
        include_inactive=include_inactive,
    )


def get_member_or_404(
    db: Session, *, organization_id: UUID, user_id: UUID
) -> OrganizationMember:
    member = organizations_repo.find_membership(
        db, organization_id=organization_id, user_id=user_id
    )
    if member is None:
        raise not_found("Organization member not found")
    return member


def serialize_member(db: Session, member: OrganizationMember) -> dict:
    user = users_repo.get_user_by_id(db, member.user_id)
    department = (
        organizations_repo.get_department(db, member.department_id)
        if member.department_id is not None
        else None
    )
    return {
        "id": member.id,
        "organization_id": member.organization_id,
        "user_id": member.user_id,
        "department_id": member.department_id,
        "department_name": department.name if department is not None else "",
        "is_active": member.is_active,
        "user_email": user.email if user is not None else "",
        "user_name": user.full_name if user is not None else "",
        "deactivated_at": member.deactivated_at,
    }


def update_member_department(
    db: Session, *, member: OrganizationMember, department_id: UUID | None
) -> OrganizationMember:
    if not member.is_active:
        raise AppError(
            "Inactive members cannot be updated",
            code=ErrorCode.MEMBER_ALREADY_INACTIVE,
            status_code=409,
        )
    if department_id is not None:
        department = get_department_or_404(
            db,
            organization_id=member.organization_id,
            department_id=department_id,
        )
        if not department.is_active:
            raise AppError(
                "Department is inactive",
                code=ErrorCode.DEPARTMENT_INACTIVE,
                status_code=409,
            )
    member.department_id = department_id
    db.flush()
    return member


def add_member(
    db: Session, *, organization_id: UUID, user_id: UUID, department_id: UUID | None = None
) -> OrganizationMember:
    if department_id is not None:
        department = get_department_or_404(
            db, organization_id=organization_id, department_id=department_id
        )
        if not department.is_active:
            raise AppError(
                "Department is inactive",
                code=ErrorCode.DEPARTMENT_INACTIVE,
                status_code=409,
            )
    return organizations_repo.add_member(
        db, organization_id=organization_id, user_id=user_id, department_id=department_id
    )


def project_authorizations(
    db: Session, *, organization_id: UUID, user_id: UUID
) -> list[dict]:
    rows = projects_repo.list_authorizations_for_user(
        db, organization_id=organization_id, user_id=user_id
    )
    return [
        {
            "project_id": project.id,
            "project_code": project.code,
            "project_title": project.title,
            "project_role": member.project_role,
            "is_active": member.is_active,
            "granted_by": member.granted_by,
            "granted_at": member.granted_at,
            "revoked_by": member.revoked_by,
            "revoked_at": member.revoked_at,
        }
        for member, project in rows
    ]


def member_detail(db: Session, member: OrganizationMember) -> dict:
    user = users_repo.get_user_by_id(db, member.user_id)
    department = (
        organizations_repo.get_department(db, member.department_id)
        if member.department_id is not None
        else None
    )
    return {
        "member": serialize_member(db, member),
        "user_email": user.email if user is not None else "",
        "user_name": user.full_name if user is not None else "",
        "user_active": bool(user.is_active) if user is not None else False,
        "department_name": department.name if department is not None else "",
        "role_codes": roles_service.user_role_codes(
            db, user_id=member.user_id, organization_id=member.organization_id
        ),
        "project_authorizations": project_authorizations(
            db,
            organization_id=member.organization_id,
            user_id=member.user_id,
        ),
    }


def offboard_member(
    db: Session,
    *,
    organization_id: UUID,
    user_id: UUID,
    handover_to_user_id: UUID | None,
    note: str,
    actor_user_id: UUID,
) -> OffboardingRecord:
    member = get_member_or_404(
        db, organization_id=organization_id, user_id=user_id
    )
    existing = organizations_repo.find_offboarding(
        db, organization_id=organization_id, user_id=user_id
    )
    if existing is not None:
        return existing
    if not member.is_active:
        raise AppError(
            "Member is already inactive but has no offboarding record",
            code=ErrorCode.MEMBER_ALREADY_INACTIVE,
            status_code=409,
        )
    if handover_to_user_id is not None:
        if handover_to_user_id == user_id:
            raise AppError(
                "Handover target cannot be the offboarding member",
                code=ErrorCode.HANDOVER_INVALID,
                status_code=409,
            )
        if not organizations_repo.is_active_member(
            db, organization_id, handover_to_user_id
        ):
            raise not_found("Handover target not found in this organization")

    user = users_repo.get_user_by_id(db, user_id)
    if user is None:
        raise not_found("User not found")
    owned_projects = projects_repo.list_owned_projects(
        db, organization_id=organization_id, user_id=user_id
    )
    if owned_projects and handover_to_user_id is None:
        raise AppError(
            "Handover target is required while the member owns projects",
            code=ErrorCode.HANDOVER_REQUIRED,
            status_code=409,
            details={"owned_projects": [project.code for project in owned_projects]},
        )

    now = utcnow()
    active_authorizations = projects_repo.list_active_memberships(
        db, organization_id=organization_id, user_id=user_id
    )
    transferred = 0
    for project in owned_projects:
        project.owner_user_id = handover_to_user_id
        transferred += 1
        if handover_to_user_id is None:
            continue
        target_member = projects_repo.find_member(db, project.id, handover_to_user_id)
        if target_member is None:
            projects_repo.add_member_row(
                db,
                project_id=project.id,
                user_id=handover_to_user_id,
                project_role="owner",
                granted_by=actor_user_id,
                granted_at=now,
            )
        else:
            target_member.project_role = "owner"
            target_member.is_active = True
            target_member.granted_by = actor_user_id
            target_member.granted_at = now
            target_member.revoked_by = None
            target_member.revoked_at = None

    revoked_project_ids: list[str] = []
    for authorization in active_authorizations:
        authorization.is_active = False
        authorization.revoked_by = actor_user_id
        authorization.revoked_at = now
        revoked_project_ids.append(str(authorization.project_id))

    roles_revoked = roles_repo.delete_user_roles_in_organization(
        db, user_id=user_id, organization_id=organization_id
    )

    other_memberships = organizations_repo.count_other_active_memberships(
        db, user_id=user_id, organization_id=organization_id
    )
    permission_grants_revoked = 0
    if other_memberships == 0:
        permission_grants_revoked = roles_repo.deactivate_permission_grants(db, user_id)
        user.is_active = False

    member.is_active = False
    member.deactivated_at = now

    sessions = auth_repo.list_active_sessions(db, user_id)
    for session in sessions:
        session.revoked_at = now

    record = OffboardingRecord(
        organization_id=organization_id,
        user_id=user_id,
        handover_to_user_id=handover_to_user_id,
        status="completed",
        note=note,
        project_count=len(owned_projects),
        transferred_project_count=transferred,
        project_authorizations_revoked=len(active_authorizations),
        roles_revoked=roles_revoked,
        permission_grants_revoked=permission_grants_revoked,
        sessions_revoked=len(sessions),
        details={
            "owned_projects": [project.code for project in owned_projects],
            "revoked_projects": revoked_project_ids,
        },
        completed_at=now,
        created_by=actor_user_id,
    )
    db.add(record)
    db.flush()
    return record


def list_offboarding(
    db: Session, organization_id: UUID, pagination: PaginationParams
) -> tuple[list[OffboardingRecord], int]:
    return organizations_repo.list_offboarding(db, organization_id, pagination)


def primary_organization_id(db: Session, user_id: UUID) -> UUID | None:
    return organizations_repo.primary_organization_id(db, user_id)


def has_active_membership(db: Session, user_id: UUID) -> bool:
    return organizations_repo.has_active_membership(db, user_id)
