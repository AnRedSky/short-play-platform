"""Domain package root.

Importing every domain's ``models`` module here guarantees that a process which
touches only one domain still sees the complete SQLAlchemy metadata: models
reference tables owned by other domains through string foreign keys (for
example ``workflow_runs.project_id -> projects.id``), and SQLAlchemy cannot
resolve those if the target table was never imported. Celery workers and the
scripts are exactly that case, so the imports live at the package root instead
of being repeated per entry point.
"""

from app.domains.assets import models as assets_models  # noqa: F401
from app.domains.audit import models as audit_models  # noqa: F401
from app.domains.auth import models as auth_models  # noqa: F401
from app.domains.creation import models as creation_models  # noqa: F401
from app.domains.generation import models as generation_models  # noqa: F401
from app.domains.organizations import models as organizations_models  # noqa: F401
from app.domains.projects import models as projects_models  # noqa: F401
from app.domains.roles import models as roles_models  # noqa: F401
from app.domains.users import models as users_models  # noqa: F401
from app.domains.workflow import models as workflow_models  # noqa: F401

MODEL_MODULES = (
    assets_models,
    audit_models,
    auth_models,
    creation_models,
    generation_models,
    organizations_models,
    projects_models,
    roles_models,
    users_models,
    workflow_models,
)

__all__ = ["MODEL_MODULES"]
