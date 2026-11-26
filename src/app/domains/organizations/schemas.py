"""Organization request/response contracts."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str


class DepartmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    parent_id: UUID | None = None
    manager_user_id: UUID | None = None


class DepartmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    parent_id: UUID | None = None
    manager_user_id: UUID | None = None

    def changes(self) -> dict:
        fields = self.model_fields_set
        return {field: getattr(self, field) for field in fields}


class DepartmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    name: str
    parent_id: UUID | None
    manager_user_id: UUID | None = None
    is_active: bool = True


class MemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    user_id: UUID
    department_id: UUID | None
    department_name: str = ""
    is_active: bool
    user_email: str = ""
    user_name: str = ""
    deactivated_at: datetime | None = None


class MemberUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    department_id: UUID | None = None

    def changes(self) -> dict:
        if "department_id" not in self.model_fields_set:
            return {}
        return {"department_id": self.department_id}


class ProjectAuthorizationRead(BaseModel):
    project_id: UUID
    project_code: str
    project_title: str
    project_role: str
    is_active: bool
    granted_by: UUID | None = None
    granted_at: datetime | None = None
    revoked_by: UUID | None = None
    revoked_at: datetime | None = None


class MemberDetailRead(BaseModel):
    member: MemberRead
    user_email: str
    user_name: str
    user_active: bool
    department_name: str
    role_codes: list[str]
    project_authorizations: list[ProjectAuthorizationRead]


class OffboardingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    handover_to_user_id: UUID | None = None
    note: str = Field(default="", max_length=2000)


class OffboardingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    user_id: UUID
    handover_to_user_id: UUID | None
    status: str
    note: str
    project_count: int
    transferred_project_count: int
    project_authorizations_revoked: int
    roles_revoked: int
    permission_grants_revoked: int
    sessions_revoked: int
    completed_at: datetime
