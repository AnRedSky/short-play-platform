"""Logging setup shared by the API, the Celery worker and Celery beat."""

import logging
import logging.config
import sys


def configure_logging(level: str = "INFO", *, process: str = "api") -> None:
    """Configure root logging once per process.

    ``process`` only labels the output so a mixed worker/beat log is readable.
    """
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "standard": {
                    "format": f"%(asctime)s %(levelname)s [{process}] %(name)s %(message)s"
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "standard",
                    "stream": sys.stdout,
                }
            },
            "root": {"handlers": ["console"], "level": level.upper()},
        }
    )


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
