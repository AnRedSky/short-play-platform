"""Quality rule catalog and immutable per-run reports."""

from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db import Base, TimestampMixin, UUIDPrimaryKeyMixin

QUALITY_SEVERITIES = ("blocker", "warning")
REPORT_RESULTS = ("PASS", "REVIEW_REQUIRED", "FAIL")


class QualityRule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "quality_rules"
    __table_args__ = (UniqueConstraint("code", name="uq_quality_rules_code"),)

    code: Mapped[str] = mapped_column(String(60), nullable=False)
    level: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    dimension: Mapped[str] = mapped_column(String(40), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="warning")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    action: Mapped[str] = mapped_column(Text, nullable=False, default="")
    auto_fix: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class QualityReport(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "quality_reports"
    __table_args__ = (UniqueConstraint("code", name="uq_quality_reports_code"),)

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(60), nullable=False)
    level: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    object_label: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    version: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    result: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    issue_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fail_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    engine: Mapped[str] = mapped_column(String(80), nullable=False, default="rule-engine")
    ruleset_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    project = relationship("Project", lazy="joined", foreign_keys=[project_id])
    issues = relationship("QualityIssue", lazy="selectin", back_populates="report")


class QualityIssue(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "quality_issues"

    report_id: Mapped[UUID] = mapped_column(
        ForeignKey("quality_reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rule_code: Mapped[str] = mapped_column(String(60), nullable=False)
    dimension: Mapped[str] = mapped_column(String(40), nullable=False)
    location: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    severity: Mapped[str] = mapped_column(String(10), nullable=False, default="中")
    blocking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    action: Mapped[str] = mapped_column(Text, nullable=False, default="")
    auto_fix: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="待处理")
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")

    report = relationship("QualityReport", lazy="joined", back_populates="issues")
