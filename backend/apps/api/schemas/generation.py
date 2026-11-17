from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GenerationTaskCreate(BaseModel):
    capability: str = Field(min_length=3, max_length=40)
    prompt: str = Field(min_length=1, max_length=8000)
    parameters: dict = Field(default_factory=dict)
    model_code: str = Field(default="mock-default", max_length=80)
    provider_code: str = Field(default="mock", max_length=60)
    shot_id: UUID | None = None


class TaskAttemptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    attempt_number: int
    status: str
    provider_task_id: str | None
    error_code: str | None
    duration_ms: int | None


class GenerationTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    capability: str
    provider_code: str
    model_code: str
    status: str
    idempotency_key: str
    result_payload: dict
    error_code: str | None
    error_message: str | None


class GenerationTaskDetailRead(GenerationTaskRead):
    attempts: list[TaskAttemptRead] = Field(default_factory=list)


class ProviderHealthRead(BaseModel):
    code: str
    healthy: bool
