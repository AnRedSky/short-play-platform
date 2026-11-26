# 质检规则与报告（B-07）

质检域以规则集驱动报告：规则项给出 PASS / REVIEW_REQUIRED / FAIL，任一 FAIL 即阻断，并在同一事务内把项目从“质量检测中”退回“后期制作中”。

## 一、规则集

`quality_rules` 种子化 16 条，四层各 4 条：资产级 `Q-A01..A04`、镜头级 `Q-S01..S04`、单集级 `Q-E01..E04`、整剧级 `Q-W01..W04`。每条含维度、严重度、是否阻断、处置动作、是否自动修复。

- 规则必须属于当前层级，跨层规则 422 `QUALITY_RULE_UNKNOWN`；
- 同一规则在一次运行内不得重复检查，重复 422；
- 请求未提供的规则默认 PASS，便于先接报告链路、后接自动检测器。

## 二、报告判定

1. 项目必须处于“质量检测中”，否则 409 `QUALITY_PROJECT_NOT_IN_CHECK`；
2. 所有 FAIL 都视为阻断项；
3. 任一 FAIL → 报告 FAIL；否则有 REVIEW_REQUIRED → REVIEW_REQUIRED；否则 PASS；
4. 报告、问题项、项目迁移、审计在同一事务提交；
5. FAIL 时自动调用状态机 `failQc`：质量检测中 → 后期制作中，原因固定为“`{报告号}` 存在阻断项，自动退回后期：`{note}`”。

报告保存层级、对象、版本、检查项/问题/复核/阻断数量、engine、ruleset_version、note、actor。问题项保存规则码、维度、位置、严重度、blocking、处置动作、auto_fix、状态“待处理”。

## 三、接口

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/quality-levels` | 四个层级与对象口径 | `quality.read` |
| GET | `/quality/rules?level=` | 规则集 | `quality.read` |
| GET | `/quality-reports?project=&level=` | 报告列表，按可见项目过滤 | `quality.read` |
| GET | `/quality-issues?report=` | 报告问题项 | `quality.read` |
| POST | `/projects/{project_id}/quality/runs` | 执行质检并生成报告 | `quality.operate` |

报告字段贴合页面：`id/object/level/version/result/items/issues/review/fail/engine/note/at`；问题项：`report/dim/where/level/action/auto/blocking/status`。

## 四、验证

`tests/domains/quality/test_router.py` 6 条：单集 FAIL 阻断生成 1 条问题并回退后期，审计动作 `failQc` 且原因含“阻断项”；REVIEW_REQUIRED 不回退；整剧级无检查项按规则全 PASS；跨层规则 422；报告按项目/层级过滤；项目不在质量检测中 409。

```powershell
$env:APP_ENV='test'
$env:DATABASE_URL='postgresql+psycopg://postgres:postgres@localhost:6432/short_play_test'
uv run alembic upgrade head
uv run pytest -q tests/domains/quality
```

本地结果：质检域 6 passed；后端全量 154 passed。
