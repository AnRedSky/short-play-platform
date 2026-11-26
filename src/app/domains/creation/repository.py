"""Creation data access: episodes, stories, scripts, assets, storyboards, shots."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.creation.models import (
    Character,
    CharacterVersion,
    Episode,
    ProductionScene,
    Prop,
    PropVersion,
    SceneVersion,
    Script,
    ScriptDialogue,
    ScriptReview,
    ScriptScene,
    ScriptVersion,
    Shot,
    ShotContract,
    Story,
    StoryBible,
    Storyboard,
)


def add_row(db: Session, row: object) -> object:
    """Persist one row (the caller owns the transaction)."""
    db.add(row)
    db.flush()
    return row


def get_episode(db: Session, episode_id: UUID) -> Episode | None:
    return db.get(Episode, episode_id)


def get_story(db: Session, story_id: UUID) -> Story | None:
    return db.get(Story, story_id)


def get_story_bible(db: Session, bible_id: UUID) -> StoryBible | None:
    return db.get(StoryBible, bible_id)


def get_script(db: Session, script_id: UUID) -> Script | None:
    return db.get(Script, script_id)


def get_script_version(db: Session, version_id: UUID) -> ScriptVersion | None:
    return db.get(ScriptVersion, version_id)


def get_script_scene(db: Session, scene_id: UUID) -> ScriptScene | None:
    return db.get(ScriptScene, scene_id)


def get_dialogue(db: Session, dialogue_id: UUID) -> ScriptDialogue | None:
    return db.get(ScriptDialogue, dialogue_id)


def get_character(db: Session, character_id: UUID) -> Character | None:
    return db.get(Character, character_id)


def get_production_scene(db: Session, scene_id: UUID) -> ProductionScene | None:
    return db.get(ProductionScene, scene_id)


def get_prop(db: Session, prop_id: UUID) -> Prop | None:
    return db.get(Prop, prop_id)


def get_storyboard(db: Session, storyboard_id: UUID) -> Storyboard | None:
    return db.get(Storyboard, storyboard_id)


def get_shot(db: Session, shot_id: UUID) -> Shot | None:
    return db.get(Shot, shot_id)


def get_shot_contract(db: Session, contract_id: UUID) -> ShotContract | None:
    return db.get(ShotContract, contract_id)


def list_episodes(
    db: Session, project_id: UUID, *, offset: int = 0, limit: int | None = None
) -> list[Episode]:
    query = (
        select(Episode)
        .where(Episode.project_id == project_id)
        .order_by(Episode.episode_number)
        .offset(offset)
    )
    if limit is not None:
        query = query.limit(limit)
    return list(db.scalars(query).all())


def list_stories(db: Session, project_id: UUID) -> list[Story]:
    statement = select(Story).where(Story.project_id == project_id).order_by(Story.created_at)
    return list(db.scalars(statement).all())


def list_story_bibles(db: Session, project_id: UUID) -> list[StoryBible]:
    return list(
        db.scalars(
            select(StoryBible)
            .where(StoryBible.project_id == project_id)
            .order_by(StoryBible.version_number.desc())
        ).all()
    )


def list_script_versions(db: Session, script_id: UUID) -> list[ScriptVersion]:
    return list(
        db.scalars(
            select(ScriptVersion)
            .where(ScriptVersion.script_id == script_id)
            .order_by(ScriptVersion.version_number)
        ).all()
    )


def list_script_scenes(db: Session, version_id: UUID) -> list[ScriptScene]:
    return list(
        db.scalars(
            select(ScriptScene)
            .where(ScriptScene.script_version_id == version_id)
            .order_by(ScriptScene.scene_number)
        ).all()
    )


def list_project_assets(db: Session, model: type, project_id: UUID) -> list:
    return list(
        db.scalars(select(model).where(model.project_id == project_id).order_by(model.name)).all()
    )


def list_character_versions(db: Session, character_id: UUID) -> list[CharacterVersion]:
    return list(
        db.scalars(
            select(CharacterVersion)
            .where(CharacterVersion.character_id == character_id)
            .order_by(CharacterVersion.version_number)
        ).all()
    )


def list_scene_versions(db: Session, scene_id: UUID) -> list[SceneVersion]:
    return list(
        db.scalars(
            select(SceneVersion)
            .where(SceneVersion.scene_id == scene_id)
            .order_by(SceneVersion.version_number)
        ).all()
    )


def list_prop_versions(db: Session, prop_id: UUID) -> list[PropVersion]:
    return list(
        db.scalars(
            select(PropVersion)
            .where(PropVersion.prop_id == prop_id)
            .order_by(PropVersion.version_number)
        ).all()
    )


def list_shots(db: Session, storyboard_id: UUID) -> list[Shot]:
    return list(
        db.scalars(
            select(Shot).where(Shot.storyboard_id == storyboard_id).order_by(Shot.shot_number)
        ).all()
    )


def list_shot_contracts(db: Session, shot_id: UUID) -> list[ShotContract]:
    return list(
        db.scalars(
            select(ShotContract)
            .where(ShotContract.shot_id == shot_id)
            .order_by(ShotContract.version_number)
        ).all()
    )


def next_version_number(db: Session, model: type, owner_column, owner_id: UUID) -> int:
    current = db.scalar(select(func.max(model.version_number)).where(owner_column == owner_id))
    return int(current or 0) + 1


def episode_number_exists(db: Session, project_id: UUID, episode_number: int) -> bool:
    return (
        db.scalar(
            select(Episode.id).where(
                Episode.project_id == project_id, Episode.episode_number == episode_number
            )
        )
        is not None
    )


def shot_number_exists(db: Session, storyboard_id: UUID, shot_number: int) -> bool:
    return (
        db.scalar(
            select(Shot.id).where(
                Shot.storyboard_id == storyboard_id, Shot.shot_number == shot_number
            )
        )
        is not None
    )


def script_scene_number_exists(db: Session, version_id: UUID, scene_number: int) -> bool:
    return (
        db.scalar(
            select(ScriptScene.id).where(
                ScriptScene.script_version_id == version_id,
                ScriptScene.scene_number == scene_number,
            )
        )
        is not None
    )


def dialogue_order_exists(db: Session, scene_id: UUID, order_number: int) -> bool:
    return (
        db.scalar(
            select(ScriptDialogue.id).where(
                ScriptDialogue.script_scene_id == scene_id,
                ScriptDialogue.order_number == order_number,
            )
        )
        is not None
    )


def storyboard_version_exists(db: Session, episode_id: UUID, version_number: int) -> bool:
    return (
        db.scalar(
            select(Storyboard.id).where(
                Storyboard.episode_id == episode_id,
                Storyboard.version_number == version_number,
            )
        )
        is not None
    )


def project_asset_name_exists(db: Session, model: type, project_id: UUID, name: str) -> bool:
    return (
        db.scalar(select(model.id).where(model.project_id == project_id, model.name == name))
        is not None
    )


def get_script_review(db: Session, version_id: UUID) -> ScriptReview | None:
    return db.scalar(
        select(ScriptReview).where(ScriptReview.script_version_id == version_id)
    )


def list_script_reviews(db: Session, script_id: UUID) -> list[ScriptReview]:
    return list(
        db.scalars(
            select(ScriptReview)
            .where(ScriptReview.script_id == script_id)
            .order_by(ScriptReview.created_at.desc())
        ).all()
    )
