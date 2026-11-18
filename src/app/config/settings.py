"""Layered configuration: a single environment-variable entry point.

Every process reads configuration in this order, lowest precedence first:

1. ``.env.example`` — the in-repo template, used as the built-in default so a
   checkout runs without any local file;
2. ``.env`` — the operator's shared overrides;
3. ``.env.{APP_ENV}`` — environment specific overrides (development / test / production);
4. real process environment variables — always win.

Each file only overrides the keys it actually defines. Files are resolved against
the repository root, never the current working directory.
"""

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.config.environments import Environment

ENV_FILE_PREFIX = ".env"
ENV_EXAMPLE_FILE = ".env.example"
ENV_FILE_DIR = Path(__file__).resolve().parents[3]


def parse_env_file(path: Path) -> dict[str, str]:
    """Parse a dotenv style file into KEY -> value (no expansion, no side effects)."""
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name, _, value = stripped.partition("=")
        values[name.strip()] = value.strip().strip("\\\"'")
    return values


def _read_key_from_env_file(path: Path, key: str) -> str | None:
    return parse_env_file(path).get(key)


def _read_app_env_from_dotenv() -> str | None:
    explicit = os.environ.get("APP_ENV")
    if explicit:
        return explicit
    for candidate in (ENV_FILE_PREFIX, ENV_EXAMPLE_FILE):
        value = _read_key_from_env_file(ENV_FILE_DIR / candidate, "APP_ENV")
        if value:
            return value
    return None


def _active_environment() -> Environment:
    return Environment.normalize(_read_app_env_from_dotenv())


def env_files() -> tuple[str, str, str]:
    """Absolute env files, lowest precedence first: example, .env, env-specific."""
    environment = _active_environment()
    return (
        str(ENV_FILE_DIR / ENV_EXAMPLE_FILE),
        str(ENV_FILE_DIR / ENV_FILE_PREFIX),
        str(ENV_FILE_DIR / f"{ENV_FILE_PREFIX}.{environment.value}"),
    )


class Settings(BaseSettings):
    """Runtime configuration shared by the API, worker and beat processes."""

    model_config = SettingsConfigDict(
        env_file=env_files(),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Application
    app_name: str = "short-play-platform"
    app_env: Environment = Field(default_factory=_active_environment)
    debug: bool = Field(default=False, validation_alias="APP_DEBUG")
    api_host: str = Field(default="0.0.0.0", validation_alias="API_HOST")
    api_port: int = Field(default=8000, validation_alias="API_PORT")
    api_v1_prefix: str = Field(default="/api/v1", validation_alias="API_V1_PREFIX")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    public_base_url: str = Field(default="http://localhost:8000", validation_alias="PUBLIC_BASE_URL")

    # Infrastructure
    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:6432/short_play",
        validation_alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:9770/0", validation_alias="REDIS_URL")

    # Celery
    celery_broker_url: str | None = None
    celery_result_backend: str | None = None
    celery_timezone: str = "UTC"
    celery_task_always_eager: bool = False

    # Security
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    secret_key: str = "replace-me-for-local-development"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7
    password_min_length: int = 10

    # First-run administrator provisioning. Disabled in code by default; the
    # checked-in development template opts in with explicitly documented local
    # credentials. Production must opt in and supply its own credentials.
    bootstrap_admin_enabled: bool = Field(default=False, validation_alias="BOOTSTRAP_ADMIN_ENABLED")
    bootstrap_admin_email: str = Field(default="admin@localhost", validation_alias="BOOTSTRAP_ADMIN_EMAIL")
    bootstrap_admin_password: str = Field(default="", validation_alias="BOOTSTRAP_ADMIN_PASSWORD")
    bootstrap_admin_full_name: str = Field(
        default="Platform Administrator", validation_alias="BOOTSTRAP_ADMIN_FULL_NAME"
    )
    bootstrap_organization_name: str = Field(
        default="Short Play Studio", validation_alias="BOOTSTRAP_ORGANIZATION_NAME"
    )

    # Storage / media
    storage_root: str = "storage"
    max_upload_size: int = 500 * 1024 * 1024
    ffmpeg_binary: str = "ffmpeg"
    ffprobe_binary: str = "ffprobe"

    @field_validator("app_env", mode="before")
    @classmethod
    def _normalize_environment(cls, value: object) -> object:
        if isinstance(value, Environment):
            return value
        if value is None:
            return _active_environment()
        return Environment.normalize(str(value))

    @property
    def environment(self) -> Environment:
        return self.app_env

    @property
    def is_production(self) -> bool:
        return self.app_env.is_production

    @property
    def broker_url(self) -> str:
        return self.celery_broker_url or self.redis_url

    @property
    def result_backend_url(self) -> str:
        return self.celery_result_backend or self.redis_url


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance: one read of the environment per process."""
    return Settings()
