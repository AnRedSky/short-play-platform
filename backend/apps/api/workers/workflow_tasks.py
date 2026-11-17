from uuid import UUID

from apps.api.db.session import SessionLocal
from apps.api.providers.registry import build_registry
from apps.api.services import workflow as workflow_service
from apps.api.workers.celery_app import celery_app


@celery_app.task(name="workflow.run.dispatch", bind=True, max_retries=3)
def dispatch_run(self, run_id: str) -> dict:
    """Drive a workflow run: claim and execute nodes until nothing is runnable."""
    registry = build_registry()
    processed: list[str] = []
    with SessionLocal() as db:
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
        run = workflow_service.get_run(db, UUID(run_id))
        return {"run_id": run_id, "status": run.status, "processed": processed}


@celery_app.task(name="workflow.recover")
def recover_workflows() -> dict:
    """Periodic sweep: reclaim orphaned leases and promote due retries."""
    with SessionLocal() as db:
        recovered = workflow_service.recover_orphans(db)
        promoted = workflow_service.promote_retries(db)
        dispatched = workflow_service.dispatch_outbox(db)
        db.commit()
    return {"recovered": recovered, "promoted": promoted, "dispatched": dispatched}
