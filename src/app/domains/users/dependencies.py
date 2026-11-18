"""Dependencies owned by the users domain."""

from uuid import UUID

from fastapi import Depends
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.domains.users import service as users_service
from app.domains.users.models import User
from app.public.exceptions import not_found


def get_user_from_path(user_id: str, db: Session = Depends(get_db)) -> User:
    """Resolve ``/users/{user_id}`` to a user; malformed ids are a 404, not a 422."""
    try:
        parsed = UUID(user_id)
    except ValueError:
        raise not_found("User not found") from None
    return users_service.get_user_or_404(db, parsed)
