"""B-07 quality rule evaluation and blocker rollback."""

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.domains.projects import service as projects_service
from app.domains.projects.state_machine import normalize_status
from app.domains.quality import repository as quality_repo
from app.domains.quality.constants import QUALITY_ENGINE, QUALITY_LEVELS
from app.domains.quality.models import QualityIssue, QualityReport, QualityRule
from app.public.constants import ErrorCode
from app.public.exceptions import AppError, validation_error


def _severity_label(rule: QualityRule, status: str) -> str:
    if status == "FAIL":
        return "高" if rule.severity == "blocker" else "中"
    return "中" if rule.severity == "blocker" else "低"


def run_quality(
    db: Session,
    *,
    project: Any,
    level: str,
    version: str,
    object_label: str | None,
    checks: list[dict],
    note: str,
    permissions: frozenset[str],
    actor_user_id: UUID,
) -> QualityReport:
    if level not in QUALITY_LEVELS:
        raise validation_error(f"Unknown quality level '{level}'")
    if normalize_status(project.status) != "质量检测中":
        raise AppError(
            "项目当前不在质量检测中，不能写入质检报告",
            code=ErrorCode.QUALITY_PROJECT_NOT_IN_CHECK,
            status_code=409,
            details={"status": project.status},
        )

    rules = quality_repo.list_rules(db, level)
    rule_by_code = {rule.code: rule for rule in rules}
    supplied: dict[str, dict] = {}
    for check in checks:
        code = str(check.get("rule_code") or "")
        if code not in rule_by_code:
            raise AppError(
                f"规则 {code} 不属于 {level}",
                code=ErrorCode.QUALITY_RULE_UNKNOWN,
                status_code=422,
                details={"rule_code": code, "level": level},
            )
        if code in supplied:
            raise validation_error(f"Rule {code} is checked more than once")
        supplied[code] = check

    failed: list[tuple[QualityRule, dict]] = []
    review: list[tuple[QualityRule, dict]] = []
    for rule in rules:
        check = supplied.get(rule.code, {"status": "PASS"})
        status = str(check.get("status") or "PASS")
        if status not in {"PASS", "REVIEW_REQUIRED", "FAIL"}:
            raise validation_error(f"Unknown check status '{status}'")
        if status == "FAIL":
            failed.append((rule, check))
        elif status == "REVIEW_REQUIRED":
            review.append((rule, check))

    result = "FAIL" if failed else ("REVIEW_REQUIRED" if review else "PASS")
    report_code = f"QR-{project.code}-{quality_repo.report_count(db, project.id) + 1:03}"
    report = quality_repo.add_report(
        db,
        project_id=project.id,
        code=report_code,
        level=level,
        object_label=object_label or f"{project.code} / {level}",
        version=version,
        result=result,
        items=len(rules),
        issue_count=len(failed) + len(review),
        review_count=len(review),
        fail_count=len(failed),
        engine=QUALITY_ENGINE,
        ruleset_version=max((rule.version for rule in rules), default=1),
        note=note,
        actor_user_id=actor_user_id,
    )

    for rule, check in [*failed, *review]:
        status = str(check.get("status") or "REVIEW_REQUIRED")
        quality_repo.add_issue(
            db,
            report_id=report.id,
            rule_code=rule.code,
            dimension=rule.dimension,
            location=str(check.get("location") or "整份成片"),
            severity=_severity_label(rule, status),
            blocking=status == "FAIL",
            action=str(check.get("action") or rule.action),
            auto_fix=rule.auto_fix,
            note=str(check.get("note") or rule.description),
        )

    if result == "FAIL":
        projects_service.transition_project(
            db,
            project,
            action="failQc",
            reason=f"{report_code} 存在阻断项，自动退回后期" + (f"：{note}" if note else ""),
            expected_state=project.status,
            permissions=permissions,
            actor_user_id=actor_user_id,
        )
    db.flush()
    return report


def serialize_report(report: QualityReport) -> dict:
    project = report.project
    return {
        "id": report.code,
        "project": project.code if project is not None else "—",
        "projectName": project.title if project is not None else "—",
        "object": report.object_label,
        "level": report.level,
        "version": report.version,
        "result": report.result,
        "items": report.items,
        "issues": report.issue_count,
        "review": report.review_count,
        "fail": report.fail_count,
        "engine": report.engine,
        "note": report.note,
        "at": report.created_at.strftime("%Y-%m-%d %H:%M") if report.created_at else "—",
    }


def serialize_issue(issue: QualityIssue) -> dict:
    return {
        "id": str(issue.id),
        "report": issue.report.code,
        "dim": issue.dimension,
        "where": issue.location,
        "level": issue.severity,
        "action": issue.action,
        "auto": "是" if issue.auto_fix else "否",
        "blocking": issue.blocking,
        "status": issue.status,
        "note": issue.note,
    }


def serialize_rule(rule: QualityRule) -> dict:
    return {
        "code": rule.code,
        "level": rule.level,
        "dimension": rule.dimension,
        "severity": rule.severity,
        "description": rule.description,
        "action": rule.action,
        "auto": rule.auto_fix,
        "version": rule.version,
    }
