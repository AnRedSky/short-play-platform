from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.deps import Principal, require_permission
from apps.api.errors import conflict
from apps.api.models.creation import (
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
from apps.api.schemas.common import envelope
from apps.api.schemas.creation import (
    AssetCreate,
    AssetDetailRead,
    AssetRead,
    AssetVersionCreate,
    AssetVersionRead,
    EpisodeCreate,
    EpisodeRead,
    ScriptCreate,
    ScriptDialogueCreate,
    ScriptDialogueRead,
    ScriptRead,
    ScriptSceneCreate,
    ScriptSceneRead,
    ScriptVersionCreate,
    ScriptVersionRead,
    ShotContractCreate,
    ShotContractRead,
    ShotCreate,
    ShotRead,
    StoryBibleCreate,
    StoryBibleRead,
    StoryboardCreate,
    StoryboardRead,
    StoryCreate,
    StoryRead,
)
from apps.api.services import audit as audit_service
from apps.api.services.creation import (
    ensure_unique_episode_number,
    ensure_unique_shot_number,
    get_character,
    get_episode,
    get_prop,
    get_scene_asset,
    next_version_number,
    project_of_episode,
    project_of_script,
    project_of_script_version,
    project_of_shot,
    project_of_storyboard,
)
from apps.api.services.projects import assert_project_access, get_project

router = APIRouter(tags=["creation"])


def _project_access(
    db: Session, principal: Principal, project_id: UUID, need: str = "projects:read"
) -> None:
    assert_project_access(
        db,
        get_project(db, project_id),
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed=need,
    )


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


# --- episodes -----------------------------------------------------------------


@router.get("/projects/{project_id}/episodes")
def list_episodes(
    project_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_id)
    rows = db.scalars(
        select(Episode)
        .where(Episode.project_id == project_id)
        .order_by(Episode.episode_number)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return envelope(
        [EpisodeRead.model_validate(row).model_dump(mode="json") for row in rows],
        {"page": page, "page_size": page_size},
    )


@router.post("/projects/{project_id}/episodes", status_code=201)
def create_episode(
    project_id: UUID,
    payload: EpisodeCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_id, need="projects:write")
    ensure_unique_episode_number(db, project_id, payload.episode_number)
    episode = Episode(
        project_id=project_id,
        episode_number=payload.episode_number,
        title=payload.title,
        synopsis=payload.synopsis,
    )
    db.add(episode)
    db.flush()
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="episode.created",
        resource_type="episode",
        resource_id=str(episode.id),
        request_id=_request_id(request),
        details={"episode_number": episode.episode_number},
    )
    db.commit()
    return envelope(EpisodeRead.model_validate(episode).model_dump(mode="json"))


@router.get("/episodes/{episode_id}")
def read_episode(
    episode_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    episode = get_episode(db, episode_id)
    _project_access(db, principal, episode.project_id)
    return envelope(EpisodeRead.model_validate(episode).model_dump(mode="json"))


# --- stories and story bible --------------------------------------------------


@router.get("/projects/{project_id}/stories")
def list_stories(
    project_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_id)
    rows = db.scalars(
        select(Story).where(Story.project_id == project_id).order_by(Story.created_at)
    ).all()
    return envelope([StoryRead.model_validate(row).model_dump(mode="json") for row in rows])


@router.post("/projects/{project_id}/stories", status_code=201)
def create_story(
    project_id: UUID,
    payload: StoryCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_id, need="projects:write")
    story = Story(
        project_id=project_id,
        title=payload.title,
        logline=payload.logline,
        synopsis=payload.synopsis,
    )
    db.add(story)
    db.flush()
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="story.created",
        resource_type="story",
        resource_id=str(story.id),
        request_id=_request_id(request),
    )
    db.commit()
    return envelope(StoryRead.model_validate(story).model_dump(mode="json"))


@router.get("/projects/{project_id}/story-bibles")
def list_story_bibles(
    project_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_id)
    rows = db.scalars(
        select(StoryBible)
        .where(StoryBible.project_id == project_id)
        .order_by(StoryBible.version_number.desc())
    ).all()
    return envelope([StoryBibleRead.model_validate(row).model_dump(mode="json") for row in rows])


@router.post("/projects/{project_id}/story-bibles", status_code=201)
def create_story_bible(
    project_id: UUID,
    payload: StoryBibleCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_id, need="projects:write")
    bible = StoryBible(
        project_id=project_id,
        version_number=next_version_number(db, StoryBible, StoryBible.project_id, project_id),
        content=payload.content,
        created_by=principal.user.id,
    )
    db.add(bible)
    db.flush()
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="story_bible.version_created",
        resource_type="story_bible",
        resource_id=str(bible.id),
        request_id=_request_id(request),
        details={"version_number": bible.version_number},
    )
    db.commit()
    return envelope(StoryBibleRead.model_validate(bible).model_dump(mode="json"))


