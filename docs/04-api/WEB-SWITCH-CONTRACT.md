# 前端切换收口契约（B-13）

页面继续使用中文状态与业务码；`services/` 内部完成项目 UUID、任务 UUID、能力族与参数映射。页面 0 改动。

## 一、项目引用

`web/src/services/projects/registry.ts` 缓存 `项目 code → record_id`：

- `projectApi.list()` 拿到列表后登记每个项目；`create/update` 返回体也登记；
- `projectStore` 改为走 `projectApi.list`，不再直接 `http.list('/projects')`；
- 项目子资源、质量执行、生成任务路径统一经 `projectRef(id)` 取 UUID；mock 模式原样返回业务码；
- 若映射尚未建立，回退原值由后端返回明确 404/422，不静默拼错路径。

## 二、视频任务映射

`web/src/services/video/contract.ts` 收敛页面与后端的差异。

页面状态 → 后端状态：

| 页面 | 后端 |
| --- | --- |
| 排队中 | `pending/queued/retry_wait/paused` |
| 执行中 | `running/cancel_requested` |
| 已完成 | `succeeded` |
| 失败 | `failed/cancelled` |

页面类型 → capability：

| 页面 kind | capability |
| --- | --- |
| 视频生成 | `video_generation` |
| 音频合成 | `tts` |
| 口型校验 | `video_generation` |
| 参考资产校验 / 视觉理解 | `image_generation` |
| 推理 | `text_generation` |

新建任务：`{project, ep, shot, kind, priority, est}` → `{capability, prompt, parameters:{episode_number, shot_label, scene_label, priority, est_seconds, kind_label, stage, input, output}, model_code, provider_code, max_attempts}`，并带 `Idempotency-Key`。

任务列表 DTO → 页面行：状态、`kind_label`、`episode_number`、`shot_label`、`scene_label`、`priority`、`est_seconds`、`attempt_count/max_attempts`、`created_at`、`error_message`；任务显示号 `T-XXXXXXXX` 与后端 UUID 同时缓存，`attempts/retry/cancel` 用显示号也能解析回 UUID。

`TaskAttemptRead` 的 `started_at/finished_at` 已暴露，抽屉按 `n/at/status/fail` 展示。

## 三、服务切换点

- `videoApi`：mock 保留 `/generation-tasks`；真实走 `/projects/{record_id}/generation/tasks`、`/generation/tasks/{uuid}`；
- `qualityApi`：报告/问题/层级对齐真实路径，页面“执行质检”转 `POST /projects/{record_id}/quality/runs`；
- `projectApi`：列表/更新/摘要/工作流/时间线/迁移统一经过 `projectRef`；
- `http.post/patch` 增加可选 headers，用于 `Idempotency-Key`。

## 四、已知缺口

1. 成本页预算编辑仍发 `PATCH /budgets/{scope}`，真实只有 `PATCH /projects/{id}/budget`；需追加 service 映射。
2. `/ops/queue`、`/tasks/*` 等规格页仍按全局 `/generation-tasks` 取数，真实后端目前只有项目级任务列表；需补全局任务接口或 service 聚合。
3. 质检页面请求不带检查项，真实后端按规则默认 PASS；自动检测器接入前，报告只能证明链路与回退映射可用。
4. 视频页“推进队列”在真实模式映射为一次 `dispatch`，不手工伪造任务完成状态。

## 五、验证

`web/tests/unit/video-contract.test.ts` 7 条覆盖状态、能力、参数、任务号缓存、attempt 字段与幂等键；前端单测 21 passed，`npm run check`、`npm run test:e2e`、`npm run check:size` 全绿。
