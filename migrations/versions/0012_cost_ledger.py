"""Revision 0012: cost rates and attempt-level usage ledger (B-06)."""

import sqlalchemy as sa
from alembic import op

revision = "0012_cost_ledger"
down_revision = "0011_generation_queue"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cost_rates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("provider_code", sa.String(length=60), nullable=False),
        sa.Column("model_code", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("capability", sa.String(length=40), nullable=False),
        sa.Column("unit", sa.String(length=40), nullable=False, server_default="call"),
        sa.Column("unit_price", sa.Numeric(12, 4), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="CNY"),
        sa.Column(
            "failure_ratio", sa.Numeric(5, 4), nullable=False, server_default="0.5000"
        ),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider_code",
            "model_code",
            "capability",
            "effective_from",
            name="uq_cost_rates_scope_effective",
        ),
    )
    op.create_index("ix_cost_rates_provider_code", "cost_rates", ["provider_code"])
    op.create_index("ix_cost_rates_capability", "cost_rates", ["capability"])

    op.add_column(
        "usage_records",
        sa.Column("attempt_id", sa.Uuid(), nullable=True),
    )
    op.add_column("usage_records", sa.Column("project_id", sa.Uuid(), nullable=True))
    op.add_column("usage_records", sa.Column("cost_rate_id", sa.Uuid(), nullable=True))
    op.add_column("usage_records", sa.Column("code", sa.String(length=60), nullable=True))
    op.add_column(
        "usage_records",
        sa.Column("capability", sa.String(length=40), nullable=False, server_default=""),
    )
    op.add_column(
        "usage_records",
        sa.Column("unit_price", sa.Numeric(12, 4), nullable=False, server_default="0"),
    )
    op.add_column(
        "usage_records",
        sa.Column("estimated_amount", sa.Numeric(14, 4), nullable=False, server_default="0"),
    )
    op.add_column(
        "usage_records",
        sa.Column("amount", sa.Numeric(14, 4), nullable=False, server_default="0"),
    )
    op.add_column(
        "usage_records",
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="CNY"),
    )
    op.add_column(
        "usage_records",
        sa.Column("failure", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "usage_records",
        sa.Column(
            "billing_status", sa.String(length=20), nullable=False, server_default="待对账"
        ),
    )
    op.add_column(
        "usage_records",
        sa.Column(
            "billing_basis", sa.String(length=30), nullable=False, server_default="provider"
        ),
    )
    op.add_column(
        "usage_records", sa.Column("episode_number", sa.Integer(), nullable=True)
    )
    op.add_column("usage_records", sa.Column("shot_id", sa.Uuid(), nullable=True))

    op.create_foreign_key(
        "fk_usage_records_attempt_id",
        "usage_records",
        "task_attempts",
        ["attempt_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_usage_records_project_id",
        "usage_records",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_usage_records_cost_rate_id",
        "usage_records",
        "cost_rates",
        ["cost_rate_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_usage_records_shot_id",
        "usage_records",
        "shots",
        ["shot_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_usage_records_attempt_id", "usage_records", ["attempt_id"])
    op.create_index("ix_usage_records_project_id", "usage_records", ["project_id"])
    op.create_unique_constraint(
        "uq_usage_records_attempt", "usage_records", ["attempt_id"]
    )
    op.create_unique_constraint("uq_usage_records_code", "usage_records", ["code"])


def downgrade() -> None:
    op.drop_constraint("uq_usage_records_code", "usage_records", type_="unique")
    op.drop_constraint("uq_usage_records_attempt", "usage_records", type_="unique")
    op.drop_index("ix_usage_records_project_id", table_name="usage_records")
    op.drop_index("ix_usage_records_attempt_id", table_name="usage_records")
    op.drop_constraint("fk_usage_records_shot_id", "usage_records", type_="foreignkey")
    op.drop_constraint("fk_usage_records_cost_rate_id", "usage_records", type_="foreignkey")
    op.drop_constraint("fk_usage_records_project_id", "usage_records", type_="foreignkey")
    op.drop_constraint("fk_usage_records_attempt_id", "usage_records", type_="foreignkey")
    for column in (
        "shot_id",
        "episode_number",
        "billing_basis",
        "billing_status",
        "failure",
        "currency",
        "amount",
        "estimated_amount",
        "unit_price",
        "capability",
        "code",
        "cost_rate_id",
        "project_id",
        "attempt_id",
    ):
        op.drop_column("usage_records", column)
    op.drop_index("ix_cost_rates_capability", table_name="cost_rates")
    op.drop_index("ix_cost_rates_provider_code", table_name="cost_rates")
    op.drop_table("cost_rates")
