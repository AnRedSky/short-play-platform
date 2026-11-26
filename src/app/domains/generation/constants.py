"""Generation domain constants and queue policy."""

TASK_STATUSES = (
    "pending",
    "queued",
    "running",
    "retry_wait",
    "paused",
    "succeeded",
    "failed",
    "cancel_requested",
    "cancelled",
)
TERMINAL_TASK_STATUSES = ("succeeded", "failed", "cancelled")
CLAIMABLE_TASK_STATUSES = ("queued", "retry_wait")
PAUSABLE_TASK_STATUSES = ("queued", "retry_wait")
ACTIVE_TASK_STATUSES = (
    "queued",
    "running",
    "retry_wait",
    "paused",
    "cancel_requested",
)

DEFAULT_PROVIDER_CODE = "mock"
DEFAULT_MODEL_CODE = "mock-default"
DEFAULT_MAX_ATTEMPTS = 3
MAX_MAX_ATTEMPTS = 10
DEFAULT_LEASE_SECONDS = 300
RETRY_BACKOFF_SECONDS = (30, 120, 480)


def retry_delay(attempt_count: int) -> int:
    """30s / 120s / 480s exponential backoff, capped at the last value."""
    index = max(1, attempt_count) - 1
    return RETRY_BACKOFF_SECONDS[min(index, len(RETRY_BACKOFF_SECONDS) - 1)]
