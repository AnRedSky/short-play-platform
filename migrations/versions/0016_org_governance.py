"""Revision 0016: department lifecycle, authorization evidence and offboarding."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0016_org_governance"
down_revision = "0015_asset_storage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "departments",
        sa.Column("manager_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "departments",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_index("ix_departments_is_active", "departments", ["is_active"])
    op.create_foreign_key(
        "fk_departments_manager_user_id",
        "departments",
        "users",
        ["manager_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "organization_members",
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE organization_members SET deactivated_at = updated_at "
        "WHERE is_active = false AND deactivated_at IS NULL"
    )

    op.add_column(
        "project_members",
        sa.Column("granted_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "project_members",
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "project_members",
        sa.Column("revoked_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "project_members",
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE project_members SET granted_at = created_at WHERE granted_at IS NULL")
    op.execute(
        "UPDATE project_members SET revoked_at = updated_at "
        "WHERE is_active = false AND revoked_at IS NULL"
    )
    op.create_foreign_key(
        "fk_project_members_granted_by",
        "project_members",
        "users",
        ["granted_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_project_members_revoked_by",
        "project_members",
        "users",
        ["revoked_by"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "offboarding_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("handover_to_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="completed"),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("project_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "transferred_project_count", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "project_authorizations_revoked", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("roles_revoked", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "permission_grants_revoked", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("sessions_revoked", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "details", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["handover_to_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id", "user_id", name="uq_offboarding_records_org_user"
        ),
    )
    op.create_index(
        "ix_offboarding_records_organization_id", "offboarding_records", ["organization_id"]
    )
    op.create_index("ix_offboarding_records_user_id", "offboarding_records", ["user_id"])
    op.create_index("ix_offboarding_records_status", "offboarding_records", ["status"])


def downgrade() -> None:
    op.drop_index("ix_offboarding_records_status", table_name="offboarding_records")
    op.drop_index("ix_offboarding_records_user_id", table_name="offboarding_records")
    op.drop_index("ix_offboarding_records_organization_id", table_name="offboarding_records")
    op.drop_table("offboarding_records")

    op.drop_constraint("fk_project_members_revoked_by", "project_members", type_="foreignkey")
    op.drop_constraint("fk_project_members_granted_by", "project_members", type_="foreignkey")
    op.drop_column("project_members", "revoked_at")
    op.drop_column("project_members", "revoked_by")
    op.drop_column("project_members", "granted_at")
    op.drop_column("project_members", "granted_by")

    op.drop_column("organization_members", "deactivated_at")

    op.drop_constraint("fk_departments_manager_user_id", "departments", type_="foreignkey")
    op.drop_index("ix_departments_is_active", table_name="departments")
    op.drop_column("departments", "is_active")
    op.drop_column("departments", "manager_user_id")
