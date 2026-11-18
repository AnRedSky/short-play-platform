"""Creation business rules: episodes, story, script, production assets, shots."""

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.domains.creation import repository as creation_repo
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
    ScriptScene,
    ScriptVersion,
    Shot,
    ShotContract,
    Story,
    StoryBible,
    Storyboard,
)
from app.public.exceptions import conflict, not_found

# kind -> (row model, version model, version owner column, "not found" label)
_ASSET_SPEC: dict[str, tuple[type, type, Any, str]] = {
    "character": (Character, CharacterVersion, CharacterVersion.character_id, "Character"),
    "scene": (ProductionScene, SceneVersion, SceneVersion.scene_id, "Scene"),
    "prop": (Prop, PropVersion, PropVersion.prop_id, "Prop"),
}

_ASSET_VERSION_LISTERS = {
    "character": creation_repo.list_character_versions,
    "scene": creation_repo.list_scene_versions,
    "prop": creation_repo.list_prop_versions,
}


def next_version_number(db: Session, model: type, owner_column, owner_id: UUID) -> int:
    return creation_repo.next_version_number(db, model, owner_column, owner_id)


def get_episode_or_404(db: Session, episode_id: UUID) -> Episode:
    episode = creation_repo.get_episode(db, episode_id)
    if episode is None:
        raise not_found("Episode not found")
    return episode


def get_script_or_404(db: Session, script_id: UUID) -> Script:
    script = creation_repo.get_script(db, script_id)
    if script is None:
        raise not_found("Script not found")
    return script


def get_script_version_or_404(db: Session, version_id: UUID) -> ScriptVersion:
    version = creation_repo.get_script_version(db, version_id)
    if version is None:
        raise not_found("Script version not found")
    return version


def get_script_scene_or_404(db: Session, scene_id: UUID) -> ScriptScene:
    scene = creation_repo.get_script_scene(db, scene_id)
    if scene is None:
        raise not_found("Script scene not found")
    return scene


def get_storyboard_or_404(db: Session, storyboard_id: UUID) -> Storyboard:
    storyboard = creation_repo.get_storyboard(db, storyboard_id)
    if storyboard is None:
        raise not_found("Storyboard not found")
    return storyboard


def get_shot_or_404(db: Session, shot_id: UUID) -> Shot:
    shot = creation_repo.get_shot(db, shot_id)
    if shot is None:
        raise not_found("Shot not found")
    return shot


def get_shot_contract_or_404(db: Session, contract_id: UUID) -> ShotContract:
    contract = creation_repo.get_shot_contract(db, contract_id)
    if contract is None:
        raise not_found("Shot contract not found")
    return contract


def _asset_spec(kind: str) -> tuple[type, type, Any, str]:
    spec = _ASSET_SPEC.get(kind)
    if spec is None:
        raise not_found(f"Unknown production asset kind '{kind}'")
    return spec


def get_asset_or_404(db: Session, kind: str, asset_id: UUID) -> Any:
    model, _, _, label = _asset_spec(kind)
    row = db.get(model, asset_id)
    if row is None:
        raise not_found(f"{label} not found")
    return row


def get_character_or_404(db: Session, character_id: UUID) -> Character:
    return get_asset_or_404(db, "character", character_id)


def get_scene_asset_or_404(db: Session, scene_id: UUID) -> ProductionScene:
    return get_asset_or_404(db, "scene", scene_id)


def get_prop_or_404(db: Session, prop_id: UUID) -> Prop:
    return get_asset_or_404(db, "prop", prop_id)


def project_of_episode(db: Session, episode_id: UUID) -> UUID:
    return get_episode_or_404(db, episode_id).project_id


def project_of_script(db: Session, script_id: UUID) -> UUID:
    return project_of_episode(db, get_script_or_404(db, script_id).episode_id)


def project_of_script_version(db: Session, version_id: UUID) -> UUID:
    return project_of_script(db, get_script_version_or_404(db, version_id).script_id)