# --- scripts ------------------------------------------------------------------


@router.post("/episodes/{episode_id}/scripts", status_code=201)
def create_script(
    episode_id: UUID,
    payload: ScriptCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    project_id = project_of_episode(db, episode_id)
    _project_access(db, principal, project_id, need="projects:write")
    script = Script(episode_id=episode_id, title=payload.title)
    db.add(script)
    db.flush()
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="script.created",
        resource_type="script",
        resource_id=str(script.id),
        request_id=_request_id(request),
    )
    db.commit()
    return envelope(ScriptRead.model_validate(script).model_dump(mode="json"))


@router.get("/scripts/{script_id}/versions")
def list_script_versions(
    script_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_of_script(db, script_id))
    rows = db.scalars(
        select(ScriptVersion)
        .where(ScriptVersion.script_id == script_id)
        .order_by(ScriptVersion.version_number)
    ).all()
    return envelope([ScriptVersionRead.model_validate(row).model_dump(mode="json") for row in rows])


@router.post("/scripts/{script_id}/versions", status_code=201)
def create_script_version(
    script_id: UUID,
    payload: ScriptVersionCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_of_script(db, script_id), need="projects:write")
    version = ScriptVersion(
        script_id=script_id,
        version_number=next_version_number(db, ScriptVersion, ScriptVersion.script_id, script_id),
        content=payload.content,
        created_by=principal.user.id,
    )
    db.add(version)
    db.flush()
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="script.version_created",
        resource_type="script_version",
        resource_id=str(version.id),
        request_id=_request_id(request),
        details={"script_id": str(script_id), "version_number": version.version_number},
    )
    db.commit()
    return envelope(ScriptVersionRead.model_validate(version).model_dump(mode="json"))


@router.get("/script-versions/{version_id}/scenes")
def list_script_scenes(
    version_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_of_script_version(db, version_id))
    rows = db.scalars(
        select(ScriptScene)
        .where(ScriptScene.script_version_id == version_id)
        .order_by(ScriptScene.scene_number)
    ).all()
    return envelope([ScriptSceneRead.model_validate(row).model_dump(mode="json") for row in rows])


@router.post("/script-versions/{version_id}/scenes", status_code=201)
def create_script_scene(
    version_id: UUID,
    payload: ScriptSceneCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_of_script_version(db, version_id), need="projects:write")
    if db.scalar(
        select(ScriptScene.id).where(
            ScriptScene.script_version_id == version_id,
            ScriptScene.scene_number == payload.scene_number,
        )
    ):
        raise conflict(
            "Scene number already exists in this script version",
            {"scene_number": payload.scene_number},
        )
    scene = ScriptScene(script_version_id=version_id, **payload.model_dump())
    db.add(scene)
    db.flush()
    db.commit()
    return envelope(ScriptSceneRead.model_validate(scene).model_dump(mode="json"))


