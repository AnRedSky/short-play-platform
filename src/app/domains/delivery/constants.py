"""Post-production and delivery domain constants."""

TIMELINE_DRAFT = "draft"
TIMELINE_FROZEN = "frozen"
TIMELINE_SUPERSEDED = "superseded"

TIMELINE_LABELS = {
    TIMELINE_DRAFT: "编辑中",
    TIMELINE_FROZEN: "已冻结",
    TIMELINE_SUPERSEDED: "已替代",
}

OUTPUT_STATUS = "已输出"
FINAL_APPROVED = "approved"
FINAL_REJECTED = "rejected"
FINAL_LABELS = {FINAL_APPROVED: "通过", FINAL_REJECTED: "退回"}

PACKAGE_FROZEN = "已冻结"

POST_STATUSES = frozenset({"后期制作中"})
