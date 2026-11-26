"""Revision 0011: generation queue fields and idempotent provider callbacks (B-05)."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0011_generation_queue"
down_revision = "0010_project_dto_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "generation_tasks",
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
    )
    op.add_column(
        "generation_tasks",
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "generation_tasks", sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "generation_tasks",
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "generation_tasks",
        sa.Column("last_provider_task_id", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "generation_tasks",
        sa.Column("last_callback_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "generation_tasks", sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index(
        "ix_generation_tasks_status_next_run",
        "generation_tasks",
        ["status", "next_run_at"],
    )
    op.execute(
        """
        UPDATE generation_tasks AS t
        SET attempt_count = COALESCE(
            (SELECT COUNT(*) FROM task_attempts AS a WHERE a.task_id = t.id), 0
        ),
        next_run_at = CASE
            WHEN t.status IN ('queued', 'retry_wait') THEN now()
            ELSE NULL
        END
        """
    )

    op.create_table(
        "provider_callback_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("generation_tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider_code", sa.String(length=60), nullable=False),
        sa.Column("callback_id", sa.String(length=120), nullable=False),
        sa.Column(
            "event_type", sa.String(length=20), nullable=False, server_default="completed"
        ),
        sa.Column("provider_task_id", sa.String(length=120), nullable=True),
        sa.Column("attempt_number", sa.Integer(), nullable=True),
        sa.Column(
            "payload",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("applied", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "outcome",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint(
            "task_id", "callback_id", name="uq_provider_callback_task_callback"
        ),
    )
    op.create_index(
        "ix_provider_callback_events_task_id",
        "provider_callback_events",
        ["task_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_provider_callback_events_task_id", table_name="provider_callback_events")
    op.drop_table("provider_callback_events")
    op.drop_index("ix_generation_tasks_status_next_run", table_name="generation_tasks")
    for name in (
        "paused_at",
        "last_callback_at",
        "last_provider_task_id",
        "lease_expires_at",
        "next_run_at",
        "attempt_count",
        "max_attempts",
    ):
        op.drop_column("generation_tasks", name)
