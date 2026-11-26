from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class GenerationTaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    capability: str = Field(min_length=3, max_length=40)
    prompt: str = Field(min_length=1, max_length=8000)
    parameters: dict = Field(default_factory=dict)
    model_code: str = Field(default="mock-default", max_length=80)
    provider_code: str = Field(default="mock", max_length=60)
    shot_id: UUID | None = None
    max_attempts: int = Field(default=3, ge=1, le=10)


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
    max_attempts: int
    attempt_count: int
    next_run_at: datetime | None
    lease_expires_at: datetime | None
    paused_at: datetime | None
    finished_at: datetime | None


class GenerationTaskDetailRead(GenerationTaskRead):
    attempts: list[TaskAttemptRead] = Field(default_factory=list)


class ProviderCallbackError(BaseModel):
    code: str = Field(default="PROVIDER_UNAVAILABLE", max_length=60)
    message: str = Field(default="Provider call failed", max_length=2000)
    retryable: bool = False


class ProviderCallback(BaseModel):
    """One provider event; ``callback_id`` is the idempotency key."""

    model_config = ConfigDict(extra="forbid")

    callback_id: str = Field(min_length=1, max_length=120)
    task_id: UUID
    event: Literal["accepted", "completed"] = "completed"
    provider_task_id: str | None = Field(default=None, max_length=120)
    attempt_number: int | None = Field(default=None, ge=1)
    status: Literal["succeeded", "failed"] | None = None
    output: dict = Field(default_factory=dict)
    error: ProviderCallbackError | None = None
    usage: dict = Field(default_factory=dict)
    occurred_at: datetime | None = None

    @model_validator(mode="after")
    def _completion_has_status(self):
        if self.event == "completed" and self.status is None:
            raise ValueError("completed callback requires status")
        return self


class QueueDispatchResult(BaseModel):
    claimed: int
    tasks: list[GenerationTaskRead] = Field(default_factory=list)


class QueueRecoveryResult(BaseModel):
    recovered: int
    tasks: list[GenerationTaskRead] = Field(default_factory=list)


class ProviderCallbackResult(BaseModel):
    task: GenerationTaskRead
    applied: bool
    duplicate: bool


class ProviderHealthRead(BaseModel):
    code: str
    healthy: bool
