from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db import Base, TimestampMixin, UUIDPrimaryKeyMixin

CONTENT_STATUSES = ("draft", "in_review", "approved", "rejected", "archived")


class Episode(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "episodes"
    __table_args__ = (
        UniqueConstraint("project_id", "episode_number", name="uq_episodes_project_number"),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    episode_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    synopsis: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")


class Story(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "stories"

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    logline: Mapped[str] = mapped_column(Text, nullable=False, default="")
    synopsis: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")


class StoryBible(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "story_bibles"
    __table_args__ = (
        UniqueConstraint("project_id", "version_number", name="uq_story_bibles_project_version"),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    created_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class Script(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "scripts"

    episode_id: Mapped[UUID] = mapped_column(
        ForeignKey("episodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")


class ScriptVersion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "script_versions"
    __table_args__ = (
        UniqueConstraint("script_id", "version_number", name="uq_script_versions_script_version"),
    )

    script_id: Mapped[UUID] = mapped_column(
        ForeignKey("scripts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    created_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class ScriptScene(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "script_scenes"
    __table_args__ = (
        UniqueConstraint(
            "script_version_id", "scene_number", name="uq_script_scenes_version_number"
        ),
    )

    script_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("script_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scene_number: Mapped[int] = mapped_column(Integer, nullable=False)
    location: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    time_of_day: Mapped[str] = mapped_column(String(60), nullable=False, default="")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")


class ScriptDialogue(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "script_dialogues"
    __table_args__ = (
        UniqueConstraint("script_scene_id", "order_number", name="uq_script_dialogues_scene_order"),
    )

    script_scene_id: Mapped[UUID] = mapped_column(
        ForeignKey("script_scenes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_number: Mapped[int] = mapped_column(Integer, nullable=False)
    character_name: Mapped[str] = mapped_column(String(120), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)


class Character(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "characters"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_characters_project_name"),)

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")


class CharacterVersion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "character_versions"
    __table_args__ = (
        UniqueConstraint(
            "character_id", "version_number", name="uq_character_versions_character_version"
        ),
    )

    character_id: Mapped[UUID] = mapped_column(
        ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    appearance: Mapped[str] = mapped_column(Text, nullable=False, default="")
    prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    reference_storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")


class ProductionScene(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Physical scene location of the production (distinct from script scenes)."""

    __tablename__ = "scenes"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_scenes_project_name"),)

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")


class SceneVersion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "scene_versions"
    __table_args__ = (
        UniqueConstraint("scene_id", "version_number", name="uq_scene_versions_scene_version"),
    )

    scene_id: Mapped[UUID] = mapped_column(
        ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    appearance: Mapped[str] = mapped_column(Text, nullable=False, default="")
    prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    reference_storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")


class Prop(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "props"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_props_project_name"),)

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")


class PropVersion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "prop_versions"
    __table_args__ = (
        UniqueConstraint("prop_id", "version_number", name="uq_prop_versions_prop_version"),
    )

    prop_id: Mapped[UUID] = mapped_column(
        ForeignKey("props.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    appearance: Mapped[str] = mapped_column(Text, nullable=False, default="")
    prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    reference_storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")


class Storyboard(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "storyboards"
    __table_args__ = (
        UniqueConstraint("episode_id", "version_number", name="uq_storyboards_episode_version"),
    )

    episode_id: Mapped[UUID] = mapped_column(
        ForeignKey("episodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")


class Shot(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "shots"
    __table_args__ = (
        UniqueConstraint("storyboard_id", "shot_number", name="uq_shots_storyboard_number"),
    )

    storyboard_id: Mapped[UUID] = mapped_column(
        ForeignKey("storyboards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scene_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("scenes.id", ondelete="SET NULL"), nullable=True
    )
    shot_number: Mapped[int] = mapped_column(Integer, nullable=False)
    shot_size: Mapped[str] = mapped_column(String(40), nullable=False, default="medium")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")


class ScriptReview(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One immutable review decision per script version.

    The unique version key is what makes "move the project only once" enforceable
    at the database level, not just in service code.
    """

    __tablename__ = "script_reviews"
    __table_args__ = (
        UniqueConstraint("script_version_id", name="uq_script_reviews_version"),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    script_id: Mapped[UUID] = mapped_column(
        ForeignKey("scripts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    script_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("script_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class ShotContract(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "shot_contracts"
    __table_args__ = (
        UniqueConstraint("shot_id", "version_number", name="uq_shot_contracts_shot_version"),
    )

    shot_id: Mapped[UUID] = mapped_column(
        ForeignKey("shots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    created_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
