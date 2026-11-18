"""Layered configuration: a single environment-variable entry point.

Load order is ``.env`` first, then ``.env.{APP_ENV}``. The environment specific
file is loaded last and therefore overrides the generic one, which lets a
deployment keep shared defaults in ``.env`` and only override what differs.
"""

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.config.environments import Environment

ENV_FILE_PREFIX = ".env"


def _read_app_env_from_dotenv() -> str | None:
    """Read ``APP_ENV`` straight from ``.env`` before pydantic builds the model.

    The env file to load depends on ``APP_ENV`` itself, so it has to be resolved
    without the settings object. The parser intentionally stays tiny: only the
    first ``APP_ENV=`` line is needed here.
    """
    env_path = Path(ENV_FILE_PREFIX)
    if not env_path.is_file():
        return None
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        if key.strip() == "APP_ENV":
            return value.strip().strip("\"'")
    return None


def _active_environment() -> Environment:
    return Environment.normalize(os.environ.get("APP_ENV") or _read_app_env_from_dotenv())


def env_files() -> tuple[str, str]:
    """``.env`` then ``.env.{environment}``; the second file wins."""
    return (ENV_FILE_PREFIX, f"{ENV_FILE_PREFIX}.{_active_environment().value}")


class Settings(BaseSettings):
    """Runtime configuration shared by the API, worker and beat processes."""
    
    model_config = SettingsConfigDict(
        env_file=env_files(),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )
    # -- application ---------------------------------------------------------
    app_name: str = "short-play-platform"
    app_env: Environment = Field(default_factory=_active_environment)
    debug: bool = Field(default=False, validation_alias="APP_DEBUG")
    api_host: str = Field(default="0.0.0.0", validation_alias="API_HOST")
    api_port: int = Field(default=7000, validation_alias="API_PORT")
    api_v1_prefix: str = Field(default="/api/v1", validation_alias="API_V1_PREFIX")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    public_base_url: str = Field(default="http://localhost:8000", validation_alias="PUBLIC_BASE_URL")

    # -- infrastructure ------------------------------------------------------
    database_url: str = Field(default="postgresql+psycopg://short_play:replace-me@localhost:5432/short_play", validation_alias="DATABASE_URL")
    redis_url: str = Field(default="redis://localhost:6379/0", validation_alias="REDIS_URL")

    # -- celery --------------------------------------------------------------
    # Both default to the shared Redis instance; point them at RabbitMQ
    # (docker/docker-compose.infra.yml ships one) when a dedicated broker is used.
    celery_broker_url: str | None = None
    celery_result_backend: str | None = None
    celery_timezone: str = "UTC"
    celery_task_always_eager: bool = False

    # -- security ------------------------------------------------------------
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    secret_key: str = "replace-me-for-local-development"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7
    password_min_length: int = 10

    # -- storage / media -----------------------------------------------------
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

    # -- derived values ------------------------------------------------------
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
