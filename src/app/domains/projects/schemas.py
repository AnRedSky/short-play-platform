from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domains.projects.constants import PROJECT_ROLES, PROJECT_STATUSES


class ProjectCreate(BaseModel):
    code: str = Field(min_length=2, max_length=60, pattern=r"^[A-Za-z0-9][A-Za-z0-9_\-]*$")
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(default="", max_length=2000)


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = Field(default=None, max_length=2000)
    status: str | None = None

    @field_validator("status")
    @classmethod
    def _known_status(cls, value: str | None) -> str | None:
        if value is not None and value not in PROJECT_STATUSES:
            raise ValueError(f"status must be one of {PROJECT_STATUSES}")
        return value


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    code: str
    title: str
    summary: str
    status: str


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
