"""Generation tasks, task attempts and usage records (mock provider first)."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_generation_tasks"
down_revision = "0003_creation_domain"
branch_labels = None
depends_on = None

UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "generation_tasks",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "project_id", UUID, sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("capability", sa.String(40), nullable=False),
        sa.Column("provider_code", sa.String(60), nullable=False, server_default="mock"),
        sa.Column("model_code", sa.String(80), nullable=False, server_default="mock-default"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("idempotency_key", sa.String(120), nullable=False),
        sa.Column(
            "request_payload",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "result_payload",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("error_code", sa.String(60), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "requested_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("cancel_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint(
            "project_id", "idempotency_key", name="uq_generation_tasks_project_idempotency"
        ),
    )
    op.create_index("ix_generation_tasks_project_id", "generation_tasks", ["project_id"])
    op.create_index("ix_generation_tasks_capability", "generation_tasks", ["capability"])
    op.create_index("ix_generation_tasks_status", "generation_tasks", ["status"])

    op.create_table(
        "task_attempts",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "task_id",
            UUID,
            sa.ForeignKey("generation_tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("provider_task_id", sa.String(120), nullable=True),
        sa.Column("request_digest", sa.String(64), nullable=True),
        sa.Column("response_digest", sa.String(64), nullable=True),
        sa.Column("error_code", sa.String(60), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("task_id", "attempt_number", name="uq_task_attempts_task_number"),
    )
    op.create_index("ix_task_attempts_task_id", "task_attempts", ["task_id"])

    op.create_table(
        "usage_records",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "task_id",
            UUID,
            sa.ForeignKey("generation_tasks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("provider_code", sa.String(60), nullable=False),
        sa.Column("model_code", sa.String(80), nullable=False, server_default=""),
        sa.Column("unit", sa.String(40), nullable=False, server_default="call"),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("source", sa.String(40), nullable=False, server_default="provider"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_usage_records_task_id", "usage_records", ["task_id"])


def downgrade() -> None:
    op.drop_table("usage_records")
    op.drop_table("task_attempts")
    op.drop_table("generation_tasks")
