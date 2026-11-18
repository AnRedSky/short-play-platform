"""Public contract: domain error payloads."""

import pytest

from app.public.constants import ErrorCode
from app.public.exceptions import (
    AppError,
    ConflictError,
    NotFoundError,
    ValidationError,
    conflict,
    not_found,
    validation_error,
)


def test_app_error_payload_keeps_the_documented_shape():
    payload = AppError("boom").to_payload("req-1")
    assert payload == {
        "error": {
            "code": str(ErrorCode.INTERNAL_ERROR),
            "message": "boom",
            "details": {},
            "request_id": "req-1",
        }
    }


@pytest.mark.parametrize(
    ("factory", "expected_status", "expected_code"),
    [
        (validation_error, 422, ErrorCode.VALIDATION_ERROR),
        (not_found, 404, ErrorCode.RESOURCE_NOT_FOUND),
        (conflict, 409, ErrorCode.CONFLICT),
    ],
)
def test_error_factories(factory, expected_status, expected_code):
    error = factory("nope")
    assert isinstance(error, AppError)
    assert error.status_code == expected_status
    assert str(error.code) == str(expected_code)
    assert error.message == "nope"


def test_error_subclasses():
    assert NotFoundError.status_code == 404
    assert ConflictError.status_code == 409
    assert ValidationError.status_code == 422
