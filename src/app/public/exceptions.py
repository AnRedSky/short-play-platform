"""Exception contract shared by every domain.

Domains raise these errors from the service layer; the HTTP handlers that turn
them into JSON live in ``app.bootstrap.register`` so no domain imports FastAPI.
"""

from typing import Any

from app.public.constants import ErrorCode


class AppError(Exception):
    """Explicit business error carrying the documented API error contract."""

    status_code = 400
    code = ErrorCode.INTERNAL_ERROR

    def __init__(
        self,
        message: str = "",
        *,
        code: str | None = None,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message or str(self.code))
        self.message = message or str(self.code)
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.details = details or {}

    def to_payload(self, request_id: str) -> dict[str, Any]:
        return {
            "error": {
                "code": str(self.code),
                "message": self.message,
                "details": self.details,
                "request_id": request_id,
            }
        }


class ValidationError(AppError):
    status_code = 422
    code = ErrorCode.VALIDATION_ERROR


class AuthenticationError(AppError):
    status_code = 401
    code = ErrorCode.AUTHENTICATION_REQUIRED


class PermissionDeniedError(AppError):
    status_code = 403
    code = ErrorCode.PERMISSION_DENIED


class NotFoundError(AppError):
    status_code = 404
    code = ErrorCode.RESOURCE_NOT_FOUND


class ConflictError(AppError):
    status_code = 409
    code = ErrorCode.CONFLICT


class PayloadTooLargeError(AppError):
    status_code = 413
    code = ErrorCode.PAYLOAD_TOO_LARGE


def validation_error(
    message: str = "Request validation failed", details: dict[str, Any] | None = None
) -> ValidationError:
    return ValidationError(message, details=details)


def authentication_required(message: str = "Authentication required") -> AuthenticationError:
    return AuthenticationError(message)


def permission_denied(message: str = "Permission denied") -> PermissionDeniedError:
    return PermissionDeniedError(message)


def not_found(message: str = "Resource not found") -> NotFoundError:
    return NotFoundError(message)


def conflict(message: str, details: dict[str, Any] | None = None) -> ConflictError:
    return ConflictError(message, details=details)
