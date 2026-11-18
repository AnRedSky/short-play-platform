"""Organization request/response contracts."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    parent_id: UUID | None = None


class DepartmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    name: str
    parent_id: UUID | None


class MemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    user_id: UUID
    department_id: UUID | None
    is_active: bool
