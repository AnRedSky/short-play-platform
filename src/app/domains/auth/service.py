"""Authentication business rules: bootstrap, login, refresh rotation and logout."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.domains.auth import repository as auth_repo
from app.domains.auth.tokens import create_access_token, refresh_expiry
from app.domains.organizations import service as organizations_service
from app.domains.roles import service as roles_service
from app.domains.users import repository as users_repo
from app.domains.users import service as users_service
from app.domains.users.models import User
from app.public.exceptions import authentication_required, conflict
from app.utils.crypto import hash_token, new_refresh_token, verify_password
from app.utils.datetime import ensure_utc, utcnow
from app.utils.string import normalize_email

ADMINISTRATOR_TEMPLATE = "administrator"


def issue_tokens(
    db: Session,
    user: User,
    *,
    organization_id: UUID | None,
    user_agent: str | None,
) -> dict:
    """Persist a refresh session and mint the matching access token."""
    raw_refresh, refresh_hash = new_refresh_token()
    auth_repo.create_session_row(
        db,
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=refresh_expiry(),
        user_agent=user_agent,
    )
    access_token, expires_in = create_access_token(
        user_id=user.id, organization_id=organization_id
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "refresh_token": raw_refresh,
        "user": user,
    }


def authenticate(
    db: Session, *, email: str, password: str, user_agent: str | None = None
) -> dict:
    user = users_repo.get_user_by_email(db, normalize_email(email))
    if user is None or not user.is_active or not verify_password(password, user.password_hash):
        # Identical response for an unknown user and a wrong password: no account enumeration.
        raise authentication_required("Invalid email or password")
    if not organizations_service.has_active_membership(db, user.id):
        raise authentication_required("User is not a member of any organization")
    users_repo.touch_last_login(db, user)
    return issue_tokens(
        db,
        user,
        organization_id=organizations_service.primary_organization_id(db, user.id),
        user_agent=user_agent,
    )


def refresh(db: Session, *, raw_refresh_token: str, user_agent: str | None = None) -> dict:
    session = auth_repo.get_session_by_token_hash(db, hash_token(raw_refresh_token))
    now = utcnow()
    if session is None or session.revoked_at is not None:
        raise authentication_required("Refresh token is not valid")
    if ensure_utc(session.expires_at) <= now:
        raise authentication_required("Refresh token has expired")
    user = users_repo.get_user_by_id(db, session.user_id)
    if user is None or not user.is_active:
        raise authentication_required("User is no longer active")
    # Rotation: the presented token is consumed before a new pair is issued.
    session.revoked_at = now
    session.last_used_at = now
    db.flush()
    return issue_tokens(
        db,
        user,
        organization_id=organizations_service.primary_organization_id(db, user.id),
        user_agent=user_agent,
    )


def revoke(db: Session, *, raw_refresh_token: str) -> None:
    session = auth_repo.get_session_by_token_hash(db, hash_token(raw_refresh_token))
    if session is None or session.revoked_at is not None:
        return
    session.revoked_at = utcnow()
    db.flush()


def revoke_all_for_user(db: Session, user_id: UUID) -> int:
    sessions = auth_repo.list_active_sessions(db, user_id)
    now = utcnow()
    for session in sessions:
        session.revoked_at = now
    db.flush()
    return len(sessions)


def bootstrap_first_administrator(
    db: Session, *, email: str, password: str, full_name: str, organization_name: str
) -> User:
    """Allowed only on an empty installation: creates the organization, the
    permission catalog, the administrator role and the first user."""
    if users_repo.any_user_exists(db):
        raise conflict("Bootstrap is only allowed before the first user exists")
    organization = organizations_service.create_organization(db, name=organization_name)
    admin_role = roles_service.provision_role_template(db, organization.id, ADMINISTRATOR_TEMPLATE)
    return users_service.create_user(
        db,
        email=email,
        full_name=full_name,
        password=password,
        organization_id=organization.id,
        role_ids=[admin_role.id],
    )


def purge_expired_sessions(db: Session) -> int:
    return auth_repo.delete_expired_sessions(db, before=utcnow())
