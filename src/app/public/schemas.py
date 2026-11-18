"""Public response contract: envelope, pagination and error payloads."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


def envelope(data: Any, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    """Wrap a payload in the documented ``{data, meta}`` envelope."""
    payload: dict[str, Any] = {"data": data}
    if meta is not None:
        payload["meta"] = meta
    return payload


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int


class PageResponse[T](BaseModel):
    """Typed pagination contract used with ``dependencies.pagination.PaginationParams``."""

    data: list[T]
    meta: PageMeta


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    request_id: str


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error: ErrorDetail
