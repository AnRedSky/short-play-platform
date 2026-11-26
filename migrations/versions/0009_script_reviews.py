"""Revision 0009: immutable script review records (B-04).

One decision per script version, enforced by a unique constraint. Review row,
script/version status, project transition and audit are written in one request
transaction by the service layer.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0009_script_reviews"
down_revision = "0008_project_state_machine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "script_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "script_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("scripts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "script_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("script_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "actor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("script_version_id", name="uq_script_reviews_version"),
    )
    op.create_index("ix_script_reviews_project_id", "script_reviews", ["project_id"])
    op.create_index("ix_script_reviews_script_id", "script_reviews", ["script_id"])
    op.create_index(
        "ix_script_reviews_script_version_id", "script_reviews", ["script_version_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_script_reviews_script_version_id", table_name="script_reviews")
    op.drop_index("ix_script_reviews_script_id", table_name="script_reviews")
    op.drop_index("ix_script_reviews_project_id", table_name="script_reviews")
    op.drop_table("script_reviews")
