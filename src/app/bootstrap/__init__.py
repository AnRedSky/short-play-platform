"""Bootstrap layer: application assembly only, no business logic."""

from app.bootstrap.lifespan import lifespan
from app.bootstrap.register import register_all

__all__ = ["lifespan", "register_all"]
