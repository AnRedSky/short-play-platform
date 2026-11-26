"""RBAC data access: permission catalog, roles and assignments."""

from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.dependencies.pagination import PaginationParams
from app.domains.roles.models import Permission, PermissionGrant, Role, RolePermission, UserRole


def list_permissions(db: Session) -> list[Permission]:
    return list(db.scalars(select(Permission).order_by(Permission.code)).all())


def get_permission_by_code(db: Session, code: str) -> Permission | None:
    return db.scalar(select(Permission).where(Permission.code == code))


def get_role(db: Session, role_id: UUID) -> Role | None:
    return db.get(Role, role_id)


def get_role_by_code(db: Session, organization_id: UUID, code: str) -> Role | None:
    return db.scalar(select(Role).where(Role.organization_id == organization_id, Role.code == code))


def list_roles_in_organization(
    db: Session, organization_id: UUID, pagination: PaginationParams
) -> tuple[list[Role], int]:
    rows = db.scalars(
        select(Role)
        .where(Role.organization_id == organization_id)
        .order_by(Role.code)
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()
    total = int(
        db.scalar(select(func.count(Role.id)).where(Role.organization_id == organization_id)) or 0
    )
    return list(rows), total


def create_role_row(
    db: Session, *, organization_id: UUID, code: str, name: str, description: str = ""
) -> Role:
    role = Role(organization_id=organization_id, code=code, name=name, description=description)
    db.add(role)
    db.flush()
    return role


def add_role_permissions(db: Session, *, role_id: UUID, permissions: list[Permission]) -> None:
    for permission in permissions:
        db.add(RolePermission(role_id=role_id, permission_id=permission.id))
    db.flush()


def get_user_role(db: Session, *, user_id: UUID, role_id: UUID) -> UserRole | None:
    statement = select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == role_id)
    return db.scalar(statement)


def add_user_role(db: Session, *, user_id: UUID, role_id: UUID) -> None:
    db.add(UserRole(user_id=user_id, role_id=role_id))
    db.flush()


def permission_codes_of_role(db: Session, role_id: UUID) -> list[str]:
    return sorted(
        db.scalars(
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role_id)
        ).all()
    )


def permission_codes_of_user(
    db: Session, user_id: UUID, organization_id: UUID | None
) -> frozenset[str]:
    codes = set()
    if organization_id is not None:
        codes.update(
            db.scalars(
                select(Permission.code)
                .join(RolePermission, RolePermission.permission_id == Permission.id)
                .join(Role, Role.id == RolePermission.role_id)
                .join(UserRole, UserRole.role_id == Role.id)
                .where(
                    UserRole.user_id == user_id,
                    Role.organization_id == organization_id,
                )
            ).all()
        )
    codes.update(
        db.scalars(
            select(Permission.code)
            .join(PermissionGrant, PermissionGrant.permission_id == Permission.id)
            .where(PermissionGrant.user_id == user_id, PermissionGrant.is_active.is_(True))
        ).all()
    )
    return frozenset(codes)


def list_user_role_codes(db: Session, *, user_id: UUID, organization_id: UUID) -> list[str]:
    return sorted(
        db.scalars(
            select(Role.code)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id, Role.organization_id == organization_id)
        ).all()
    )


def delete_user_role(db: Session, *, user_id: UUID, role_id: UUID) -> int:
    result = db.execute(
        delete(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == role_id)
    )
    return int(result.rowcount or 0)


def delete_user_roles_in_organization(
    db: Session, *, user_id: UUID, organization_id: UUID
) -> int:
    role_ids = select(Role.id).where(Role.organization_id == organization_id)
    result = db.execute(
        delete(UserRole).where(UserRole.user_id == user_id, UserRole.role_id.in_(role_ids))
    )
    return int(result.rowcount or 0)


def delete_all_user_roles(db: Session, user_id: UUID) -> int:
    result = db.execute(delete(UserRole).where(UserRole.user_id == user_id))
    return int(result.rowcount or 0)


def deactivate_permission_grants(db: Session, user_id: UUID) -> int:
    result = db.execute(
        update(PermissionGrant)
        .where(PermissionGrant.user_id == user_id, PermissionGrant.is_active.is_(True))
        .values(is_active=False)
    )
    return int(result.rowcount or 0)