def project_of_script_scene(db: Session, scene_id: UUID) -> UUID:
    return project_of_script_version(db, get_script_scene_or_404(db, scene_id).script_version_id)


def project_of_storyboard(db: Session, storyboard_id: UUID) -> UUID:
    return project_of_episode(db, get_storyboard_or_404(db, storyboard_id).episode_id)


def project_of_shot(db: Session, shot_id: UUID) -> UUID:
    return project_of_storyboard(db, get_shot_or_404(db, shot_id).storyboard_id)


def project_of_shot_contract(db: Session, contract_id: UUID) -> UUID:
    return project_of_shot(db, get_shot_contract_or_404(db, contract_id).shot_id)


def ensure_unique_episode_number(db: Session, project_id: UUID, episode_number: int) -> None:
    if creation_repo.episode_number_exists(db, project_id, episode_number):
        raise conflict(
            "Episode number already exists in this project", {"episode_number": episode_number}
        )


def ensure_unique_shot_number(db: Session, storyboard_id: UUID, shot_number: int) -> None:
    if creation_repo.shot_number_exists(db, storyboard_id, shot_number):
        raise conflict(
            "Shot number already exists in this storyboard", {"shot_number": shot_number}
        )


# --- reads --------------------------------------------------------------------


def list_episodes(
    db: Session, project_id: UUID, *, offset: int = 0, limit: int | None = None
) -> list[Episode]:
    return creation_repo.list_episodes(db, project_id, offset=offset, limit=limit)


def list_stories(db: Session, project_id: UUID) -> list[Story]:
    return creation_repo.list_stories(db, project_id)


def list_story_bibles(db: Session, project_id: UUID) -> list[StoryBible]:
    return creation_repo.list_story_bibles(db, project_id)


def list_script_versions(db: Session, script_id: UUID) -> list[ScriptVersion]:
    return creation_repo.list_script_versions(db, script_id)


def list_script_scenes(db: Session, version_id: UUID) -> list[ScriptScene]:
    return creation_repo.list_script_scenes(db, version_id)


def list_project_assets(db: Session, kind: str, project_id: UUID) -> list:
    model, _, _, _ = _asset_spec(kind)
    return creation_repo.list_project_assets(db, model, project_id)


def list_shots(db: Session, storyboard_id: UUID) -> list[Shot]:
    return creation_repo.list_shots(db, storyboard_id)


def list_shot_contracts(db: Session, shot_id: UUID) -> list[ShotContract]:
    return creation_repo.list_shot_contracts(db, shot_id)


def list_asset_versions(db: Session, kind: str, asset_id: UUID) -> list:
    get_asset_or_404(db, kind, asset_id)
    lister = _ASSET_VERSION_LISTERS[kind]
    return lister(db, asset_id)


# --- writes -------------------------------------------------------------------


def create_episode(
    db: Session, *, project_id: UUID, episode_number: int, title: str, synopsis: str = ""
) -> Episode:
    ensure_unique_episode_number(db, project_id, episode_number)
    episode = Episode(
        project_id=project_id, episode_number=episode_number, title=title, synopsis=synopsis
    )
    return creation_repo.add_row(db, episode)


def create_story(
    db: Session, *, project_id: UUID, title: str, logline: str = "", synopsis: str = ""
) -> Story:
    story = Story(project_id=project_id, title=title, logline=logline, synopsis=synopsis)
    return creation_repo.add_row(db, story)


def create_story_bible(
    db: Session, *, project_id: UUID, content: dict, created_by: UUID | None
) -> StoryBible:
    bible = StoryBible(
        project_id=project_id,
        version_number=next_version_number(db, StoryBible, StoryBible.project_id, project_id),
        content=content,
        created_by=created_by,
    )
    return creation_repo.add_row(db, bible)


def create_script(db: Session, *, episode_id: UUID, title: str) -> Script:
    get_episode_or_404(db, episode_id)
    script = Script(episode_id=episode_id, title=title)
    return creation_repo.add_row(db, script)


