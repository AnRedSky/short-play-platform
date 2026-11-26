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
from app.domains.costs import models as costs_models  # noqa: F401
from app.domains.creation import models as creation_models  # noqa: F401
from app.domains.delivery import models as delivery_models  # noqa: F401
from app.domains.generation import models as generation_models  # noqa: F401
from app.domains.notifications import models as notifications_models  # noqa: F401
from app.domains.ops import models as ops_models  # noqa: F401
from app.domains.organizations import models as organizations_models  # noqa: F401
from app.domains.projects import models as projects_models  # noqa: F401
from app.domains.quality import models as quality_models  # noqa: F401
from app.domains.roles import models as roles_models  # noqa: F401
from app.domains.users import models as users_models  # noqa: F401
from app.domains.workflow import models as workflow_models  # noqa: F401

MODEL_MODULES = (
    assets_models,
    audit_models,
    auth_models,
    costs_models,
    creation_models,
    delivery_models,
    generation_models,
    notifications_models,
    ops_models,
    organizations_models,
    projects_models,
    quality_models,
    roles_models,
    users_models,
    workflow_models,
)

__all__ = ["MODEL_MODULES"]
