from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from apps.api.errors import conflict, not_found
from apps.api.models.creation import (
    Character,
    Episode,
    ProductionScene,
    Prop,
    Script,
    ScriptScene,
    ScriptVersion,
    Shot,
    ShotContract,
    Storyboard,
)


def next_version_number(db: Session, model: type, owner_column, owner_id: UUID) -> int:
    current = db.scalar(select(func.max(model.version_number)).where(owner_column == owner_id))
    return int(current or 0) + 1


def get_episode(db: Session, episode_id: UUID) -> Episode:
    episode = db.get(Episode, episode_id)
    if episode is None:
        raise not_found("Episode not found")
    return episode


def get_script(db: Session, script_id: UUID) -> Script:
    script = db.get(Script, script_id)
    if script is None:
        raise not_found("Script not found")
    return script


def get_script_version(db: Session, version_id: UUID) -> ScriptVersion:
    version = db.get(ScriptVersion, version_id)
    if version is None:
        raise not_found("Script version not found")
    return version


def get_script_scene(db: Session, scene_id: UUID) -> ScriptScene:
    scene = db.get(ScriptScene, scene_id)
    if scene is None:
        raise not_found("Script scene not found")
    return scene


def get_character(db: Session, character_id: UUID) -> Character:
    character = db.get(Character, character_id)
    if character is None:
        raise not_found("Character not found")
    return character


def get_scene_asset(db: Session, scene_id: UUID) -> ProductionScene:
    scene = db.get(ProductionScene, scene_id)
    if scene is None:
        raise not_found("Scene not found")
    return scene


def get_prop(db: Session, prop_id: UUID) -> Prop:
    prop = db.get(Prop, prop_id)
    if prop is None:
        raise not_found("Prop not found")
    return prop


def get_storyboard(db: Session, storyboard_id: UUID) -> Storyboard:
    storyboard = db.get(Storyboard, storyboard_id)
    if storyboard is None:
        raise not_found("Storyboard not found")
    return storyboard


def get_shot(db: Session, shot_id: UUID) -> Shot:
    shot = db.get(Shot, shot_id)
    if shot is None:
        raise not_found("Shot not found")
    return shot


def get_shot_contract(db: Session, contract_id: UUID) -> ShotContract:
    contract = db.get(ShotContract, contract_id)
    if contract is None:
        raise not_found("Shot contract not found")
    return contract


def project_of_episode(db: Session, episode_id: UUID) -> UUID:
    return get_episode(db, episode_id).project_id


def project_of_script(db: Session, script_id: UUID) -> UUID:
    return project_of_episode(db, get_script(db, script_id).episode_id)


def project_of_script_version(db: Session, version_id: UUID) -> UUID:
    return project_of_script(db, get_script_version(db, version_id).script_id)


def project_of_script_scene(db: Session, scene_id: UUID) -> UUID:
    return project_of_script_version(db, get_script_scene(db, scene_id).script_version_id)


def project_of_storyboard(db: Session, storyboard_id: UUID) -> UUID:
    return project_of_episode(db, get_storyboard(db, storyboard_id).episode_id)


def project_of_shot(db: Session, shot_id: UUID) -> UUID:
    return project_of_storyboard(db, get_shot(db, shot_id).storyboard_id)


def project_of_shot_contract(db: Session, contract_id: UUID) -> UUID:
    return project_of_shot(db, get_shot_contract(db, contract_id).shot_id)


def ensure_unique_episode_number(db: Session, project_id: UUID, episode_number: int) -> None:
    if db.scalar(
        select(Episode.id).where(
            Episode.project_id == project_id, Episode.episode_number == episode_number
        )
    ):
        raise conflict(
            "Episode number already exists in this project", {"episode_number": episode_number}
        )


def ensure_unique_shot_number(db: Session, storyboard_id: UUID, shot_number: int) -> None:
    if db.scalar(
        select(Shot.id).where(Shot.storyboard_id == storyboard_id, Shot.shot_number == shot_number)
    ):
        raise conflict(
            "Shot number already exists in this storyboard", {"shot_number": shot_number}
        )
