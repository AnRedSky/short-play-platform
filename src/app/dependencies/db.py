"""Re-export of the session dependency.

``get_db`` is defined once in ``infrastructure.db``; exporting it here keeps the
dependency inversion explicit: HTTP-facing code depends on this package, and
only this package knows the infrastructure module.
"""

from app.infrastructure.db import SessionFactory, engine, get_db, session_scope

__all__ = ["SessionFactory", "engine", "get_db", "session_scope"]
