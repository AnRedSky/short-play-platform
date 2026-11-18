"""Middleware registration entry point.

Order matters: the last middleware added is the outermost one. Logging wraps
everything, CORS stays outside the request-scoped state, and request id
generation happens before routing.
"""

from fastapi import FastAPI

from app.middleware.cors import register_cors
from app.middleware.logging import StructuredLoggingMiddleware
from app.middleware.request_id import RequestIdMiddleware


def register_middlewares(app: FastAPI) -> None:
    app.add_middleware(RequestIdMiddleware)
    register_cors(app)
    app.add_middleware(StructuredLoggingMiddleware)
