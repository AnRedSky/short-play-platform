"""Generation domain constants."""

TASK_STATUSES = (
    "pending",
    "queued",
    "running",
    "retry_wait",
    "succeeded",
    "failed",
    "cancel_requested",
    "cancelled",
)
TERMINAL_TASK_STATUSES = ("succeeded", "failed", "cancelled")

DEFAULT_PROVIDER_CODE = "mock"
DEFAULT_MODEL_CODE = "mock-default"
