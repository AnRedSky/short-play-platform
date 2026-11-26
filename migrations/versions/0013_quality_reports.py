"""Revision 0013: quality rules, reports and blocking issues (B-07)."""

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0013_quality_reports"
down_revision = "0012_cost_ledger"
branch_labels = None
depends_on = None

RULES = [
    ("Q-A01", "资产级", "清晰度", "blocker", "成片分辨率、码率低于平台交付基线", "按原工程重新渲染并替换资产", False),
    ("Q-A02", "资产级", "人物一致性", "blocker", "同一角色跨镜头面部或服装不可辨识", "回退视觉资产与镜头重新生成", False),
    ("Q-A03", "资产级", "版权授权", "warning", "素材授权凭证缺失或范围不足", "补齐授权凭证后再交付", False),
    ("Q-A04", "资产级", "元数据", "warning", "资产缺少时长、语言或版本信息", "自动补齐媒体元数据", True),
    ("Q-S01", "镜头级", "角色一致性", "blocker", "镜头首帧角色与设定不一致", "重新生成该镜头", False),
    ("Q-S02", "镜头级", "口型同步", "blocker", "对白口型偏移超过 80ms", "重新跑口型同步或重生成", False),
    ("Q-S03", "镜头级", "镜头时长", "warning", "镜头时长超出分镜合同容差", "调整剪辑点并更新合同版本", False),
    ("Q-S04", "镜头级", "字幕安全区", "warning", "字幕落入平台裁切安全区", "自动重排字幕位置", True),
    ("Q-E01", "单集级", "剧情连续性", "blocker", "单集内剧情跳接或人物关系冲突", "回退后期重剪并重出该集", False),
    ("Q-E02", "单集级", "字幕文本", "warning", "检测到错别字或标点异常", "自动替换并复核语义", True),
    ("Q-E03", "单集级", "音画同步", "blocker", "整集音轨与画面对齐漂移超过 120ms", "回退后期重对齐音画", False),
    ("Q-E04", "单集级", "平台规格", "warning", "时长、封版规格不符合投放平台", "调整输出参数后重新打包", False),
    ("Q-W01", "整剧级", "人物弧光", "blocker", "跨集人物设定或关系发生不可解释变化", "回退后期统一修正后整剧重检", False),
    ("Q-W02", "整剧级", "集间衔接", "blocker", "相邻集开场与上集结尾无法衔接", "回退后期补拍或重剪衔接段", False),
    ("Q-W03", "整剧级", "交付规格", "warning", "总集数、总时长或命名不符合交付包规范", "按交付模板重新打包", False),
    ("Q-W04", "整剧级", "合规终审", "blocker", "整剧存在未闭环的合规或敏感内容项", "回退后期处理并重新终审", False),
]


def upgrade() -> None:
    op.create_table(
        "quality_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=60), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False),
        sa.Column("dimension", sa.String(length=40), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="warning"),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("action", sa.Text(), nullable=False, server_default=""),
        sa.Column("auto_fix", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_quality_rules_code"),
    )
    op.create_index("ix_quality_rules_level", "quality_rules", ["level"])

    op.create_table(
        "quality_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=60), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False),
        sa.Column("object_label", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("version", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("result", sa.String(length=30), nullable=False),
        sa.Column("items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("issue_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fail_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("engine", sa.String(length=80), nullable=False, server_default="rule-engine"),
        sa.Column("ruleset_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_quality_reports_code"),
    )
    op.create_index("ix_quality_reports_project_id", "quality_reports", ["project_id"])
    op.create_index("ix_quality_reports_level", "quality_reports", ["level"])
    op.create_index("ix_quality_reports_result", "quality_reports", ["result"])

    op.create_table(
        "quality_issues",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("report_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rule_code", sa.String(length=60), nullable=False),
        sa.Column("dimension", sa.String(length=40), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("severity", sa.String(length=10), nullable=False, server_default="中"),
        sa.Column("blocking", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("action", sa.Text(), nullable=False, server_default=""),
        sa.Column("auto_fix", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="待处理"),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["report_id"], ["quality_reports.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quality_issues_report_id", "quality_issues", ["report_id"])

    quality_rules = sa.table(
        "quality_rules",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("code", sa.String),
        sa.column("level", sa.String),
        sa.column("dimension", sa.String),
        sa.column("severity", sa.String),
        sa.column("description", sa.Text),
        sa.column("action", sa.Text),
        sa.column("auto_fix", sa.Boolean),
        sa.column("version", sa.Integer),
        sa.column("enabled", sa.Boolean),
    )
    op.bulk_insert(
        quality_rules,
        [
            {
                "id": uuid.uuid4(),
                "code": code,
                "level": level,
                "dimension": dimension,
                "severity": severity,
                "description": description,
                "action": action,
                "auto_fix": auto_fix,
                "version": 1,
                "enabled": True,
            }
            for code, level, dimension, severity, description, action, auto_fix in RULES
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_quality_issues_report_id", table_name="quality_issues")
    op.drop_table("quality_issues")
    op.drop_index("ix_quality_reports_result", table_name="quality_reports")
    op.drop_index("ix_quality_reports_level", table_name="quality_reports")
    op.drop_index("ix_quality_reports_project_id", table_name="quality_reports")
    op.drop_table("quality_reports")
    op.drop_index("ix_quality_rules_level", table_name="quality_rules")
    op.drop_table("quality_rules")
