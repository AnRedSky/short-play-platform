from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EpisodeCreate(BaseModel):
    episode_number: int = Field(ge=1, le=999)
    title: str = Field(min_length=1, max_length=200)
    synopsis: str = Field(default="", max_length=5000)


class EpisodeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    episode_number: int
    title: str
    synopsis: str
    status: str


class StoryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    logline: str = Field(default="", max_length=500)
    synopsis: str = Field(default="", max_length=5000)


class StoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    title: str
    logline: str
    synopsis: str
    status: str


class StoryBibleCreate(BaseModel):
    content: dict = Field(default_factory=dict)


class StoryBibleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    version_number: int
    content: dict
    status: str


class ScriptCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class ScriptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    episode_id: UUID
    title: str
    status: str


class ScriptVersionCreate(BaseModel):
    content: str = Field(default="", max_length=200_000)


class ScriptVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    script_id: UUID
    version_number: int
    content: str
    status: str


class ScriptSceneCreate(BaseModel):
    scene_number: int = Field(ge=1, le=999)
    location: str = Field(default="", max_length=200)
    time_of_day: str = Field(default="", max_length=60)
    summary: str = Field(default="", max_length=5000)


class ScriptSceneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    script_version_id: UUID
    scene_number: int
    location: str
    time_of_day: str
    summary: str


class ScriptDialogueCreate(BaseModel):
    order_number: int = Field(ge=1, le=9999)
    character_name: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=5000)


class ScriptDialogueRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    script_scene_id: UUID
    order_number: int
    character_name: str
    content: str


class AssetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=5000)


class AssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    name: str
    description: str


class AssetVersionCreate(BaseModel):
    appearance: str = Field(default="", max_length=5000)
    prompt: str = Field(default="", max_length=5000)
    reference_storage_key: str | None = Field(default=None, max_length=255)


class AssetVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    version_number: int
    appearance: str
    prompt: str
    reference_storage_key: str | None
    status: str


class AssetDetailRead(AssetRead):
    versions: list[AssetVersionRead] = Field(default_factory=list)


class StoryboardCreate(BaseModel):
    version_number: int = Field(default=1, ge=1, le=999)


class StoryboardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    episode_id: UUID
    version_number: int
    status: str


class ShotCreate(BaseModel):
    shot_number: int = Field(ge=1, le=999)
    scene_id: UUID | None = None
    shot_size: str = Field(default="medium", max_length=40)
    description: str = Field(default="", max_length=5000)


class ShotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    storyboard_id: UUID
    scene_id: UUID | None
    shot_number: int
    shot_size: str
    description: str
    status: str


class ShotContractCreate(BaseModel):
    payload: dict = Field(default_factory=dict)


class ShotContractRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shot_id: UUID
    version_number: int
    payload: dict
    status: str
