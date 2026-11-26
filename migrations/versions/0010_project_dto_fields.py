"""Revision 0010: project brief fields and owner for the page DTO (B-01).

The page DTO needs the fields the create/edit form already collects. They live
as plain columns so PATCH persists them; no JSON side table is needed.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0010_project_dto_fields"
down_revision = "0009_script_reviews"
branch_labels = None
depends_on = None

_STRING_COLUMNS = (
    ("genre", 120, ""),
    ("audience", 200, ""),
    ("duration", 80, ""),
    ("ratio", 80, ""),
    ("language", 80, ""),
    ("style", 300, ""),
    ("quality", 80, ""),
    ("script_version", 120, ""),
    ("timeline_version", 120, ""),
)


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "owner_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_projects_owner_user_id", "projects", ["owner_user_id"])

    for name, length, default in _STRING_COLUMNS:
        op.add_column(
            "projects",
            sa.Column(name, sa.String(length), nullable=False, server_default=default),
        )
    op.add_column(
        "projects", sa.Column("constraints", sa.Text(), nullable=False, server_default="")
    )
    op.add_column(
        "projects",
        sa.Column("episodes", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "projects",
        sa.Column("budget", sa.Numeric(14, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "projects",
        sa.Column("actual", sa.Numeric(14, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "projects",
        sa.Column("estimated", sa.Numeric(14, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "projects",
        sa.Column("done_episodes", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "projects",
        sa.Column("delivered_episodes", sa.Integer(), nullable=False, server_default="0"),
    )

    # Backfill the owner from the project membership created at bootstrap.
    op.execute(
        """
        UPDATE projects p
        SET owner_user_id = (
            SELECT pm.user_id
            FROM project_members pm
            WHERE pm.project_id = p.id
              AND pm.project_role = 'owner'
              AND pm.is_active = true
            ORDER BY pm.created_at
            LIMIT 1
        )
        WHERE p.owner_user_id IS NULL
        """
    )


def downgrade() -> None:
    for name in (
        "done_episodes",
        "delivered_episodes",
        "estimated",
        "actual",
        "budget",
        "episodes",
        "constraints",
    ):
        op.drop_column("projects", name)
    for name, _, _ in reversed(_STRING_COLUMNS):
        op.drop_column("projects", name)
    op.drop_index("ix_projects_owner_user_id", table_name="projects")
    op.drop_column("projects", "owner_user_id")
