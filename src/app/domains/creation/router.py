"""Creation HTTP contract: episodes, story, script, production assets, shots."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.domains.audit import service as audit_service
from app.domains.creation import service as creation_service
from app.domains.creation.schemas import (
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
    ScriptReviewCreate,
    ScriptReviewRead,
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
from app.domains.projects import service as projects_service
from app.public.schemas import envelope

router = APIRouter(tags=["creation"])


def _access(
    db: Session, principal: Principal, project_id: UUID, *, need: str = "project.read"
):
    return projects_service.get_accessible_project(
        db,
        project_id,
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
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id)
    rows = creation_service.list_episodes(
        db, project_id, offset=(page - 1) * page_size, limit=page_size
    )
    return envelope(
        [EpisodeRead.model_validate(row).model_dump(mode="json") for row in rows],
        {"page": page, "page_size": page_size},
    )


@router.post("/projects/{project_id}/episodes", status_code=201)
def create_episode(
    project_id: UUID,
    payload: EpisodeCreate,
    request: Request,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id, need="creation.write")
    episode = creation_service.create_episode(
        db,
        project_id=project_id,
        episode_number=payload.episode_number,
        title=payload.title,
        synopsis=payload.synopsis,
    )
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
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    episode = creation_service.get_episode_or_404(db, episode_id)
    _access(db, principal, episode.project_id)
    return envelope(EpisodeRead.model_validate(episode).model_dump(mode="json"))


# --- stories and story bible --------------------------------------------------


@router.get("/projects/{project_id}/stories")
def list_stories(
    project_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id)
    rows = creation_service.list_stories(db, project_id)
    return envelope([StoryRead.model_validate(row).model_dump(mode="json") for row in rows])


@router.post("/projects/{project_id}/stories", status_code=201)
def create_story(
    project_id: UUID,
    payload: StoryCreate,
    request: Request,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id, need="creation.write")
    story = creation_service.create_story(
        db,
        project_id=project_id,
        title=payload.title,
        logline=payload.logline,
        synopsis=payload.synopsis,
    )
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
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id)
    rows = creation_service.list_story_bibles(db, project_id)
    return envelope([StoryBibleRead.model_validate(row).model_dump(mode="json") for row in rows])


@router.post("/projects/{project_id}/story-bibles", status_code=201)
def create_story_bible(
    project_id: UUID,
    payload: StoryBibleCreate,
    request: Request,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id, need="creation.write")
    bible = creation_service.create_story_bible(
        db, project_id=project_id, content=payload.content, created_by=principal.user.id
    )
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
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    _access(
        db, principal, creation_service.project_of_episode(db, episode_id), need="creation.write"
    )
    script = creation_service.create_script(db, episode_id=episode_id, title=payload.title)
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
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, creation_service.project_of_script(db, script_id))
    rows = creation_service.list_script_versions(db, script_id)
    return envelope([ScriptVersionRead.model_validate(row).model_dump(mode="json") for row in rows])


@router.post("/scripts/{script_id}/versions", status_code=201)
def create_script_version(
    script_id: UUID,
    payload: ScriptVersionCreate,
    request: Request,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    _access(
        db, principal, creation_service.project_of_script(db, script_id), need="creation.write"
    )
    version = creation_service.create_script_version(
        db, script_id=script_id, content=payload.content, created_by=principal.user.id
    )
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


@router.get("/scripts/{script_id}/reviews")
def list_script_reviews(
    script_id: UUID,
    principal: Principal = Depends(require_permission("script.review")),
    db: Session = Depends(get_db),
) -> dict:
    _access(
        db,
        principal,
        creation_service.project_of_script(db, script_id),
        need="script.review",
    )
    rows = creation_service.list_script_reviews(db, script_id)
    return envelope([ScriptReviewRead.model_validate(row).model_dump(mode="json") for row in rows])


@router.post("/script-versions/{version_id}/reviews", status_code=201)
def review_script_version(
    version_id: UUID,
    payload: ScriptReviewCreate,
    request: Request,
    principal: Principal = Depends(require_permission("script.review")),
    db: Session = Depends(get_db),
) -> dict:
    project_id = creation_service.project_of_script_version(db, version_id)
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="script.review",
        for_update=True,
    )
    version = creation_service.get_script_version_or_404(db, version_id)
    try:
        review, transition = creation_service.review_script_version(
            db,
            version,
            project=project,
            decision=payload.decision,
            reason=payload.reason,
            actor_user_id=principal.user.id,
            permissions=principal.permissions,
            request_id=_request_id(request),
        )
        audit_service.record(
            db,
            actor_user_id=principal.user.id,
            action="script.reviewed",
            resource_type="script_review",
            resource_id=str(review.id),
            request_id=_request_id(request),
            details={
                "script_id": str(review.script_id),
                "script_version_id": str(version_id),
                "decision": review.decision,
                "project_id": str(project.id),
            },
        )
        # One commit for review row, script/version status, project transition and audit.
        db.commit()
    except Exception:
        db.rollback()
        raise
    return envelope(
        {
            "review": ScriptReviewRead.model_validate(review).model_dump(mode="json"),
            "transition": transition,
        }
    )


@router.get("/script-versions/{version_id}/scenes")
def list_script_scenes(
    version_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, creation_service.project_of_script_version(db, version_id))
    rows = creation_service.list_script_scenes(db, version_id)
    return envelope([ScriptSceneRead.model_validate(row).model_dump(mode="json") for row in rows])


@router.post("/script-versions/{version_id}/scenes", status_code=201)
def create_script_scene(
    version_id: UUID,
    payload: ScriptSceneCreate,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    _access(
        db,
        principal,
        creation_service.project_of_script_version(db, version_id),
        need="creation.write",
    )
    scene = creation_service.create_script_scene(
        db,
        version_id=version_id,
        scene_number=payload.scene_number,
        location=payload.location,
        time_of_day=payload.time_of_day,
        summary=payload.summary,
    )
    db.commit()
    return envelope(ScriptSceneRead.model_validate(scene).model_dump(mode="json"))


@router.post("/script-scenes/{scene_id}/dialogues", status_code=201)
def create_dialogue(
    scene_id: UUID,
    payload: ScriptDialogueCreate,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    _access(
        db,
        principal,
        creation_service.project_of_script_scene(db, scene_id),
        need="creation.write",
    )
    dialogue = creation_service.create_dialogue(
        db,
        scene_id=scene_id,
        order_number=payload.order_number,
        character_name=payload.character_name,
        content=payload.content,
    )
    db.commit()
    return envelope(ScriptDialogueRead.model_validate(dialogue).model_dump(mode="json"))


# --- production assets: characters, scenes, props -----------------------------


@router.get("/projects/{project_id}/characters")
def list_characters(
    project_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id)
    return envelope(
        [
            AssetRead.model_validate(row).model_dump(mode="json")
            for row in creation_service.list_project_assets(db, "character", project_id)
        ]
    )


@router.post("/projects/{project_id}/characters", status_code=201)
def create_character(
    project_id: UUID,
    payload: AssetCreate,
    request: Request,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    return _create_asset(db, principal, project_id, payload, "character", request)


@router.post("/characters/{character_id}/versions", status_code=201)
def create_character_version(
    character_id: UUID,
    payload: AssetVersionCreate,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    return _create_asset_version(db, principal, "character", character_id, payload)


@router.get("/characters/{character_id}")
def read_character(
    character_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    character = creation_service.get_character_or_404(db, character_id)
    _access(db, principal, character.project_id)
    versions = creation_service.list_asset_versions(db, "character", character.id)
    return envelope(
        AssetDetailRead(
            **AssetRead.model_validate(character).model_dump(),
            versions=[AssetVersionRead.model_validate(v) for v in versions],
        ).model_dump(mode="json")
    )


@router.get("/projects/{project_id}/scenes")
def list_production_scenes(
    project_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id)
    return envelope(
        [
            AssetRead.model_validate(row).model_dump(mode="json")
            for row in creation_service.list_project_assets(db, "scene", project_id)
        ]
    )


@router.post("/projects/{project_id}/scenes", status_code=201)
def create_production_scene(
    project_id: UUID,
    payload: AssetCreate,
    request: Request,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    return _create_asset(db, principal, project_id, payload, "scene", request)


@router.post("/scenes/{scene_id}/versions", status_code=201)
def create_scene_version(
    scene_id: UUID,
    payload: AssetVersionCreate,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    return _create_asset_version(db, principal, "scene", scene_id, payload)


@router.get("/projects/{project_id}/props")
def list_props(
    project_id: UUID,
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, project_id)
    return envelope(
        [
            AssetRead.model_validate(row).model_dump(mode="json")
            for row in creation_service.list_project_assets(db, "prop", project_id)
        ]
    )


@router.post("/projects/{project_id}/props", status_code=201)
def create_prop(
    project_id: UUID,
    payload: AssetCreate,
    request: Request,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    return _create_asset(db, principal, project_id, payload, "prop", request)


@router.post("/props/{prop_id}/versions", status_code=201)
def create_prop_version(
    prop_id: UUID,
    payload: AssetVersionCreate,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    return _create_asset_version(db, principal, "prop", prop_id, payload)


def _create_asset(
    db: Session,
    principal: Principal,
    project_id: UUID,
    payload: AssetCreate,
    kind: str,
    request: Request,
) -> dict:
    _access(db, principal, project_id, need="creation.write")
    asset = creation_service.create_production_asset(
        db, kind=kind, project_id=project_id, name=payload.name, description=payload.description
    )
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action=f"{kind}.created",
        resource_type=kind,
        resource_id=str(asset.id),
        request_id=_request_id(request),
    )
    db.commit()
    return envelope(AssetRead.model_validate(asset).model_dump(mode="json"))


def _create_asset_version(
    db: Session,
    principal: Principal,
    kind: str,
    asset_id: UUID,
    payload: AssetVersionCreate,
) -> dict:
    asset = creation_service.get_asset_or_404(db, kind, asset_id)
    _access(db, principal, asset.project_id, need="creation.write")
    version = creation_service.create_production_asset_version(
        db,
        kind=kind,
        asset_id=asset_id,
        appearance=payload.appearance,
        prompt=payload.prompt,
        reference_storage_key=payload.reference_storage_key,
    )
    db.commit()
    return envelope(AssetVersionRead.model_validate(version).model_dump(mode="json"))


# --- storyboards, shots, shot contracts ---------------------------------------


@router.post("/episodes/{episode_id}/storyboards", status_code=201)
def create_storyboard(
    episode_id: UUID,
    payload: StoryboardCreate,
    request: Request,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    _access(
        db, principal, creation_service.project_of_episode(db, episode_id), need="creation.write"
    )
    storyboard = creation_service.create_storyboard(
        db, episode_id=episode_id, version_number=payload.version_number
    )
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
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, creation_service.project_of_storyboard(db, storyboard_id))
    rows = creation_service.list_shots(db, storyboard_id)
    return envelope([ShotRead.model_validate(row).model_dump(mode="json") for row in rows])


@router.post("/storyboards/{storyboard_id}/shots", status_code=201)
def create_shot(
    storyboard_id: UUID,
    payload: ShotCreate,
    request: Request,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    _access(
        db,
        principal,
        creation_service.project_of_storyboard(db, storyboard_id),
        need="creation.write",
    )
    shot = creation_service.create_shot(
        db,
        storyboard_id=storyboard_id,
        shot_number=payload.shot_number,
        scene_id=payload.scene_id,
        shot_size=payload.shot_size,
        description=payload.description,
    )
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
    principal: Principal = Depends(require_permission("project.read")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, creation_service.project_of_shot(db, shot_id))
    rows = creation_service.list_shot_contracts(db, shot_id)
    return envelope([ShotContractRead.model_validate(row).model_dump(mode="json") for row in rows])


@router.post("/shots/{shot_id}/contracts", status_code=201)
def create_shot_contract(
    shot_id: UUID,
    payload: ShotContractCreate,
    request: Request,
    principal: Principal = Depends(require_permission("creation.write")),
    db: Session = Depends(get_db),
) -> dict:
    _access(db, principal, creation_service.project_of_shot(db, shot_id), need="creation.write")
    contract = creation_service.create_shot_contract(
        db, shot_id=shot_id, payload=payload.payload, created_by=principal.user.id
    )
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
