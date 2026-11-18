"""Workflow domain background tasks: dispatch and recovery sweeps."""

from uuid import UUID

from app.config.logging import get_logger
from app.domains.workflow import service as workflow_service
from app.infrastructure.db import session_scope
from app.infrastructure.providers.registry import build_registry
from app.workers.celery_app import celery_app

logger = get_logger(__name__)

DISPATCH_TASK_NAME = "workflow.run.dispatch"
RECOVERY_TASK_NAME = "workflow.recover"


@celery_app.task(name=DISPATCH_TASK_NAME, bind=True, max_retries=3)
def dispatch_run(self, run_id: str) -> dict:  # noqa: ANN001 - celery binding
    """Drive a workflow run: claim and execute nodes until nothing is runnable."""
    registry = build_registry()
    processed: list[str] = []
    with session_scope() as db:
        workflow_service.dispatch_outbox(db)
        db.commit()
        while True:
            node = workflow_service.claim_next_node(db, UUID(run_id), f"celery:{self.request.id}")
            if node is None:
                break
            db.commit()
            try:
                workflow_service.execute_node_run(
                    db, registry, node, worker_id=f"celery:{self.request.id}"
                )
                processed.append(node.node_key)
                db.commit()
            except Exception as exc:  # noqa: BLE001 - the failure must be recorded, not lost
                db.rollback()
                workflow_service.fail_node(db, node, "WORKFLOW_NODE_ERROR", str(exc))
                db.commit()
        run = workflow_service.get_run_or_404(db, UUID(run_id))
        return {"run_id": run_id, "status": run.status, "processed": processed}


@celery_app.task(name=RECOVERY_TASK_NAME)
def recover_workflows() -> dict:
    """Periodic sweep: reclaim orphaned leases and promote due retries."""
    with session_scope() as db:
        recovered = workflow_service.recover_orphans(db)
        promoted = workflow_service.promote_retries(db)
        dispatched = workflow_service.dispatch_outbox(db)
        db.commit()
    return {"recovered": recovered, "promoted": promoted, "dispatched": dispatched}
