from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.errors import conflict, not_found
from apps.api.models.access import (
    Permission,
    PermissionGrant,
    Role,
    RolePermission,
    UserRole,
)
from apps.api.models.identity import Organization, OrganizationMember, User
from apps.api.security.passwords import hash_password
from apps.api.security.permissions import PERMISSION_CATALOG, ROLE_TEMPLATES


def normalize_email(email: str) -> str:
    return email.strip().lower()


def sync_permission_catalog(db: Session) -> dict[str, Permission]:
    existing = {permission.code: permission for permission in db.scalars(select(Permission))}
    for code, description in PERMISSION_CATALOG.items():
        if code not in existing:
            permission = Permission(code=code, description=description)
            db.add(permission)
            existing[code] = permission
    db.flush()
    return existing


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalize_email(email)))


def create_user(
    db: Session,
    *,
    email: str,
    full_name: str,
    password: str,
    organization_id: UUID,
    department_id: UUID | None = None,
) -> User:
    normalized = normalize_email(email)
    if get_user_by_email(db, normalized) is not None:
        raise conflict("A user with this email already exists", {"email": normalized})
    user = User(
        email=normalized,
        full_name=full_name,
        password_hash=hash_password(password),
    )
    db.add(user)
    db.flush()
    db.add(
        OrganizationMember(
            organization_id=organization_id, user_id=user.id, department_id=department_id
        )
    )
    db.flush()
    return user


def get_organization(db: Session, organization_id: UUID) -> Organization:
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise not_found("Organization not found")
    return organization


def create_role(
    db: Session,
    *,
    organization_id: UUID,
    code: str,
    name: str,
    permission_codes: list[str],
    description: str = "",
) -> Role:
    if db.scalar(select(Role).where(Role.organization_id == organization_id, Role.code == code)):
        raise conflict("Role code already exists in this organization", {"code": code})
    catalog = sync_permission_catalog(db)
    unknown = sorted(set(permission_codes) - set(catalog))
    if unknown:
        raise conflict("Unknown permission codes", {"permissions": unknown})
    role = Role(organization_id=organization_id, code=code, name=name, description=description)
    db.add(role)
    db.flush()
    for permission_code in sorted(set(permission_codes)):
        db.add(RolePermission(role_id=role.id, permission_id=catalog[permission_code].id))
    db.flush()
    return role


def provision_role_template(db: Session, organization_id: UUID, template_code: str) -> Role:
    template = ROLE_TEMPLATES.get(template_code)
    if template is None:
        raise conflict("Unknown role template", {"template": template_code})
    return create_role(
        db,
        organization_id=organization_id,
        code=template_code,
        name=str(template["name"]),
        permission_codes=list(template["permissions"]),  # type: ignore[arg-type]
    )


def assign_role(db: Session, *, user_id: UUID, role_id: UUID) -> None:
    if db.get(UserRole, {"user_id": user_id, "role_id": role_id}) is not None:
        return
    if db.get(Role, role_id) is None:
        raise not_found("Role not found")
    db.add(UserRole(user_id=user_id, role_id=role_id))
    db.flush()


def user_permissions(db: Session, user_id: UUID) -> frozenset[str]:
    codes = set(
        db.scalars(
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
        )
    )
    codes.update(
        db.scalars(
            select(Permission.code)
            .join(PermissionGrant, PermissionGrant.permission_id == Permission.id)
            .where(PermissionGrant.user_id == user_id, PermissionGrant.is_active.is_(True))
        )
    )
    return frozenset(codes)


def role_permission_codes(db: Session, role_id: UUID) -> list[str]:
    return sorted(
        db.scalars(
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role_id)
        )
    )