@router.post("/script-scenes/{scene_id}/dialogues", status_code=201)
def create_dialogue(
    scene_id: UUID,
    payload: ScriptDialogueCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    from apps.api.services.creation import get_script_scene, project_of_script_scene

    _project_access(db, principal, project_of_script_scene(db, scene_id), need="projects:write")
    get_script_scene(db, scene_id)
    if db.scalar(
        select(ScriptDialogue.id).where(
            ScriptDialogue.script_scene_id == scene_id,
            ScriptDialogue.order_number == payload.order_number,
        )
    ):
        raise conflict(
            "Dialogue order already exists in this scene",
            {"order_number": payload.order_number},
        )
    dialogue = ScriptDialogue(script_scene_id=scene_id, **payload.model_dump())
    db.add(dialogue)
    db.flush()
    db.commit()
    return envelope(ScriptDialogueRead.model_validate(dialogue).model_dump(mode="json"))


# --- production assets: characters, scenes, props -----------------------------


def _list_assets(db: Session, model: type, project_id: UUID) -> list:
    return list(
        db.scalars(select(model).where(model.project_id == project_id).order_by(model.name)).all()
    )


@router.get("/projects/{project_id}/characters")
def list_characters(
    project_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_id)
    return envelope(
        [
            AssetRead.model_validate(row).model_dump(mode="json")
            for row in _list_assets(db, Character, project_id)
        ]
    )


@router.post("/projects/{project_id}/characters", status_code=201)
def create_character(
    project_id: UUID,
    payload: AssetCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    return _create_asset(db, principal, project_id, payload, Character, "character", request)


@router.post("/characters/{character_id}/versions", status_code=201)
def create_character_version(
    character_id: UUID,
    payload: AssetVersionCreate,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    character = get_character(db, character_id)
    _project_access(db, principal, character.project_id, need="projects:write")
    version = CharacterVersion(
        character_id=character_id,
        version_number=next_version_number(
            db, CharacterVersion, CharacterVersion.character_id, character_id
        ),
        **payload.model_dump(),
    )
    db.add(version)
    db.flush()
    db.commit()
    return envelope(AssetVersionRead.model_validate(version).model_dump(mode="json"))


@router.get("/characters/{character_id}")
def read_character(
    character_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    character = get_character(db, character_id)
    _project_access(db, principal, character.project_id)
    versions = db.scalars(
        select(CharacterVersion)
        .where(CharacterVersion.character_id == character_id)
        .order_by(CharacterVersion.version_number)
    ).all()
    return envelope(
        AssetDetailRead(
            **AssetRead.model_validate(character).model_dump(),
            versions=[AssetVersionRead.model_validate(v) for v in versions],
        ).model_dump(mode="json")
    )


@router.get("/projects/{project_id}/scenes")
def list_production_scenes(
    project_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_id)
    return envelope(
        [
            AssetRead.model_validate(row).model_dump(mode="json")
            for row in _list_assets(db, ProductionScene, project_id)
        ]
    )


@router.post("/projects/{project_id}/scenes", status_code=201)
def create_production_scene(
    project_id: UUID,
    payload: AssetCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    return _create_asset(db, principal, project_id, payload, ProductionScene, "scene", request)


@router.post("/scenes/{scene_id}/versions", status_code=201)
def create_scene_version(
    scene_id: UUID,
    payload: AssetVersionCreate,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    scene = get_scene_asset(db, scene_id)
    _project_access(db, principal, scene.project_id, need="projects:write")
    version = SceneVersion(
        scene_id=scene_id,
        version_number=next_version_number(db, SceneVersion, SceneVersion.scene_id, scene_id),
        **payload.model_dump(),
    )
    db.add(version)
    db.flush()
    db.commit()
    return envelope(AssetVersionRead.model_validate(version).model_dump(mode="json"))


@router.get("/projects/{project_id}/props")
def list_props(
    project_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_id)
    return envelope(
        [
            AssetRead.model_validate(row).model_dump(mode="json")
            for row in _list_assets(db, Prop, project_id)
        ]
    )


@router.post("/projects/{project_id}/props", status_code=201)
def create_prop(
    project_id: UUID,
    payload: AssetCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    return _create_asset(db, principal, project_id, payload, Prop, "prop", request)


@router.post("/props/{prop_id}/versions", status_code=201)
def create_prop_version(
    prop_id: UUID,
    payload: AssetVersionCreate,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    prop = get_prop(db, prop_id)
    _project_access(db, principal, prop.project_id, need="projects:write")
    version = PropVersion(
        prop_id=prop_id,
        version_number=next_version_number(db, PropVersion, PropVersion.prop_id, prop_id),
        **payload.model_dump(),
    )
    db.add(version)
    db.flush()
    db.commit()
    return envelope(AssetVersionRead.model_validate(version).model_dump(mode="json"))


def _create_asset(
    db: Session,
    principal: Principal,
    project_id: UUID,
    payload: AssetCreate,
    model: type,
    resource_name: str,
    request: Request,
) -> dict:
    _project_access(db, principal, project_id, need="projects:write")
    exists = db.scalar(
        select(model.id).where(model.project_id == project_id, model.name == payload.name)
    )
    if exists is not None:
        raise conflict("Asset name already exists in this project", {"name": payload.name})
    asset = model(project_id=project_id, name=payload.name, description=payload.description)
    db.add(asset)
    db.flush()
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action=f"{resource_name}.created",
        resource_type=resource_name,
        resource_id=str(asset.id),
        request_id=_request_id(request),
    )
    db.commit()
    return envelope(AssetRead.model_validate(asset).model_dump(mode="json"))


# --- storyboards, shots, shot contracts ---------------------------------------


@router.post("/episodes/{episode_id}/storyboards", status_code=201)
def create_storyboard(
    episode_id: UUID,
    payload: StoryboardCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_of_episode(db, episode_id), need="projects:write")
    if db.scalar(
        select(Storyboard.id).where(
            Storyboard.episode_id == episode_id,
            Storyboard.version_number == payload.version_number,
        )
    ):
        raise conflict(
            "Storyboard version already exists", {"version_number": payload.version_number}
        )
    storyboard = Storyboard(episode_id=episode_id, version_number=payload.version_number)
    db.add(storyboard)
    db.flush()
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="storyboard.created",
        resource_type="storyboard",
        resource_id=str(storyboard.id),
        request_id=_request_id(request),
        details={"version_number": storyboard.version_number},
    )
    db.commit()
    return envelope(StoryboardRead.model_validate(storyboard).model_dump(mode="json"))


@router.get("/storyboards/{storyboard_id}/shots")
def list_shots(
    storyboard_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_of_storyboard(db, storyboard_id))
    rows = db.scalars(
        select(Shot).where(Shot.storyboard_id == storyboard_id).order_by(Shot.shot_number)
    ).all()
    return envelope([ShotRead.model_validate(row).model_dump(mode="json") for row in rows])


@router.post("/storyboards/{storyboard_id}/shots", status_code=201)
def create_shot(
    storyboard_id: UUID,
    payload: ShotCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_of_storyboard(db, storyboard_id), need="projects:write")
    if payload.scene_id is not None:
        get_scene_asset(db, payload.scene_id)
    ensure_unique_shot_number(db, storyboard_id, payload.shot_number)
    shot = Shot(storyboard_id=storyboard_id, **payload.model_dump())
    db.add(shot)
    db.flush()
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="shot.created",
        resource_type="shot",
        resource_id=str(shot.id),
        request_id=_request_id(request),
        details={"shot_number": shot.shot_number},
    )
    db.commit()
    return envelope(ShotRead.model_validate(shot).model_dump(mode="json"))


@router.get("/shots/{shot_id}/contracts")
def list_shot_contracts(
    shot_id: UUID,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_of_shot(db, shot_id))
    rows = db.scalars(
        select(ShotContract)
        .where(ShotContract.shot_id == shot_id)
        .order_by(ShotContract.version_number)
    ).all()
    return envelope([ShotContractRead.model_validate(row).model_dump(mode="json") for row in rows])


@router.post("/shots/{shot_id}/contracts", status_code=201)
def create_shot_contract(
    shot_id: UUID,
    payload: ShotContractCreate,
    request: Request,
    principal: Principal = Depends(require_permission("projects:read")),
    db: Session = Depends(get_db),
) -> dict:
    _project_access(db, principal, project_of_shot(db, shot_id), need="projects:write")
    contract = ShotContract(
        shot_id=shot_id,
        version_number=next_version_number(db, ShotContract, ShotContract.shot_id, shot_id),
        payload=payload.payload,
        created_by=principal.user.id,
    )
    db.add(contract)
    db.flush()
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="shot.contract_created",
        resource_type="shot_contract",
        resource_id=str(contract.id),
        request_id=_request_id(request),
        details={"shot_id": str(shot_id), "version_number": contract.version_number},
    )
    db.commit()
    return envelope(ShotContractRead.model_validate(contract).model_dump(mode="json"))
