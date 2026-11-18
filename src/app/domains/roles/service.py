"""RBAC business rules: catalog sync, role provisioning and assignments."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.roles import repository as roles_repo
from app.domains.roles.constants import PERMISSION_CATALOG, ROLE_TEMPLATES
from app.domains.roles.models import Permission, Role
from app.domains.organizations import repository as organizations_repo
from app.public.exceptions import conflict, not_found


def sync_permission_catalog(db: Session) -> dict[str, Permission]:
    """Ensure every catalog code exists, then return the code -> Permission map."""
    existing = {permission.code: permission for permission in roles_repo.list_permissions(db)}
    for code, description in PERMISSION_CATALOG.items():
        if code not in existing:
            permission = Permission(code=code, description=description)
            db.add(permission)
            existing[code] = permission
    db.flush()
    return existing


def create_role(
    db: Session,
    *,
    organization_id: UUID,
    code: str,
    name: str,
    permission_codes: list[str],
    description: str = "",
) -> Role:
    if roles_repo.get_role_by_code(db, organization_id, code) is not None:
        raise conflict("Role code already exists in this organization", {"code": code})
    catalog = sync_permission_catalog(db)
    unknown = sorted(set(permission_codes) - set(catalog))
    if unknown:
        raise conflict("Unknown permission codes", {"permissions": unknown})

    role = roles_repo.create_role_row(
        db, organization_id=organization_id, code=code, name=name, description=description
    )
    roles_repo.add_role_permissions(
        db,
        role_id=role.id,
        permissions=[catalog[code] for code in sorted(set(permission_codes))],
    )
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


def get_role_in_organization(db: Session, role_id: UUID, organization_id: UUID) -> Role:
    role = roles_repo.get_role(db, role_id)
    if role is None or role.organization_id != organization_id:
        raise not_found("Role not found")
    return role


def validate_assignable_role(db: Session, role_id: UUID, organization_id: UUID) -> Role:
    """A role from another organization is a conflict, not an authorization error."""
    role = roles_repo.get_role(db, role_id)
    if role is None:
        raise not_found("Role not found")
    if role.organization_id != organization_id:
        raise conflict("Role belongs to a different organization")
    return role


def assign_role(db: Session, *, user_id: UUID, role_id: UUID) -> None:
    if roles_repo.get_user_role(db, user_id=user_id, role_id=role_id) is not None:
        return
    if roles_repo.get_role(db, role_id) is None:
        raise not_found("Role not found")
    roles_repo.add_user_role(db, user_id=user_id, role_id=role_id)


def assign_role_to_user(
    db: Session, *, role_id: UUID, organization_id: UUID, user_id: UUID
) -> Role:
    """Validate the role against the organization and the target user, then assign."""
    from app.domains.users import repository as users_repo

    role = validate_assignable_role(db, role_id, organization_id)
    if (
        users_repo.get_user_by_id(db, user_id) is None
        or not organizations_repo.is_active_member(db, organization_id, user_id)
    ):
        raise not_found("User not found in this organization")
    assign_role(db, user_id=user_id, role_id=role_id)
    return role


def permission_codes_for_user(
    db: Session, user_id: UUID, organization_id: UUID | None
) -> frozenset[str]:
    return roles_repo.permission_codes_of_user(db, user_id, organization_id)


def role_permission_codes(db: Session, role_id: UUID) -> list[str]:
    return roles_repo.permission_codes_of_role(db, role_id)


def list_roles(
    db: Session, organization_id: UUID, pagination: PaginationParams
) -> tuple[list[Role], int]:
    return roles_repo.list_roles_in_organization(db, organization_id, pagination)
