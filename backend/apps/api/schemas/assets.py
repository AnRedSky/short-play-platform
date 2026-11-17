from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    kind: str
    title: str
    storage_key: str
    mime_type: str
    size_bytes: int
    checksum: str
    width: int | None = None
    height: int | None = None
    duration_ms: int | None = None
    status: str
    source: str


class AssetVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    version_number: int
    checksum: str
    size_bytes: int
    mime_type: str
    note: str | None = None


class AssetDetailRead(AssetRead):
    versions: list[AssetVersionRead] = Field(default_factory=list)


class ExportRequest(BaseModel):
    asset_ids: list[UUID]
    width: int = Field(default=1080, ge=64, le=4096)
    height: int = Field(default=1920, ge=64, le=4096)
    fps: int = Field(default=25, ge=1, le=60)
    seconds_per_image: float = Field(default=2.0, gt=0, le=30)
    title: str = Field(default="Episode export", max_length=200)


class ExportJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    status: str
    asset_id: UUID | None = None
    output_key: str | None = None
    error_code: str | None = None
    error_message: str | None = None
