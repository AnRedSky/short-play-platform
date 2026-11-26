"""Revision 0017: notification inbox and append-only audit hardening."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0017_notifications_audit"
down_revision = "0016_org_governance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "audit_logs",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_audit_logs_organization_id", "audit_logs", ["organization_id"])
    op.create_foreign_key(
        "fk_audit_logs_organization_id",
        "audit_logs",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        """
        UPDATE audit_logs AS log
        SET organization_id = member.organization_id
        FROM organization_members AS member
        WHERE member.user_id = log.actor_user_id
          AND log.organization_id IS NULL
        """
    )

    op.execute(
        """
        CREATE FUNCTION audit_logs_append_only() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'audit_logs is append-only'
                USING ERRCODE = 'check_violation';
        END;
        $$
        """
    )
    op.execute(
        "CREATE TRIGGER trg_audit_logs_append_only "
        "BEFORE UPDATE OR DELETE ON audit_logs "
        "FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only()"
    )
    op.execute(
        "CREATE TRIGGER trg_audit_logs_no_truncate "
        "BEFORE TRUNCATE ON audit_logs "
        "FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only()"
    )

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipient_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("type", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("impact", sa.Text(), nullable=False, server_default=""),
        sa.Column("action_hint", sa.Text(), nullable=False, server_default=""),
        sa.Column("link", sa.String(length=300), nullable=False),
        sa.Column("object_type", sa.String(length=60), nullable=False),
        sa.Column("object_key", sa.String(length=120), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False, server_default="待处理"),
        sa.Column("unread", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("merge_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "last_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["read_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    for name, columns in (
        ("ix_notifications_organization_id", ["organization_id"]),
        ("ix_notifications_recipient_user_id", ["recipient_user_id"]),
        ("ix_notifications_project_id", ["project_id"]),
        ("ix_notifications_type", ["type"]),
        ("ix_notifications_state", ["state"]),
        ("ix_notifications_unread", ["unread"]),
        ("ix_notifications_last_at", ["last_at"]),
        (
            "ix_notifications_recipient_unread_last_at",
            ["recipient_user_id", "unread", "last_at"],
        ),
        (
            "ix_notifications_merge_target",
            ["organization_id", "recipient_user_id", "type", "object_type", "object_key"],
        ),
    ):
        op.create_index(name, "notifications", columns)


def downgrade() -> None:
    op.drop_table("notifications")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs")
    op.execute("DROP FUNCTION IF EXISTS audit_logs_append_only()")
    op.drop_constraint("fk_audit_logs_organization_id", "audit_logs", type_="foreignkey")
    op.drop_index("ix_audit_logs_organization_id", table_name="audit_logs")
    op.drop_column("audit_logs", "organization_id")
