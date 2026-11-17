from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from apps.api.errors import authentication_required, conflict
from apps.api.models.identity import AuthSession, Organization, OrganizationMember, User
from apps.api.security.passwords import verify_password
from apps.api.security.tokens import (
    create_access_token,
    hash_token,
    new_refresh_token,
    refresh_expiry,
)
from apps.api.services.identity import (
    normalize_email,
    provision_role_template,
    sync_permission_catalog,
)


def _issue_tokens(db: Session, user: User, organization_id, user_agent: str | None) -> dict:
    raw_refresh, refresh_hash = new_refresh_token()
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=refresh_expiry(),
            user_agent=user_agent,
        )
    )
    access_token, expires_in = create_access_token(user_id=user.id, organization_id=organization_id)
    db.flush()
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "refresh_token": raw_refresh,
        "user": user,
    }


def primary_organization_id(db: Session, user_id) -> object:
    membership = db.scalar(
        select(OrganizationMember)
        .where(OrganizationMember.user_id == user_id, OrganizationMember.is_active.is_(True))
        .order_by(OrganizationMember.created_at)
    )
    return membership.organization_id if membership else None


def authenticate(db: Session, *, email: str, password: str, user_agent: str | None = None) -> dict:
    normalized = normalize_email(email)
    user = db.scalar(select(User).where(User.email == normalized))
    if user is None or not user.is_active or not verify_password(password, user.password_hash):
        # Identical response for unknown user and bad password: no account enumeration.
        raise authentication_required("Invalid email or password")
    if (
        db.scalar(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user.id,
                OrganizationMember.is_active.is_(True),
            )
        )
        is None
    ):
        raise authentication_required("User is not a member of any organization")
    user.last_login_at = datetime.now(UTC)
    db.flush()
    return _issue_tokens(db, user, primary_organization_id(db, user.id), user_agent)


def refresh(db: Session, *, raw_refresh_token: str, user_agent: str | None = None) -> dict:
    token_hash = hash_token(raw_refresh_token)
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash))
    now = datetime.now(UTC)
    if session is None or session.revoked_at is not None:
        raise authentication_required("Refresh token is not valid")
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= now:
        raise authentication_required("Refresh token has expired")
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise authentication_required("User is no longer active")
    # Rotation: the presented token is consumed before a new pair is issued.
    session.revoked_at = now
    session.last_used_at = now
    db.flush()
    return _issue_tokens(db, user, primary_organization_id(db, user.id), user_agent)


def revoke(db: Session, *, raw_refresh_token: str) -> None:
    token_hash = hash_token(raw_refresh_token)
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash))
    if session is None:
        return
    if session.revoked_at is None:
        session.revoked_at = datetime.now(UTC)
        db.flush()


def revoke_all_for_user(db: Session, user_id) -> int:
    sessions = list(
        db.scalars(
            select(AuthSession).where(
                AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None)
            )
        )
    )
    now = datetime.now(UTC)
    for session in sessions:
        session.revoked_at = now
    db.flush()
    return len(sessions)


def bootstrap_first_administrator(
    db: Session, *, email: str, password: str, full_name: str, organization_name: str
) -> User:
    """Allowed only on an empty installation; creates org, catalog, admin role and user."""
    if db.scalar(select(User).limit(1)) is not None:
        raise conflict("Bootstrap is only allowed before the first user exists")
    organization = Organization(
        name=organization_name,
        slug=organization_name.strip().lower().replace(" ", "-")[:100],
    )
    db.add(organization)
    db.flush()
    sync_permission_catalog(db)
    admin_role = provision_role_template(db, organization.id, "administrator")
    user = User(email=normalize_email(email), full_name=full_name, password_hash="")
    from apps.api.security.passwords import hash_password

    user.password_hash = hash_password(password)
    db.add(user)
    db.flush()
    db.add(OrganizationMember(organization_id=organization.id, user_id=user.id))
    from apps.api.models.access import UserRole

    db.add(UserRole(user_id=user.id, role_id=admin_role.id))
    db.flush()
    return user


def purge_expired_sessions(db: Session) -> int:
    result = db.execute(delete(AuthSession).where(AuthSession.expires_at < datetime.now(UTC)))
    return int(result.rowcount or 0)
