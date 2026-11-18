"""Time helpers so every domain uses one timezone convention."""

from datetime import UTC, datetime


def utcnow() -> datetime:
    """Timezone-aware current time in UTC."""
    return datetime.now(UTC)


def ensure_utc(value: datetime) -> datetime:
    """SQLAlchemy may hand back naive datetimes; normalise them to UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
