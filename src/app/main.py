"""Application factory.

The factory stays thin on purpose: all assembly lives in ``bootstrap``.
"""

from fastapi import FastAPI

from app.bootstrap.lifespan import lifespan
from app.bootstrap.register import register_all
from app.config.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        lifespan=lifespan,
    )
    register_all(app)
    return app


app = create_app()
