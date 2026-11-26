from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.domains.assets.constants import DEFAULT_MIME_TYPE


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
    qc_status: str = "pending"
    qc_note: str = ""
    qc_at: datetime | None = None
    authorization_status: str = "pending"
    authorization_scope: str = ""
    authorization_note: str = ""
    authorized_at: datetime | None = None
    formal_version_id: UUID | None = None
    reference_count: int = 0


class AssetVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    version_number: int
    status: str = "draft"
    checksum: str
    size_bytes: int
    mime_type: str
    note: str | None = None


class AssetReferenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    ref_type: str
    ref_id: UUID
    note: str | None = None


class AssetQCCheckRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    asset_version_id: UUID
    result: str
    note: str
    checksum: str
    actor_user_id: UUID | None = None
    created_at: datetime


class AssetDetailRead(AssetRead):
    versions: list[AssetVersionRead] = Field(default_factory=list)
    references: list[AssetReferenceRead] = Field(default_factory=list)
    quality_checks: list[AssetQCCheckRead] = Field(default_factory=list)


class DirectUploadCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str = Field(min_length=1, max_length=200)
    mime_type: str = Field(default=DEFAULT_MIME_TYPE, max_length=120)
    title: str = Field(default="", max_length=200)
    max_bytes: int = Field(default=0, ge=0)


class DirectUploadRead(BaseModel):
    upload_id: UUID
    upload_url: str
    storage_key: str
    filename: str
    mime_type: str
    expires_at: datetime
    max_bytes: int
    status: str


class DirectUploadComplete(BaseModel):
    model_config = ConfigDict(extra="forbid")

    checksum: str | None = Field(default=None, min_length=64, max_length=64)
    title: str | None = Field(default=None, max_length=200)


class AssetQCRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    result: Literal["通过", "拒绝"]
    note: str = Field(default="", max_length=2000)


class AuthorizationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["pending", "cleared", "restricted"]
    scope: str = Field(default="", max_length=200)
    note: str = Field(default="", max_length=2000)


class AssetReferenceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ref_type: str = Field(min_length=1, max_length=40)
    ref_id: UUID
    note: str = Field(default="", max_length=2000)


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
