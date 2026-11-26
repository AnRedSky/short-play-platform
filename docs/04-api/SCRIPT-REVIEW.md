# 剧本审核（B-04 实施记录）

## 接口

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/script-versions/{version_id}/reviews` | `script.review` + 项目成员 | 审核通过/退回，并迁移项目状态 |
| GET | `/scripts/{script_id}/reviews` | `script.review` + 项目成员 | 按时间倒序返回审核记录 |

请求：

```json
{ "decision": "approve", "reason": "" }
```

`decision` 仅允许 `approve` / `reject`；`reject` 必须填写 `reason`，否则返回 `422 REASON_REQUIRED`。

## 事务与单次迁移

一次请求在同一个数据库事务内完成四件事，最后只提交一次：

1. 写入 `script_reviews`（`script_version_id` 唯一，数据库层禁止第二次审核）；
2. 更新 `script_versions.status` 与 `scripts.status`（`approved` / `rejected`）；
3. 调用项目状态机 `approveScript` / `rejectScript`，把项目从 `待剧本审核` 迁移到 `生产准备中` / `剧本创作中`；
4. 写入项目迁移审计和剧本审核审计。

任一环节失败（例如缺原因、项目状态不符）都回滚，审核记录、剧本状态与项目状态不会出现半写。重复提交同一版本返回 `409 REVIEW_ALREADY_DECIDED`，不会二次迁移项目。

## 前置状态

项目必须处于 `待剧本审核`，否则返回 `409 ILLEGAL_TRANSITION`（details 带当前状态与 `reviewScript`）。剧本版本先由创建接口写入，审核不负责创建版本。

## 验收用例

`tests/domains/creation/test_script_review.py`

- 通过：审核行 + 版本 approved + 项目 `生产准备中`，重复审核 409 且只有一条迁移记录；
- 退回缺原因：422，且审核行、剧本状态、审计全部回滚，项目仍停在 `待剧本审核`；
- 退回带原因：项目回到 `剧本创作中`，版本 rejected；
- 非成员 403；成员但无 `script.review` 403。
