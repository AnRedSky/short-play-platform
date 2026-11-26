"""Revision 0008: project state machine transition ledger and canonical statuses.

Also backfills the five legacy English statuses into the frozen 15-state
vocabulary. Existing rows keep their UUID; only the exposed status changes.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0008_project_state_machine"
down_revision = "0007_workflow_run_workflow_index"
branch_labels = None
depends_on = None

_LEGACY_STATUS_BACKFILL = {
    "draft": "草稿",
    "in_review": "待剧本审核",
    "approved": "已完成",
    "rejected": "剧本创作中",
    "archived": "已归档",
}


def upgrade() -> None:
    op.add_column(
        "projects", sa.Column("previous_status", sa.String(20), nullable=True)
    )
    for legacy, canonical in _LEGACY_STATUS_BACKFILL.items():
        op.execute(
            sa.text("UPDATE projects SET status = :canonical WHERE status = :legacy").bindparams(
                canonical=canonical, legacy=legacy
            )
        )

    op.create_table(
        "project_transitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "actor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("from_status", sa.String(20), nullable=False),
        sa.Column("to_status", sa.String(20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("idempotency_key", sa.String(128), nullable=True),
        sa.Column(
            "result_payload", postgresql.JSONB(), nullable=False, server_default="{}"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "project_id", "idempotency_key", name="uq_project_transitions_project_key"
        ),
    )
    op.create_index(
        "ix_project_transitions_project_id", "project_transitions", ["project_id"]
    )
    op.create_index(
        "ix_project_transitions_project_created",
        "project_transitions",
        ["project_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_project_transitions_project_created", table_name="project_transitions"
    )
    op.drop_index("ix_project_transitions_project_id", table_name="project_transitions")
    op.drop_table("project_transitions")
    op.drop_column("projects", "previous_status")
    for legacy, canonical in _LEGACY_STATUS_BACKFILL.items():
        op.execute(
            sa.text("UPDATE projects SET status = :legacy WHERE status = :canonical").bindparams(
                legacy=legacy, canonical=canonical
            )
        )
