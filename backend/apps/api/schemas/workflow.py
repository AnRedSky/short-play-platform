from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkflowRunCreate(BaseModel):
    workflow_code: str = Field(default="episode-production", max_length=80)
    context: dict = Field(default_factory=dict)


class WorkflowNodeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    node_key: str
    node_type: str
    status: str
    depends_on: list = Field(default_factory=list)
    attempt_count: int
    max_attempts: int
    output: dict = Field(default_factory=dict)
    error_code: str | None = None
    error_message: str | None = None
    finished_at: datetime | None = None


class WorkflowRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    status: str
    idempotency_key: str
    error_code: str | None = None
    error_message: str | None = None
    finished_at: datetime | None = None


class WorkflowRunDetailRead(WorkflowRunRead):
    nodes: list[WorkflowNodeRead] = Field(default_factory=list)


class WorkflowDefinitionRead(BaseModel):
    workflow_id: UUID
    version_id: UUID
    code: str
    version_number: int
    checksum: str
    nodes: list[dict] = Field(default_factory=list)
