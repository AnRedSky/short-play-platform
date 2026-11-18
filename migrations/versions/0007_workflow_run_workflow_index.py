"""Revision 0007: add the missing workflow run lookup index."""

from alembic import op

revision = "0007_workflow_run_workflow_index"
down_revision = "0006_media_assets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_workflow_runs_workflow_id",
        "workflow_runs",
        ["workflow_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_workflow_runs_workflow_id", table_name="workflow_runs")