def create_script_version(
    db: Session, *, script_id: UUID, content: str, created_by: UUID | None
) -> ScriptVersion:
    get_script_or_404(db, script_id)
    version = ScriptVersion(
        script_id=script_id,
        version_number=next_version_number(db, ScriptVersion, ScriptVersion.script_id, script_id),
        content=content,
        created_by=created_by,
    )
    return creation_repo.add_row(db, version)


def create_script_scene(
    db: Session,
    *,
    version_id: UUID,
    scene_number: int,
    location: str,
    time_of_day: str,
    summary: str,
) -> ScriptScene:
    get_script_version_or_404(db, version_id)
    if creation_repo.script_scene_number_exists(db, version_id, scene_number):
        raise conflict(
            "Scene number already exists in this script version",
            {"scene_number": scene_number},
        )
    scene = ScriptScene(
        script_version_id=version_id,
        scene_number=scene_number,
        location=location,
        time_of_day=time_of_day,
        summary=summary,
    )
    return creation_repo.add_row(db, scene)


def create_dialogue(
    db: Session, *, scene_id: UUID, order_number: int, character_name: str, content: str
) -> ScriptDialogue:
    get_script_scene_or_404(db, scene_id)
    if creation_repo.dialogue_order_exists(db, scene_id, order_number):
        raise conflict(
            "Dialogue order already exists in this scene", {"order_number": order_number}
        )
    dialogue = ScriptDialogue(
        script_scene_id=scene_id,
        order_number=order_number,
        character_name=character_name,
        content=content,
    )
    return creation_repo.add_row(db, dialogue)


def create_production_asset(
    db: Session, *, kind: str, project_id: UUID, name: str, description: str = ""
) -> Any:
    model, _, _, _ = _asset_spec(kind)
    if creation_repo.project_asset_name_exists(db, model, project_id, name):
        raise conflict("Asset name already exists in this project", {"name": name})
    row = model(project_id=project_id, name=name, description=description)
    return creation_repo.add_row(db, row)


def create_production_asset_version(
    db: Session,
    *,
    kind: str,
    asset_id: UUID,
    appearance: str,
    prompt: str,
    reference_storage_key: str | None,
) -> Any:
    _, version_model, owner_column, _ = _asset_spec(kind)
    get_asset_or_404(db, kind, asset_id)
    version = version_model(
        **{owner_column.key: asset_id},
        version_number=next_version_number(db, version_model, owner_column, asset_id),
        appearance=appearance,
        prompt=prompt,
        reference_storage_key=reference_storage_key,
    )
    return creation_repo.add_row(db, version)


def create_storyboard(db: Session, *, episode_id: UUID, version_number: int) -> Storyboard:
    get_episode_or_404(db, episode_id)
    if creation_repo.storyboard_version_exists(db, episode_id, version_number):
        raise conflict("Storyboard version already exists", {"version_number": version_number})
    storyboard = Storyboard(episode_id=episode_id, version_number=version_number)
    return creation_repo.add_row(db, storyboard)


def create_shot(
    db: Session,
    *,
    storyboard_id: UUID,
    shot_number: int,
    scene_id: UUID | None = None,
    shot_size: str = "medium",
    description: str = "",
) -> Shot:
    get_storyboard_or_404(db, storyboard_id)
    if scene_id is not None:
        get_scene_asset_or_404(db, scene_id)
    ensure_unique_shot_number(db, storyboard_id, shot_number)
    shot = Shot(
        storyboard_id=storyboard_id,
        scene_id=scene_id,
        shot_number=shot_number,
        shot_size=shot_size,
        description=description,
    )
    return creation_repo.add_row(db, shot)


def create_shot_contract(
    db: Session, *, shot_id: UUID, payload: dict, created_by: UUID | None
) -> ShotContract:
    get_shot_or_404(db, shot_id)
    contract = ShotContract(
        shot_id=shot_id,
        version_number=next_version_number(db, ShotContract, ShotContract.shot_id, shot_id),
        payload=payload,
        created_by=created_by,
    )
    return creation_repo.add_row(db, contract)
