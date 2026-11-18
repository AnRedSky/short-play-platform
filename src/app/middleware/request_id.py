"""Request ID middleware: generate or propagate ``x-request-id``."""

from uuid import uuid4

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.public.constants import REQUEST_ID_HEADER


class RequestIdMiddleware:
    """Pure ASGI middleware so exception handling is not disturbed."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        incoming = headers.get(REQUEST_ID_HEADER.encode("latin-1"))
        request_id = incoming.decode("latin-1") if incoming else str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message).append(REQUEST_ID_HEADER, request_id)
            await send(message)

        await self.app(scope, receive, send_with_request_id)
