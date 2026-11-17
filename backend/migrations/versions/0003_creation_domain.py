"""Core creation domain: episodes, stories, scripts, production assets, storyboards."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_creation_domain"
down_revision = "0002_identity_access"
branch_labels = None
depends_on = None

UUID = postgresql.UUID(as_uuid=True)


def _id_column() -> sa.Column:
    return sa.Column("id", UUID, primary_key=True)


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def _status_column(default: str = "draft") -> sa.Column:
    return sa.Column("status", sa.String(20), nullable=False, server_default=default)


def _fk(name: str, target: str, *, nullable: bool = False, ondelete: str = "CASCADE") -> sa.Column:
    return sa.Column(
        name,
        UUID,
        sa.ForeignKey(target, ondelete=ondelete),
        nullable=nullable,
    )


def _version_table(table_name: str, owner_table: str, owner_fk: str, unique_name: str) -> None:
    op.create_table(
        table_name,
        _id_column(),
        _fk(owner_fk, f"{owner_table}.id"),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("appearance", sa.Text(), nullable=False, server_default=""),
        sa.Column("prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("reference_storage_key", sa.String(255), nullable=True),
        _status_column(),
        *_timestamps(),
        sa.UniqueConstraint(owner_fk, "version_number", name=unique_name),
    )
    op.create_index(f"ix_{table_name}_{owner_fk}", table_name, [owner_fk])


def upgrade() -> None:
    op.create_table(
        "episodes",
        _id_column(),
        _fk("project_id", "projects.id"),
        sa.Column("episode_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("synopsis", sa.Text(), nullable=False, server_default=""),
        _status_column(),
        *_timestamps(),
        sa.UniqueConstraint("project_id", "episode_number", name="uq_episodes_project_number"),
    )
    op.create_index("ix_episodes_project_id", "episodes", ["project_id"])

    op.create_table(
        "stories",
        _id_column(),
        _fk("project_id", "projects.id"),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("logline", sa.Text(), nullable=False, server_default=""),
        sa.Column("synopsis", sa.Text(), nullable=False, server_default=""),
        _status_column(),
        *_timestamps(),
    )
    op.create_index("ix_stories_project_id", "stories", ["project_id"])

    op.create_table(
        "story_bibles",
        _id_column(),
        _fk("project_id", "projects.id"),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column(
            "content", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")
        ),
        _status_column(),
        _fk("created_by", "users.id", nullable=True, ondelete="SET NULL"),
        *_timestamps(),
        sa.UniqueConstraint("project_id", "version_number", name="uq_story_bibles_project_version"),
    )
    op.create_index("ix_story_bibles_project_id", "story_bibles", ["project_id"])

    op.create_table(
        "scripts",
        _id_column(),
        _fk("episode_id", "episodes.id"),
        sa.Column("title", sa.String(200), nullable=False),
        _status_column(),
        *_timestamps(),
    )
    op.create_index("ix_scripts_episode_id", "scripts", ["episode_id"])

    op.create_table(
        "script_versions",
        _id_column(),
        _fk("script_id", "scripts.id"),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        _status_column(),
        _fk("created_by", "users.id", nullable=True, ondelete="SET NULL"),
        *_timestamps(),
        sa.UniqueConstraint(
            "script_id", "version_number", name="uq_script_versions_script_version"
        ),
    )
    op.create_index("ix_script_versions_script_id", "script_versions", ["script_id"])

    op.create_table(
        "script_scenes",
        _id_column(),
        _fk("script_version_id", "script_versions.id"),
        sa.Column("scene_number", sa.Integer(), nullable=False),
        sa.Column("location", sa.String(200), nullable=False, server_default=""),
        sa.Column("time_of_day", sa.String(60), nullable=False, server_default=""),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        *_timestamps(),
        sa.UniqueConstraint(
            "script_version_id", "scene_number", name="uq_script_scenes_version_number"
        ),
    )
    op.create_index("ix_script_scenes_script_version_id", "script_scenes", ["script_version_id"])

    op.create_table(
        "script_dialogues",
        _id_column(),
        _fk("script_scene_id", "script_scenes.id"),
        sa.Column("order_number", sa.Integer(), nullable=False),
        sa.Column("character_name", sa.String(120), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint(
            "script_scene_id", "order_number", name="uq_script_dialogues_scene_order"
        ),
    )
    op.create_index("ix_script_dialogues_script_scene_id", "script_dialogues", ["script_scene_id"])

    op.create_table(
        "characters",
        _id_column(),
        _fk("project_id", "projects.id"),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        *_timestamps(),
        sa.UniqueConstraint("project_id", "name", name="uq_characters_project_name"),
    )
    op.create_index("ix_characters_project_id", "characters", ["project_id"])
    _version_table(
        "character_versions",
        "characters",
        "character_id",
        "uq_character_versions_character_version",
    )

    op.create_table(
        "scenes",
        _id_column(),
        _fk("project_id", "projects.id"),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        *_timestamps(),
        sa.UniqueConstraint("project_id", "name", name="uq_scenes_project_name"),
    )
    op.create_index("ix_scenes_project_id", "scenes", ["project_id"])
    _version_table("scene_versions", "scenes", "scene_id", "uq_scene_versions_scene_version")

    op.create_table(
        "props",
        _id_column(),
        _fk("project_id", "projects.id"),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        *_timestamps(),
        sa.UniqueConstraint("project_id", "name", name="uq_props_project_name"),
    )
    op.create_index("ix_props_project_id", "props", ["project_id"])
    _version_table("prop_versions", "props", "prop_id", "uq_prop_versions_prop_version")

    op.create_table(
        "storyboards",
        _id_column(),
        _fk("episode_id", "episodes.id"),
        sa.Column("version_number", sa.Integer(), nullable=False),
        _status_column(),
        *_timestamps(),
        sa.UniqueConstraint("episode_id", "version_number", name="uq_storyboards_episode_version"),
    )
    op.create_index("ix_storyboards_episode_id", "storyboards", ["episode_id"])

    op.create_table(
        "shots",
        _id_column(),
        _fk("storyboard_id", "storyboards.id"),
        _fk("scene_id", "scenes.id", nullable=True, ondelete="SET NULL"),
        sa.Column("shot_number", sa.Integer(), nullable=False),
        sa.Column("shot_size", sa.String(40), nullable=False, server_default="medium"),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        _status_column(),
        *_timestamps(),
        sa.UniqueConstraint("storyboard_id", "shot_number", name="uq_shots_storyboard_number"),
    )
    op.create_index("ix_shots_storyboard_id", "shots", ["storyboard_id"])

    op.create_table(
        "shot_contracts",
        _id_column(),
        _fk("shot_id", "shots.id"),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column(
            "payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")
        ),
        _status_column(),
        _fk("created_by", "users.id", nullable=True, ondelete="SET NULL"),
        *_timestamps(),
        sa.UniqueConstraint("shot_id", "version_number", name="uq_shot_contracts_shot_version"),
    )
    op.create_index("ix_shot_contracts_shot_id", "shot_contracts", ["shot_id"])


def downgrade() -> None:
    for table in (
        "shot_contracts",
        "shots",
        "storyboards",
        "prop_versions",
        "props",
        "scene_versions",
        "scenes",
        "character_versions",
        "characters",
        "script_dialogues",
        "script_scenes",
        "script_versions",
        "scripts",
        "story_bibles",
        "stories",
        "episodes",
    ):
        op.drop_table(table)
