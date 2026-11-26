from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.domains.projects.constants import PROJECT_ROLES
from app.domains.projects.state_machine import PROJECT_STATUSES, normalize_status


class ProjectCreate(BaseModel):
    code: str = Field(min_length=2, max_length=60, pattern=r"^[A-Za-z0-9][A-Za-z0-9_\-]*$")
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(default="", max_length=2000)


class ProjectUpdate(BaseModel):
    """PATCH only edits descriptive fields; status changes go through transitions."""

    model_config = ConfigDict(extra="ignore")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="before")
    @classmethod
    def _reject_status(cls, data):
        if isinstance(data, dict) and "status" in data:
            raise ValueError("status cannot be patched; use POST /projects/{id}/transitions")
        return data


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    code: str
    title: str
    summary: str
    status: str

    @field_validator("status")
    @classmethod
    def _canonical_status(cls, value: str) -> str:
        return normalize_status(value)


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


class ProjectMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    user_id: UUID
    project_role: str
    is_active: bool
