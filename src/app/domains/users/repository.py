"""User data access: user rows and organization scoped listings."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.organizations.models import OrganizationMember
from app.domains.users.models import User


def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    return db.get(User, user_id)


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def any_user_exists(db: Session) -> bool:
    return db.scalar(select(User.id).limit(1)) is not None


def create_user_row(
    db: Session, *, email: str, full_name: str, password_hash: str
) -> User:
    user = User(email=email, full_name=full_name, password_hash=password_hash)
    db.add(user)
    db.flush()
    return user


def list_users_in_organization(
    db: Session, organization_id: UUID, pagination: PaginationParams
) -> tuple[list[User], int]:
    rows = db.scalars(
        select(User)
        .join(OrganizationMember, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.organization_id == organization_id)
        .order_by(User.created_at, User.email)
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()
    total = int(
        db.scalar(
            select(func.count(User.id))
            .join(OrganizationMember, OrganizationMember.user_id == User.id)
            .where(OrganizationMember.organization_id == organization_id)
        )
        or 0
    )
    return list(rows), total


def touch_last_login(db: Session, user: User) -> None:
    from app.utils.datetime import utcnow

    user.last_login_at = utcnow()
    db.flush()
