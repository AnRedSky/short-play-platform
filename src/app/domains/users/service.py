"""Users domain business rules."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.audit import repository as audit_repo
from app.domains.audit import service as audit_service
from app.domains.organizations import repository as organizations_repo
from app.domains.organizations import service as organizations_service
from app.domains.roles import service as roles_service
from app.domains.users import repository as users_repo
from app.domains.users.constants import WELCOME_NOTIFICATION_ACTION
from app.domains.users.models import User
from app.public.exceptions import conflict, not_found
from app.utils.crypto import hash_password
from app.utils.string import normalize_email


def get_user_or_404(db: Session, user_id: UUID) -> User:
    user = users_repo.get_user_by_id(db, user_id)
    if user is None:
        raise not_found("User not found")
    return user


def assert_user_in_organization(db: Session, user: User, organization_id: UUID | None) -> None:
    if organization_id is None or not organizations_repo.is_active_member(
        db, organization_id, user.id
    ):
        raise not_found("User not found")


def create_user(
    db: Session,
    *,
    email: str,
    full_name: str,
    password: str,
    organization_id: UUID,
    department_id: UUID | None = None,
    role_ids: Sequence[UUID] = (),
) -> User:
    normalized = normalize_email(email)
    if users_repo.get_user_by_email(db, normalized) is not None:
        raise conflict("A user with this email already exists", {"email": normalized})

    user = users_repo.create_user_row(
        db,
        email=normalized,
        full_name=full_name,
        password_hash=hash_password(password),
    )
    organizations_service.add_member(
        db, organization_id=organization_id, user_id=user.id, department_id=department_id
    )
    # Roles are validated against the organization before anything is assigned.
    for role_id in role_ids:
        roles_service.assign_role_to_user(
            db, role_id=role_id, organization_id=organization_id, user_id=user.id
        )
    return user


def list_users(
    db: Session, organization_id: UUID, pagination: PaginationParams
) -> tuple[list[User], int]:
    return users_repo.list_users_in_organization(db, organization_id, pagination)


def update_user(
    db: Session,
    user: User,
    *,
    full_name: str | None = None,
    is_active: bool | None = None,
) -> User:
    if full_name is not None:
        user.full_name = full_name
    if is_active is not None:
        user.is_active = is_active
    db.flush()
    return user


def permissions_of(db: Session, user_id: UUID) -> list[str]:
    return sorted(roles_service.permission_codes_for_user(db, user_id))


def dispatch_welcome_notification(db: Session, user_id: UUID) -> bool:
    """Idempotent welcome notification: recorded once per user, never twice."""
    user = users_repo.get_user_by_id(db, user_id)
    if user is None:
        return False
    if (
        audit_repo.find_by_action_and_resource(
            db,
            action=WELCOME_NOTIFICATION_ACTION,
            resource_type="user",
            resource_id=str(user.id),
        )
        is not None
    ):
        return False
    audit_service.record(
        db,
        actor_user_id=None,
        action=WELCOME_NOTIFICATION_ACTION,
        resource_type="user",
        resource_id=str(user.id),
        details={"email": user.email},
    )
    return True
