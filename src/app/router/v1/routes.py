"""API v1 route aggregation: one line per domain."""

from fastapi import APIRouter

from app.domains.assets.router import router as assets_router
from app.domains.audit.router import router as audit_router
from app.domains.auth.router import router as auth_router
from app.domains.costs.router import router as costs_router
from app.domains.creation.router import router as creation_router
from app.domains.delivery.router import router as delivery_router
from app.domains.generation.router import router as generation_router
from app.domains.health.router import router as health_router
from app.domains.organizations.router import router as organizations_router
from app.domains.projects.router import router as projects_router
from app.domains.quality.router import router as quality_router
from app.domains.roles.router import router as roles_router
from app.domains.users.router import router as users_router
from app.domains.workflow.router import router as workflow_router

router = APIRouter()

for domain_router in (
    health_router,
    auth_router,
    users_router,
    roles_router,
    organizations_router,
    projects_router,
    creation_router,
    generation_router,
    costs_router,
    quality_router,
    delivery_router,
    workflow_router,
    assets_router,
    audit_router,
):
    router.include_router(domain_router)
