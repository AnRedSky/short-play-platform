"""Root route aggregation: versioned API plus the unversioned landing endpoint."""

from fastapi import APIRouter

from app.config.settings import get_settings
from app.router.v1.routes import router as v1_router

router = APIRouter()
router.include_router(v1_router, prefix=get_settings().api_v1_prefix)


@router.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    settings = get_settings()
    return {"name": settings.app_name, "status": "ok"}
