"""Health response contracts."""

from pydantic import BaseModel


class HealthRead(BaseModel):
    status: str


class ReadinessRead(BaseModel):
    status: str
    components: dict[str, str]
