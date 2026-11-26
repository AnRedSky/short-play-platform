"""B-06 cost, budget and ledger HTTP contract."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.dependencies.auth import Principal, require_permission
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, get_pagination
from app.domains.audit import service as audit_service
from app.domains.costs import repository as costs_repo
from app.domains.costs import service as costs_service
from app.domains.costs.constants import (
    BUDGET_STATE_EXCEEDED,
    BUDGET_STATE_NORMAL,
    BUDGET_STATE_UNSET,
    BUDGET_STATE_WARNING,
)
from app.domains.projects import repository as projects_repo
from app.domains.projects import service as projects_service
from app.public.exceptions import conflict, not_found
from app.public.schemas import envelope

router = APIRouter(tags=["costs"])


class BudgetUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total: float = Field(ge=0, le=100_000_000)
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("total")
    @classmethod
    def _round_money(cls, value: float) -> float:
        return round(value, 2)


def _accessible_ids(db: Session, principal: Principal) -> list[UUID]:
    return projects_repo.list_accessible_project_ids(
        db,
        principal.organization_id,
        user_id=principal.user.id,
        manage="project.manage" in principal.permissions,
    )


def _project_id_filter(db: Session, principal: Principal, project: str | None) -> UUID | None:
    if not project:
        return None
    try:
        project_id = UUID(project)
    except ValueError:
        row = projects_repo.get_project_by_code(db, principal.organization_id, project)
        if row is None:
            raise not_found("Project not found") from None
        project_id = row.id
    if project_id not in _accessible_ids(db, principal):
        raise not_found("Project not found")
    return project_id


@router.get("/costs")
def list_costs(
    project: str | None = None,
    status: str | None = None,
    cap: str | None = None,
    search: str | None = None,
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("cost.read")),
    db: Session = Depends(get_db),
) -> dict:
    project_id = _project_id_filter(db, principal, project)
    rows, total = costs_repo.list_usage(
        db,
        project_ids=_accessible_ids(db, principal),
        project_id=project_id,
        status=status,
        cap=cap,
        search=search,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return envelope(
        [costs_service.serialize_usage(row) for row in rows], pagination.meta(total)
    )


@router.get("/costs/summary")
def cost_summary(
    project: str | None = None,
    principal: Principal = Depends(require_permission("cost.read")),
    db: Session = Depends(get_db),
) -> dict:
    project_id = _project_id_filter(db, principal, project)
    data = costs_repo.summary(
        db, project_ids=_accessible_ids(db, principal), project_id=project_id
    )
    return envelope(data)


@router.get("/budgets")
def list_budgets(
    principal: Principal = Depends(require_permission("cost.read")),
    db: Session = Depends(get_db),
) -> dict:
    project_ids = _accessible_ids(db, principal)
    projects = costs_repo.list_budget_projects(
        db, organization_id=principal.organization_id, project_ids=project_ids
    )
    rows = [costs_service.serialize_budget(project) for project in projects]
    total = sum(row["total"] for row in rows)
    used = sum(row["used"] for row in rows)
    reserve = sum(row["reserve"] for row in rows)
    if total <= 0:
        state = BUDGET_STATE_UNSET
    elif used >= total:
        state = BUDGET_STATE_EXCEEDED
    elif used >= total * 0.85:
        state = BUDGET_STATE_WARNING
    else:
        state = BUDGET_STATE_NORMAL
    enterprise = {
        "scope": "企业",
        "name": "企业可见范围 AI 预算",
        "project": "—",
        "total": total,
        "used": used,
        "reserve": reserve,
        "state": state,
        "owner": "—",
        "currency": "CNY",
    }
    return envelope([enterprise, *rows], {"total": len(rows) + 1})


@router.get("/projects/{project_id}/costs")
def project_costs(
    project_id: UUID,
    pagination: PaginationParams = Depends(get_pagination),
    principal: Principal = Depends(require_permission("cost.read")),
    db: Session = Depends(get_db),
) -> dict:
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
    )
    rows, total = costs_repo.list_usage(
        db,
        project_ids=[project.id],
        project_id=project.id,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return envelope(
        [costs_service.serialize_usage(row) for row in rows], pagination.meta(total)
    )


@router.patch("/projects/{project_id}/budget")
def update_budget(
    project_id: UUID,
    payload: BudgetUpdate,
    request: Request,
    principal: Principal = Depends(require_permission("cost.manage")),
    db: Session = Depends(get_db),
) -> dict:
    project = projects_service.get_accessible_project(
        db,
        project_id,
        user_id=principal.user.id,
        permissions=principal.permissions,
        permission_needed="cost.manage",
        for_update=True,
    )
    costs_service.refresh_project_totals(db, project.id)
    if payload.total < float(project.actual or 0):
        raise conflict(
            "Budget cannot be lower than the recorded actual cost",
            {"total": payload.total, "actual": float(project.actual or 0)},
        )
    previous = float(project.budget or 0)
    project.budget = payload.total
    db.flush()
    audit_service.record(
        db,
        actor_user_id=principal.user.id,
        action="project.budget.updated",
        resource_type="project",
        resource_id=str(project.id),
        request_id=getattr(request.state, "request_id", None),
        details={"from": previous, "to": payload.total, "reason": payload.reason},
    )
    db.commit()
    db.refresh(project)
    return envelope(costs_service.serialize_budget(project))
