from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="Application liveness")
async def health() -> dict[str, str]:
    return {"status": "ok"}
