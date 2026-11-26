"""Alembic environment.

Imports ``Base.metadata`` from the infrastructure layer and pulls in every
domain model module so the migration autogenerate sees all mapped tables.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config.settings import get_settings

# Importing every domain model module registers all mapped classes on ``metadata``.
from app.domains.assets import models as assets_models  # noqa: F401
from app.domains.audit import models as audit_models  # noqa: F401
from app.domains.auth import models as auth_models  # noqa: F401
from app.domains.costs import models as costs_models  # noqa: F401
from app.domains.creation import models as creation_models  # noqa: F401
from app.domains.generation import models as generation_models  # noqa: F401
from app.domains.organizations import models as organizations_models  # noqa: F401
from app.domains.projects import models as projects_models  # noqa: F401
from app.domains.quality import models as quality_models  # noqa: F401
from app.domains.roles import models as roles_models  # noqa: F401
from app.domains.users import models as users_models  # noqa: F401
from app.domains.workflow import models as workflow_models  # noqa: F401
from app.infrastructure.db import ensure_database_exists, metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
config.set_main_option("sqlalchemy.url", get_settings().database_url)
target_metadata = metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # A first run on a fresh PostgreSQL host has no database yet; create it so
    # `alembic upgrade head` works without manual provisioning.
    ensure_database_exists(config.get_main_option("sqlalchemy.url"))
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
