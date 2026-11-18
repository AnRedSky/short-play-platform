"""Guard the domain model registry against FK resolution regressions.

Models reference tables owned by other domains through string foreign keys,
so every process that opens a session must import the whole metadata. The
registry lives in ``app.domains``; this test fails when a new domain ships a
``models.py`` that the registry forgot, which is exactly how Celery workers
lost the ``projects`` table.
"""

from pathlib import Path

import app.domains
from app.infrastructure.db import metadata

DOMAINS_DIR = Path(app.domains.__file__).parent


def test_every_domain_model_module_is_registered() -> None:
    registered = {module.__name__ for module in app.domains.MODEL_MODULES}
    expected = {
        f"app.domains.{path.parent.name}.models"
        for path in DOMAINS_DIR.glob("*/models.py")
    }
    assert expected == registered


def test_metadata_contains_cross_domain_target_tables() -> None:
    # workflow_runs.project_id -> projects.id is the reference that used to fail
    # at flush time inside the worker process.
    assert "projects" in metadata.tables
    assert "workflow_runs" in metadata.tables
