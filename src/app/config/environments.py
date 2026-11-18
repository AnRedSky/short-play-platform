"""Deployment environments understood by the application.

The active environment is read from ``APP_ENV`` and only decides which env file
wins when settings are loaded (``.env`` < ``.env.{environment}``).
"""

from enum import StrEnum


class Environment(StrEnum):
    DEV = "development"
    TEST = "test"
    PROD = "production"

    @classmethod
    def normalize(cls, value: str | None) -> "Environment":
        """Accept the short aliases used by operators (dev/test/prod)."""
        raw = (value or "").strip().lower()
        aliases = {
            "dev": cls.DEV,
            "development": cls.DEV,
            "local": cls.DEV,
            "test": cls.TEST,
            "testing": cls.TEST,
            "ci": cls.TEST,
            "prod": cls.PROD,
            "production": cls.PROD,
            "staging": cls.PROD,
        }
        return aliases.get(raw, cls.DEV)

    @property
    def is_production(self) -> bool:
        return self is Environment.PROD

    @property
    def is_test(self) -> bool:
        return self is Environment.TEST
