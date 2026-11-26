"""Default billing rules used when no explicit ``cost_rates`` row exists."""

from decimal import Decimal

DEFAULT_UNIT_PRICES: dict[str, Decimal] = {
    "text_generation": Decimal("3.5000"),
    "image_generation": Decimal("6.0000"),
    "video_generation": Decimal("38.0000"),
    "tts": Decimal("12.0000"),
    "asr": Decimal("10.0000"),
    "music_generation": Decimal("20.0000"),
}
DEFAULT_FAILURE_RATIO = Decimal("0.5000")
DEFAULT_CURRENCY = "CNY"

CAPABILITY_LABELS: dict[str, str] = {
    "text_generation": "文本生成",
    "image_generation": "图片生成",
    "video_generation": "视频生成",
    "tts": "语音合成",
    "asr": "语音识别",
    "music_generation": "音乐生成",
}

BILLING_STATUS_CONFIRMED = "已确认"
BILLING_STATUS_PENDING = "待对账"
BILLING_STATUS_DISPUTED = "争议"

BUDGET_STATE_NORMAL = "正常"
BUDGET_STATE_WARNING = "预警"
BUDGET_STATE_EXCEEDED = "超限"
BUDGET_STATE_UNSET = "未设置"
