"""B-08 request schemas."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TimelineCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    episode_number: int = Field(ge=1, le=200)
    tracks: list[dict] = Field(min_length=1, max_length=60)
    timebase: int = Field(default=25, ge=1, le=120)
    duration_ms: int = Field(ge=1)
    note: str = Field(default="", max_length=2000)

    @field_validator("tracks")
    @classmethod
    def _non_empty_tracks(cls, value: list[dict]) -> list[dict]:
        if not value:
            raise ValueError("at least one track is required")
        return value


class EpisodeOutputCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timeline_version_id: UUID
    asset_id: UUID
    note: str = Field(default="", max_length=2000)


class FinalReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    result: Literal["通过", "退回"]
    note: str = Field(min_length=1, max_length=2000)


class DeliveryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    receiver: str = Field(default="企业内容库", min_length=1, max_length=120)
    note: str = Field(default="", max_length=2000)
