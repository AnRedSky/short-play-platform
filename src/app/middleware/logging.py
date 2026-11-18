"""Structured access logging middleware (pure ASGI)."""

import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config.logging import get_logger

logger = get_logger("app.access")


class StructuredLoggingMiddleware:
    """Log one line per request: method, path, status and duration."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started = time.perf_counter()
        status_code = 500

        async def send_with_logging(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
            await send(message)

        try:
            await self.app(scope, receive, send_with_logging)
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            request_id = (scope.get("state") or {}).get("request_id", "-")
            logger.info(
                "request method=%s path=%s status=%s duration_ms=%s request_id=%s",
                scope.get("method"),
                scope.get("path"),
                status_code,
                duration_ms,
                request_id,
            )
