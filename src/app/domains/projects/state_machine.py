"""Project status machine: the single server-side source of truth.

Fifteen canonical states, and every legal ``action`` between them. The table
mirrors the frontend mock gate actions that B-01 froze, but the server never
trusts the client's ``allowed_actions``: it re-derives the action from the
project's current status and re-checks the caller's permission.
"""

from dataclasses import dataclass

PROJECT_STATUSES: tuple[str, ...] = (
    "草稿",
    "创意策划中",
    "剧本创作中",
    "待剧本审核",
    "生产准备中",
    "生产中",
    "后期制作中",
    "质量检测中",
    "待最终审核",
    "已完成",
    "已交付",
    "已归档",
    "已暂停",
    "异常中",
    "已终止",
)

# Legacy English statuses from the first schema. Existing rows are migrated, but
# reads stay tolerant so an old database never exposes a status outside the enum.
LEGACY_STATUS_MAP: dict[str, str] = {
    "draft": "草稿",
    "in_review": "待剧本审核",
    "approved": "已完成",
    "rejected": "剧本创作中",
    "archived": "已归档",
}

TERMINAL_STATUSES: frozenset[str] = frozenset({"已归档", "已终止"})
STATUS_PHASE: dict[str, str] = {
    "草稿": "创意策划",
    "创意策划中": "创意策划",
    "剧本创作中": "剧本创作",
    "待剧本审核": "剧本审核",
    "生产准备中": "生产准备",
    "生产中": "视频生产",
    "后期制作中": "后期制作",
    "质量检测中": "质量检测",
    "待最终审核": "最终审核",
    "已完成": "已交付",
    "已交付": "已交付",
    "已归档": "已归档",
    "已暂停": "已暂停",
    "异常中": "异常",
    "已终止": "已终止",
}
IMMUTABLE_ACTIONS: frozenset[str] = frozenset({"terminate", "deliver", "archive"})
REASON_REQUIRED_ACTIONS: frozenset[str] = frozenset(
    {"terminate", "rejectScript", "pause", "failQc", "finalReject"}
)


@dataclass(frozen=True)
class GateAction:
    key: str
    label: str
    permission: str
    next: str
    need_reason: bool = False
    tone: str = "default"

    def as_dict(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "key": self.key,
            "label": self.label,
            "permission": self.permission,
            "next": self.next,
            "tone": self.tone,
            "needReason": self.need_reason,
        }
        return payload


GATE_ACTIONS: dict[str, tuple[GateAction, ...]] = {
    "草稿": (
        GateAction("start", "启动创意策划", "creation.write", "创意策划中", tone="primary"),
        GateAction("terminate", "终止项目", "project.manage", "已终止", need_reason=True),
    ),
    "创意策划中": (
        GateAction("confirmBrief", "确认创意方案", "creation.write", "剧本创作中", tone="primary"),
        GateAction("terminate", "终止项目", "project.manage", "已终止", need_reason=True),
    ),
    "剧本创作中": (
        GateAction("submitScript", "提交剧本审核", "creation.write", "待剧本审核", tone="primary"),
        GateAction("terminate", "终止项目", "project.manage", "已终止", need_reason=True),
    ),
    "待剧本审核": (
        GateAction(
            "approveScript", "审核通过并锁定", "script.review", "生产准备中", tone="primary"
        ),
        GateAction("rejectScript", "退回修订", "script.review", "剧本创作中", need_reason=True),
    ),
    "生产准备中": (
        GateAction("confirmPlan", "固化镜头计划", "director.write", "生产中", tone="primary"),
        GateAction("terminate", "终止项目", "project.manage", "已终止", need_reason=True),
    ),
    "生产中": (
        GateAction("toPost", "转入后期", "production.write", "后期制作中", tone="primary"),
        GateAction("pause", "暂停派发", "project.manage", "已暂停", need_reason=True),
        GateAction("terminate", "终止项目", "project.manage", "已终止", need_reason=True),
    ),
    "后期制作中": (
        GateAction("submitQc", "提交质量检测", "post.write", "质量检测中", tone="primary"),
        GateAction("pause", "暂停派发", "project.manage", "已暂停", need_reason=True),
    ),
    "质量检测中": (
        GateAction("passQc", "检测通过", "quality.operate", "待最终审核", tone="primary"),
        GateAction(
            "failQc", "存在阻断项 · 退回后期", "quality.operate", "后期制作中", need_reason=True
        ),
    ),
    "待最终审核": (
        GateAction("finalApprove", "终审通过", "final.review", "已完成", tone="primary"),
        GateAction("finalReject", "终审退回", "final.review", "后期制作中", need_reason=True),
    ),
    "已完成": (
        GateAction("deliver", "生成并交付", "delivery.execute", "已交付", tone="primary"),
        GateAction("finalReject", "退回返工", "final.review", "后期制作中", need_reason=True),
    ),
    "已交付": (GateAction("archive", "归档资产", "project.manage", "已归档", tone="primary"),),
    "已归档": (),
    "已暂停": (GateAction("resume", "恢复生产", "project.manage", "__prev__", tone="primary"),),
    "异常中": (
        GateAction("resume", "恢复生产", "project.manage", "__prev__", tone="primary"),
        GateAction("terminate", "终止项目", "project.manage", "已终止", need_reason=True),
    ),
    "已终止": (),
}

# The status a paused project resumes into when it has no recorded previous state.
DEFAULT_RESUME_STATUS = "生产中"


def normalize_status(status: str) -> str:
    return LEGACY_STATUS_MAP.get(status, status)


def find_action(status: str, action: str) -> GateAction | None:
    for candidate in GATE_ACTIONS.get(normalize_status(status), ()):
        if candidate.key == action:
            return candidate
    return None


def resolve_target(status: str, action: GateAction, previous_status: str | None) -> str:
    if action.next != "__prev__":
        return action.next
    previous = normalize_status(previous_status or "")
    return previous if previous in PROJECT_STATUSES else DEFAULT_RESUME_STATUS


def allowed_actions(status: str, permissions: frozenset[str] | set[str]) -> list[dict]:
    return [
        action.as_dict()
        for action in GATE_ACTIONS.get(normalize_status(status), ())
        if action.permission in permissions
    ]
