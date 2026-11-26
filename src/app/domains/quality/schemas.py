from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CHECK_STATUS = Literal["PASS", "REVIEW_REQUIRED", "FAIL"]


class QualityCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rule_code: str = Field(min_length=2, max_length=60)
    status: CHECK_STATUS = "PASS"
    location: str = Field(default="", max_length=200)
    action: str = Field(default="", max_length=500)
    note: str = Field(default="", max_length=1000)


class QualityRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level: Literal["资产级", "镜头级", "单集级", "整剧级"]
    version: str = Field(default="v1", max_length=40)
    object: str | None = Field(default=None, max_length=200)
    checks: list[QualityCheck] = Field(default_factory=list)
    note: str = Field(default="", max_length=1000)
