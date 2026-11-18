"""Pagination dependency producing ``PaginationParams``.

Pairs with ``public.schemas.PageResponse[T]`` and ``public.schemas.PageMeta``.
"""

from dataclasses import dataclass

from fastapi import Query

from app.public.constants import DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE


@dataclass(frozen=True, slots=True)
class PaginationParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size

    def meta(self, total: int) -> dict[str, int]:
        return {"page": self.page, "page_size": self.page_size, "total": total}


def get_pagination(
    page: int = Query(default=DEFAULT_PAGE, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
) -> PaginationParams:
    return PaginationParams(page=page, page_size=page_size)
