"""Local API entry point: ``python start_api.py``."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

import uvicorn  # noqa: E402

from app.config.logging import configure_logging, get_logger  # noqa: E402
from app.config.settings import env_files, get_settings  # noqa: E402


def _config_sources() -> list[str]:
    """Env files actually present, in the order settings applies them."""
    return [Path(path).name for path in env_files() if Path(path).is_file()]


def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    logger = get_logger("app.startup")
    logger.info(
        "configuration environment=%s files=%s api=%s:%s",
        settings.app_env.value,
        ",".join(_config_sources()) or "code-defaults",
        settings.api_host,
        settings.api_port,
    )
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=not settings.is_production,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
