"""Application assembly: middleware, exception handlers and routes.

``register_all`` is the only place that wires cross-cutting concerns into the
FastAPI instance; ``main.create_app`` stays a shell around it.
"""

import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config.logging import get_logger
from app.middleware import register_middlewares
from app.public.constants import ErrorCode
from app.public.exceptions import AppError
from app.router.routes import router as root_router

logger = get_logger(__name__)

_HTTP_STATUS_CODES = {
    401: ErrorCode.AUTHENTICATION_REQUIRED,
    403: ErrorCode.PERMISSION_DENIED,
    404: ErrorCode.RESOURCE_NOT_FOUND,
}


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", None) or str(uuid.uuid4())


def _error_body(code: str, message: str, request_id: str, details: dict | None = None) -> dict:
    return {
        "error": {
            "code": str(code),
            "message": message,
            "details": details or {},
            "request_id": request_id,
        }
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code, content=exc.to_payload(_request_id(request))
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_error_body(
                ErrorCode.VALIDATION_ERROR,
                "Request validation failed",
                _request_id(request),
                {"errors": exc.errors()},
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(
                _HTTP_STATUS_CODES.get(exc.status_code, ErrorCode.INTERNAL_ERROR),
                str(exc.detail),
                _request_id(request),
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled request error: %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content=_error_body(
                ErrorCode.INTERNAL_ERROR, "Internal server error", _request_id(request)
            ),
        )


def register_all(app: FastAPI) -> None:
    register_middlewares(app)
    register_exception_handlers(app)
    app.include_router(root_router)
