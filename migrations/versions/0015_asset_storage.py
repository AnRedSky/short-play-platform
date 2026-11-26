"""Revision 0015: direct uploads, asset QC, authorization and formal versions."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0015_asset_storage"
down_revision = "0014_post_delivery"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "media_assets",
        sa.Column("qc_status", sa.String(length=20), nullable=False, server_default="pending"),
    )
    op.add_column(
        "media_assets",
        sa.Column("qc_note", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "media_assets", sa.Column("qc_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "media_assets",
        sa.Column(
            "authorization_status", sa.String(length=20), nullable=False, server_default="pending"
        ),
    )
    op.add_column(
        "media_assets",
        sa.Column("authorization_scope", sa.String(length=200), nullable=False, server_default=""),
    )
    op.add_column(
        "media_assets",
        sa.Column("authorization_note", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "media_assets", sa.Column("authorized_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "media_assets",
        sa.Column("authorized_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "media_assets",
        sa.Column("formal_version_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "media_assets",
        sa.Column("reference_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute(
        "DELETE FROM asset_references a USING asset_references b "
        "WHERE a.asset_id = b.asset_id AND a.ref_type = b.ref_type "
        "AND a.ref_id = b.ref_id AND a.ctid < b.ctid"
    )
    op.create_unique_constraint(
        "uq_asset_references_asset_type_ref",
        "asset_references",
        ["asset_id", "ref_type", "ref_id"],
    )
    op.execute(
        "UPDATE media_assets SET reference_count = ("
        "SELECT COUNT(*) FROM asset_references r WHERE r.asset_id = media_assets.id)"
    )
    op.execute(
        "UPDATE media_assets SET qc_status = 'passed', authorization_status = 'cleared' "
        "WHERE status = 'approved'"
    )
    op.create_index("ix_media_assets_qc_status", "media_assets", ["qc_status"])
    op.create_index(
        "ix_media_assets_authorization_status", "media_assets", ["authorization_status"]
    )
    op.create_foreign_key(
        "fk_media_assets_authorized_by",
        "media_assets",
        "users",
        ["authorized_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_media_assets_formal_version_id",
        "media_assets",
        "asset_versions",
        ["formal_version_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "asset_versions",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
    )
    op.create_index("ix_asset_versions_status", "asset_versions", ["status"])

    op.create_table(
        "asset_upload_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("storage_key", sa.String(length=300), nullable=False),
        sa.Column("filename", sa.String(length=200), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("max_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("checksum", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["asset_id"], ["media_assets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_asset_upload_sessions_token_hash"),
    )
    op.create_index(
        "ix_asset_upload_sessions_project_id", "asset_upload_sessions", ["project_id"]
    )
    op.create_index("ix_asset_upload_sessions_status", "asset_upload_sessions", ["status"])

    op.create_table(
        "asset_qc_checks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("asset_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("result", sa.String(length=20), nullable=False),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("checksum", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["asset_id"], ["media_assets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["asset_version_id"], ["asset_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_asset_qc_checks_project_id", "asset_qc_checks", ["project_id"])
    op.create_index("ix_asset_qc_checks_asset_id", "asset_qc_checks", ["asset_id"])
    op.create_index(
        "ix_asset_qc_checks_asset_version_id", "asset_qc_checks", ["asset_version_id"]
    )
    op.create_index("ix_asset_qc_checks_result", "asset_qc_checks", ["result"])


def downgrade() -> None:
    op.drop_index("ix_asset_qc_checks_result", table_name="asset_qc_checks")
    op.drop_index("ix_asset_qc_checks_asset_version_id", table_name="asset_qc_checks")
    op.drop_index("ix_asset_qc_checks_asset_id", table_name="asset_qc_checks")
    op.drop_index("ix_asset_qc_checks_project_id", table_name="asset_qc_checks")
    op.drop_table("asset_qc_checks")

    op.drop_index("ix_asset_upload_sessions_status", table_name="asset_upload_sessions")
    op.drop_index("ix_asset_upload_sessions_project_id", table_name="asset_upload_sessions")
    op.drop_table("asset_upload_sessions")

    op.drop_index("ix_asset_versions_status", table_name="asset_versions")
    op.drop_column("asset_versions", "status")

    op.drop_constraint("fk_media_assets_formal_version_id", "media_assets", type_="foreignkey")
    op.drop_constraint("fk_media_assets_authorized_by", "media_assets", type_="foreignkey")
    op.drop_constraint("uq_asset_references_asset_type_ref", "asset_references", type_="unique")
    op.drop_index("ix_media_assets_authorization_status", table_name="media_assets")
    op.drop_index("ix_media_assets_qc_status", table_name="media_assets")
    op.drop_column("media_assets", "reference_count")
    op.drop_column("media_assets", "formal_version_id")
    op.drop_column("media_assets", "authorized_by")
    op.drop_column("media_assets", "authorized_at")
    op.drop_column("media_assets", "authorization_note")
    op.drop_column("media_assets", "authorization_scope")
    op.drop_column("media_assets", "authorization_status")
    op.drop_column("media_assets", "qc_at")
    op.drop_column("media_assets", "qc_note")
    op.drop_column("media_assets", "qc_status")
