import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from apps.api.config import get_settings
from apps.api.errors import register_exception_handlers
from apps.api.logging import configure_logging
from apps.api.routes import (
    audit,
    auth,
    creation,
    generation,
    health,
    organizations,
    projects,
    roles,
    users,
    workflow,
)

settings = get_settings()
configure_logging(settings.log_level)


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response


app = FastAPI(title=settings.app_name, debug=settings.debug)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_exception_handlers(app)

for module_router in (
    health.router,
    auth.router,
    users.router,
    roles.router,
    organizations.router,
    projects.router,
    creation.router,
    generation.router,
    workflow.router,
    audit.router,
):
    app.include_router(module_router, prefix=settings.api_v1_prefix)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"name": settings.app_name, "status": "ok"}
