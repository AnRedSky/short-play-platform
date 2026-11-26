"""Quality rules, reports and issues queries."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.quality.models import QualityIssue, QualityReport, QualityRule


def list_rules(db: Session, level: str | None = None) -> list[QualityRule]:
    query = select(QualityRule).where(QualityRule.enabled.is_(True))
    if level:
        query = query.where(QualityRule.level == level)
    return list(db.scalars(query.order_by(QualityRule.level, QualityRule.code)).all())


def get_rule(db: Session, code: str) -> QualityRule | None:
    return db.scalar(select(QualityRule).where(QualityRule.code == code))


def report_count(db: Session, project_id: UUID) -> int:
    return int(
        db.scalar(
            select(func.count(QualityReport.id)).where(
                QualityReport.project_id == project_id
            )
        )
        or 0
    )


def add_report(db: Session, **values) -> QualityReport:
    report = QualityReport(**values)
    db.add(report)
    db.flush()
    return report


def add_issue(db: Session, **values) -> QualityIssue:
    issue = QualityIssue(**values)
    db.add(issue)
    db.flush()
    return issue


def list_reports(
    db: Session,
    *,
    project_ids: list[UUID],
    project_id: UUID | None = None,
    level: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[QualityReport], int]:
    if not project_ids:
        return [], 0
    conditions = [QualityReport.project_id.in_(project_ids)]
    if project_id is not None:
        conditions.append(QualityReport.project_id == project_id)
    if level:
        conditions.append(QualityReport.level == level)
    query = select(QualityReport).where(*conditions).order_by(QualityReport.created_at.desc())
    total = int(db.scalar(select(func.count(QualityReport.id)).where(*conditions)) or 0)
    return list(db.scalars(query.offset(offset).limit(limit)).all()), total


def list_issues(
    db: Session,
    *,
    project_ids: list[UUID],
    report_code: str | None = None,
    offset: int = 0,
    limit: int = 100,
) -> tuple[list[QualityIssue], int]:
    if not project_ids:
        return [], 0
    conditions = [QualityReport.project_id.in_(project_ids)]
    if report_code:
        conditions.append(QualityReport.code == report_code)
    query = (
        select(QualityIssue)
        .join(QualityReport, QualityIssue.report_id == QualityReport.id)
        .where(*conditions)
        .order_by(QualityIssue.created_at.desc())
    )
    total = int(
        db.scalar(
            select(func.count(QualityIssue.id))
            .join(QualityReport, QualityIssue.report_id == QualityReport.id)
            .where(*conditions)
        )
        or 0
    )
    return list(db.scalars(query.offset(offset).limit(limit)).all()), total
