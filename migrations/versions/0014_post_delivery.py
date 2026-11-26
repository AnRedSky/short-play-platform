"""Revision 0014: post-production timelines, episode outputs, final review and delivery."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0014_post_delivery"
down_revision = "0013_quality_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "timeline_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("episode_number", sa.Integer(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("timebase", sa.Integer(), nullable=False, server_default="25"),
        sa.Column("duration_ms", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("track_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clip_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stale_clips", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tracks", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("frozen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_timeline_versions_code"),
        sa.UniqueConstraint(
            "project_id",
            "episode_number",
            "version_number",
            name="uq_timeline_versions_project_ep_version",
        ),
    )
    op.create_index("ix_timeline_versions_project_id", "timeline_versions", ["project_id"])
    op.create_index("ix_timeline_versions_episode_number", "timeline_versions", ["episode_number"])
    op.create_index("ix_timeline_versions_status", "timeline_versions", ["status"])
    op.create_index("ix_timeline_versions_checksum", "timeline_versions", ["checksum"])

    op.create_table(
        "episode_outputs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("episode_number", sa.Integer(), nullable=False),
        sa.Column("timeline_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="已输出"),
        sa.Column("checksum", sa.String(length=64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["timeline_version_id"], ["timeline_versions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["asset_id"], ["media_assets.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "project_id",
            "episode_number",
            "timeline_version_id",
            name="uq_episode_outputs_project_ep_timeline",
        ),
    )
    op.create_index("ix_episode_outputs_project_id", "episode_outputs", ["project_id"])
    op.create_index("ix_episode_outputs_episode_number", "episode_outputs", ["episode_number"])
    op.create_index("ix_episode_outputs_timeline_version_id", "episode_outputs", ["timeline_version_id"])
    op.create_index("ix_episode_outputs_asset_id", "episode_outputs", ["asset_id"])
    op.create_index("ix_episode_outputs_status", "episode_outputs", ["status"])

    op.create_table(
        "final_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("decision", sa.String(length=20), nullable=False),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("quality_report_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["quality_report_id"], ["quality_reports.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_final_reviews_project_id", "final_reviews", ["project_id"])
    op.create_index("ix_final_reviews_decision", "final_reviews", ["decision"])

    op.create_table(
        "delivery_packages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="已冻结"),
        sa.Column("episode_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("file_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("checksum", sa.String(length=64), nullable=False),
        sa.Column("receiver", sa.String(length=120), nullable=False, server_default="企业内容库"),
        sa.Column("manifest", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("storage_key", sa.String(length=300), nullable=False),
        sa.Column("frozen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_delivery_packages_code"),
        sa.UniqueConstraint("project_id", name="uq_delivery_packages_project"),
    )
    op.create_index("ix_delivery_packages_project_id", "delivery_packages", ["project_id"])
    op.create_index("ix_delivery_packages_status", "delivery_packages", ["status"])
    op.create_index("ix_delivery_packages_checksum", "delivery_packages", ["checksum"])


def downgrade() -> None:
    op.drop_index("ix_delivery_packages_checksum", table_name="delivery_packages")
    op.drop_index("ix_delivery_packages_status", table_name="delivery_packages")
    op.drop_index("ix_delivery_packages_project_id", table_name="delivery_packages")
    op.drop_table("delivery_packages")

    op.drop_index("ix_final_reviews_decision", table_name="final_reviews")
    op.drop_index("ix_final_reviews_project_id", table_name="final_reviews")
    op.drop_table("final_reviews")

    op.drop_index("ix_episode_outputs_status", table_name="episode_outputs")
    op.drop_index("ix_episode_outputs_asset_id", table_name="episode_outputs")
    op.drop_index("ix_episode_outputs_timeline_version_id", table_name="episode_outputs")
    op.drop_index("ix_episode_outputs_episode_number", table_name="episode_outputs")
    op.drop_index("ix_episode_outputs_project_id", table_name="episode_outputs")
    op.drop_table("episode_outputs")

    op.drop_index("ix_timeline_versions_checksum", table_name="timeline_versions")
    op.drop_index("ix_timeline_versions_status", table_name="timeline_versions")
    op.drop_index("ix_timeline_versions_episode_number", table_name="timeline_versions")
    op.drop_index("ix_timeline_versions_project_id", table_name="timeline_versions")
    op.drop_table("timeline_versions")
