"""Startup / shutdown hooks and safe first-install provisioning."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from app.config.environments import Environment
from app.config.logging import configure_logging, get_logger
from app.config.settings import Settings, get_settings
from app.domains.audit import service as audit_service
from app.domains.auth import service as auth_service
from app.domains.users import repository as users_repo
from app.infrastructure import redis as redis_infra
from app.infrastructure.db import SessionFactory

logger = get_logger(__name__)
_DEVELOPMENT_BOOTSTRAP_PASSWORD = "ChangeMeNow-2026!"
_BOOTSTRAP_LOCK_ID = 731_904_221


def _validate_bootstrap_settings(settings: Settings) -> None:
    """Refuse known development credentials when first-admin provisioning is enabled in prod."""
    if not settings.bootstrap_admin_enabled:
        return
    if not settings.bootstrap_admin_password:
        raise RuntimeError("BOOTSTRAP_ADMIN_PASSWORD is required when bootstrap is enabled")
    if len(settings.bootstrap_admin_password) < 12:
        raise RuntimeError("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters")
    if settings.is_production:
        if settings.bootstrap_admin_password == _DEVELOPMENT_BOOTSTRAP_PASSWORD:
            raise RuntimeError("Set a unique BOOTSTRAP_ADMIN_PASSWORD before production startup")
        if settings.secret_key == "replace-me-for-local-development":
            raise RuntimeError("Set a unique SECRET_KEY before production startup")


def _provision_first_administrator(settings: Settings) -> None:
    """Create the configured first admin once, serialized across API replicas."""
    if not settings.bootstrap_admin_enabled or settings.app_env is Environment.TEST:
        return

    _validate_bootstrap_settings(settings)
    db = SessionFactory()
    try:
        with db.begin():
            # Serialize simultaneous first starts so two API replicas cannot both
            # observe an empty installation and race to create the initial tenant.
            db.execute(
                text("SELECT pg_advisory_xact_lock(:lock_id)"),
                {"lock_id": _BOOTSTRAP_LOCK_ID},
            )
            if users_repo.any_user_exists(db):
                logger.info("first administrator already exists; bootstrap skipped")
                return
            user = auth_service.bootstrap_first_administrator(
                db,
                email=settings.bootstrap_admin_email,
                password=settings.bootstrap_admin_password,
                full_name=settings.bootstrap_admin_full_name,
                organization_name=settings.bootstrap_organization_name,
            )
            audit_service.record(
                db,
                actor_user_id=user.id,
                action="identity.bootstrap",
                resource_type="user",
                resource_id=str(user.id),
                details={"source": "startup"},
            )
            logger.warning(
                "development first administrator provisioned email=%s; "
                "do not expose this instance outside a trusted local environment",
                user.email,
            )
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level, process="api")
    logger.info(
        "api starting env=%s debug=%s prefix=%s",
        settings.app_env,
        settings.debug,
        settings.api_v1_prefix,
    )
    _provision_first_administrator(settings)
    try:
        yield
    finally:
        redis_infra.close_connection()
        logger.info("api stopped")
