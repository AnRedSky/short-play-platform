"""Health HTTP contract."""

from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse

from app.domains.health import service as health_service
from app.domains.health.schemas import ReadinessRead

router = APIRouter(tags=["health"])


@router.get("/health", summary="Application liveness")
async def health() -> dict[str, str]:
    return {"status": health_service.liveness()}


@router.get("/health/ready", summary="Dependency readiness")
def readiness(response: Response):
    status, components, ready = health_service.readiness()
    payload = ReadinessRead(status=status, components=components).model_dump()
    if not ready:
        return JSONResponse(payload, status_code=503)
    return payload
