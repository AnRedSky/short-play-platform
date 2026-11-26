from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.domains.projects.constants import PROJECT_ROLES
from app.domains.projects.state_machine import PROJECT_STATUSES


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=2, max_length=60, pattern=r"^[A-Za-z0-9][A-Za-z0-9_\-]*$")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str = Field(default="", max_length=2000)
    genre: str = Field(default="", max_length=120)
    audience: str = Field(default="", max_length=200)
    episodes: int = Field(default=1, ge=1, le=200)
    duration: str = Field(default="", max_length=80)
    ratio: str = Field(default="", max_length=80)
    language: str = Field(default="", max_length=80)
    style: str = Field(default="", max_length=300)
    constraints: str = Field(default="", max_length=2000)
    budget: float = Field(default=0, ge=0)

    @model_validator(mode="after")
    def _one_title(self):
        if not self.title and not self.name:
            raise ValueError("title or name is required")
        if self.title and self.name and self.title != self.name:
            raise ValueError("title and name must agree when both are supplied")
        return self

    @property
    def resolved_title(self) -> str:
        return self.title or self.name or ""


class ProjectUpdate(BaseModel):
    """PATCH edits brief fields; status changes go through transitions."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = Field(default=None, max_length=2000)
    genre: str | None = Field(default=None, max_length=120)
    audience: str | None = Field(default=None, max_length=200)
    episodes: int | None = Field(default=None, ge=1, le=200)
    duration: str | None = Field(default=None, max_length=80)
    ratio: str | None = Field(default=None, max_length=80)
    language: str | None = Field(default=None, max_length=80)
    style: str | None = Field(default=None, max_length=300)
    constraints: str | None = Field(default=None, max_length=2000)
    budget: float | None = Field(default=None, ge=0)

    @model_validator(mode="before")
    @classmethod
    def _reject_status(cls, data):
        if isinstance(data, dict) and "status" in data:
            raise ValueError("status cannot be patched; use POST /projects/{id}/transitions")
        return data

    @model_validator(mode="after")
    def _one_title(self):
        if self.title and self.name and self.title != self.name:
            raise ValueError("title and name must agree when both are supplied")
        return self

    def changes(self) -> dict:
        data = self.model_dump(exclude_none=True)
        if "name" in data:
            data["title"] = data.pop("name")
        return data


class ProjectRead(BaseModel):
    """Page-aligned project DTO: business id plus every brief field the UI reads."""

    record_id: UUID
    id: str
    name: str
    summary: str
    genre: str
    audience: str
    episodes: int
    duration: str
    ratio: str
    language: str
    style: str
    constraints: str
    budget: float
    actual: float
    estimated: float
    status: str
    phase: str
    done: int
    delivered: int
    quality: str
    ownerId: str
    owner: str
    deptId: str = ""
    dept: str = ""
    budgetState: str
    created: str
    updated: str
    scriptVersion: str
    timelineVersion: str


class TransitionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: str = Field(min_length=1, max_length=80)
    reason: str = Field(default="", max_length=2000)
    expected_state: str | None = None

    @field_validator("expected_state")
    @classmethod
    def _known_state(cls, value: str | None) -> str | None:
        if value is not None and value not in PROJECT_STATUSES:
            raise ValueError(f"expected_state must be one of {PROJECT_STATUSES}")
        return value


class TransitionResult(BaseModel):
    project: ProjectRead
    allowed_actions: list[dict]
    message: str


class ProjectMemberAdd(BaseModel):
    user_id: UUID
    project_role: str = Field(default="writer")

    @field_validator("project_role")
    @classmethod
    def _known_role(cls, value: str) -> str:
        if value not in PROJECT_ROLES:
            raise ValueError(f"project_role must be one of {PROJECT_ROLES}")
        return value


class ProjectMemberUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_role: str

    @field_validator("project_role")
    @classmethod
    def _known_role(cls, value: str) -> str:
        if value not in PROJECT_ROLES:
            raise ValueError(f"project_role must be one of {PROJECT_ROLES}")
        return value


class ProjectMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    user_id: UUID
    project_role: str
    is_active: bool
    granted_by: UUID | None = None
    granted_at: datetime | None = None
    revoked_by: UUID | None = None
    revoked_at: datetime | None = None
