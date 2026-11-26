"""Operations request schema."""

from typing import Literal

from pydantic import BaseModel, ConfigDict


class BackupTrigger(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target: Literal["database", "media", "config"] = "database"
