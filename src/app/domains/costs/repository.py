"""Cost ledger queries: rates, usage, project totals and budget rows."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.costs.models import CostRate
from app.domains.generation.models import UsageRecord
from app.domains.projects.models import Project


def get_rate(
    db: Session, *, provider_code: str, model_code: str, capability: str, at: datetime
) -> CostRate | None:
    base = (
        select(CostRate)
        .where(
            CostRate.capability == capability,
            CostRate.is_active.is_(True),
            CostRate.effective_from <= at,
        )
        .order_by(CostRate.effective_from.desc())
    )
    exact = db.scalar(
        base.where(
            CostRate.provider_code == provider_code, CostRate.model_code == model_code
        ).limit(1)
    )
    if exact is not None:
        return exact
    provider_wildcard = db.scalar(
        base.where(CostRate.provider_code == provider_code, CostRate.model_code == "").limit(1)
    )
    if provider_wildcard is not None:
        return provider_wildcard
    return db.scalar(
        base.where(CostRate.provider_code == "", CostRate.model_code == "").limit(1)
    )


def find_usage_for_attempt(db: Session, attempt_id: UUID) -> UsageRecord | None:
    return db.scalar(select(UsageRecord).where(UsageRecord.attempt_id == attempt_id))


def add_usage(db: Session, **values) -> UsageRecord:
    row = UsageRecord(**values)
    db.add(row)
    db.flush()
    return row


def project_usage_sums(db: Session, project_id: UUID) -> tuple[float, float, int]:
    row = db.execute(
        select(
            func.coalesce(func.sum(UsageRecord.estimated_amount), 0),
            func.coalesce(func.sum(UsageRecord.amount), 0),
            func.count(UsageRecord.id),
        ).where(UsageRecord.project_id == project_id)
    ).one()
    return float(row[0]), float(row[1]), int(row[2])


def list_usage(
    db: Session,
    *,
    project_ids: list[UUID],
    project_id: UUID | None = None,
    status: str | None = None,
    cap: str | None = None,
    search: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[UsageRecord], int]:
    if not project_ids:
        return [], 0
    conditions = [UsageRecord.project_id.in_(project_ids)]
    if project_id is not None:
        conditions.append(UsageRecord.project_id == project_id)
    if status:
        conditions.append(UsageRecord.billing_status == status)
    if cap:
        conditions.append(UsageRecord.capability == cap)
    if search:
        conditions.append(UsageRecord.code.ilike(f"%{search.strip()}%"))
    query = select(UsageRecord).where(*conditions).order_by(UsageRecord.created_at.desc())
    total = int(db.scalar(select(func.count(UsageRecord.id)).where(*conditions)) or 0)
    return list(db.scalars(query.offset(offset).limit(limit)).all()), total


def summary(
    db: Session, *, project_ids: list[UUID], project_id: UUID | None = None
) -> dict:
    if not project_ids:
        return {
            "actual": 0.0,
            "failed": 0.0,
            "estimated": 0.0,
            "count": 0,
            "byCapability": [],
        }
    conditions = [UsageRecord.project_id.in_(project_ids)]
    if project_id is not None:
        conditions.append(UsageRecord.project_id == project_id)
    row = db.execute(
        select(
            func.coalesce(func.sum(UsageRecord.estimated_amount), 0),
            func.coalesce(func.sum(UsageRecord.amount), 0),
            func.count(UsageRecord.id),
        ).where(*conditions)
    ).one()
    failed = db.scalar(
        select(func.coalesce(func.sum(UsageRecord.amount), 0)).where(
            *conditions, UsageRecord.failure.is_(True)
        )
    )
    by_cap = db.execute(
        select(
            UsageRecord.capability,
            func.coalesce(func.sum(UsageRecord.estimated_amount), 0),
            func.coalesce(func.sum(UsageRecord.amount), 0),
            func.count(UsageRecord.id),
        )
        .where(*conditions)
        .group_by(UsageRecord.capability)
        .order_by(func.sum(UsageRecord.amount).desc())
    ).all()
    estimated, actual, count = row
    return {
        "estimated": float(estimated),
        "actual": float(actual),
        "failed": float(failed or 0),
        "count": int(count),
        "byCapability": [
            {
                "capability": cap,
                "estimated": float(est),
                "actual": float(amount),
                "count": int(items),
            }
            for cap, est, amount, items in by_cap
        ],
    }


def list_budget_projects(
    db: Session, *, organization_id: UUID, project_ids: list[UUID]
) -> list[Project]:
    if not project_ids:
        return []
    return list(
        db.scalars(
            select(Project)
            .where(Project.organization_id == organization_id, Project.id.in_(project_ids))
            .order_by(Project.created_at.desc())
        ).all()
    )


def organization_project_totals(db: Session, organization_id: UUID) -> tuple[float, float]:
    row = db.execute(
        select(
            func.coalesce(func.sum(Project.budget), 0),
            func.coalesce(func.sum(Project.actual), 0),
        ).where(Project.organization_id == organization_id)
    ).one()
    return float(row[0]), float(row[1])
