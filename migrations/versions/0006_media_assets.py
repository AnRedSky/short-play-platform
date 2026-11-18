"""Revision 0006: media assets, asset versions, references and export jobs."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006_media_assets"
down_revision = "0005_workflow_engine"
branch_labels = None
depends_on = None


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "media_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("title", sa.String(200), nullable=False, server_default=""),
        sa.Column("storage_key", sa.String(300), nullable=False),
        sa.Column(
            "mime_type", sa.String(120), nullable=False, server_default="application/octet-stream"
        ),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("source", sa.String(20), nullable=False, server_default="upload"),
        sa.Column(
            "generation_task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("generation_tasks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        *_timestamps(),
    )
    op.create_index("ix_media_assets_project_id", "media_assets", ["project_id"])
    op.create_index("ix_media_assets_kind", "media_assets", ["kind"])
    op.create_index("ix_media_assets_checksum", "media_assets", ["checksum"])
    op.create_index("ix_media_assets_status", "media_assets", ["status"])

    op.create_table(
        "asset_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "asset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("storage_key", sa.String(300), nullable=False),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("mime_type", sa.String(120), nullable=False, server_default=""),
        sa.Column("note", sa.Text(), nullable=True),
        *_timestamps(),
        sa.UniqueConstraint("asset_id", "version_number", name="uq_asset_versions_asset_number"),
    )
    op.create_index("ix_asset_versions_asset_id", "asset_versions", ["asset_id"])

    op.create_table(
        "asset_references",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "asset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ref_type", sa.String(40), nullable=False),
        sa.Column("ref_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_asset_references_asset_id", "asset_references", ["asset_id"])
    op.create_index("ix_asset_references_ref_type", "asset_references", ["ref_type"])
    op.create_index("ix_asset_references_ref_id", "asset_references", ["ref_id"])

    op.create_table(
        "export_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("spec", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column(
            "asset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("output_key", sa.String(300), nullable=True),
        sa.Column("error_code", sa.String(60), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "requested_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_export_jobs_project_id", "export_jobs", ["project_id"])
    op.create_index("ix_export_jobs_status", "export_jobs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_export_jobs_status", table_name="export_jobs")
    op.drop_index("ix_export_jobs_project_id", table_name="export_jobs")
    op.drop_table("export_jobs")
    op.drop_index("ix_asset_references_ref_id", table_name="asset_references")
    op.drop_index("ix_asset_references_ref_type", table_name="asset_references")
    op.drop_index("ix_asset_references_asset_id", table_name="asset_references")
    op.drop_table("asset_references")
    op.drop_index("ix_asset_versions_asset_id", table_name="asset_versions")
    op.drop_table("asset_versions")
    op.drop_index("ix_media_assets_status", table_name="media_assets")
    op.drop_index("ix_media_assets_checksum", table_name="media_assets")
    op.drop_index("ix_media_assets_kind", table_name="media_assets")
    op.drop_index("ix_media_assets_project_id", table_name="media_assets")
    op.drop_table("media_assets")
