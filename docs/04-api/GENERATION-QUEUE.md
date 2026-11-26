# 生成任务与队列（B-05）

生成任务从“请求内同步执行”改为“入队 + 显式派发 + 供应商回调 + 超时回收”。所有状态变更在调用方事务内完成，外部 HTTP 请求不直接执行生成。

## 一、状态

`pending → queued → running → succeeded / retry_wait / failed / cancel_requested / cancelled`，另有 `paused`。

- 可领取：`queued`、`retry_wait`，且 `next_run_at <= now`；
- 可暂停：`queued`、`retry_wait`、`paused`；
- 终态：`succeeded`、`failed`、`cancelled`；
- 运行中取消写 `cancel_requested`，结果落地后转 `cancelled`，不覆盖已发生的结果或成本。

## 二、队列表结构

`generation_tasks` 新增：`max_attempts`（默认 3，上限 10）、`attempt_count`、`next_run_at`、`lease_expires_at`、`last_provider_task_id`、`last_callback_at`、`paused_at`，并加 `(status, next_run_at)` 索引。

`provider_callback_events` 以 `(task_id, callback_id)` 唯一约束保存回调：`event_type / provider_task_id / attempt_number / payload / applied / outcome / occurred_at`。

迁移：`0011_generation_queue`。

## 三、接口

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| POST | `/projects/{project_id}/generation/tasks` | 创建并入队，返回 201；`Idempotency-Key` 必填 | `creation.write` |
| GET | `/projects/{project_id}/generation/tasks` | 按 `status/page/page_size` 过滤 | `task.read` |
| GET | `/generation/tasks/{task_id}` | 任务详情与 attempts | `task.read` |
| POST | `/generation/tasks/{task_id}/pause` | 暂停排队/重试任务 | `task.operate` |
| POST | `/generation/tasks/{task_id}/resume` | 恢复并重新入队 | `task.operate` |
| POST | `/generation/tasks/{task_id}/retry` | 手工重试 `failed/retry_wait`，预算耗尽 409 | `task.operate` |
| POST | `/generation/tasks/{task_id}/cancel` | 取消；运行中转 `cancel_requested` | `task.operate` |
| POST | `/generation/queue/dispatch` | 领取到期任务并调用供应商，默认 10 条 | `platform.config` |
| POST | `/generation/queue/recover` | 回收租约过期任务，默认 20 条 | `platform.config` |
| POST | `/generation/providers/{provider_code}/callbacks` | 供应商回调 | `platform.config` |

创建响应 `meta` 为 `{created, queued}`；dispatch 返回 `{claimed, tasks}`；recover 返回 `{recovered, tasks}`。

## 四、派发与重试

- `dispatch_tasks` 使用 `FOR UPDATE SKIP LOCKED` 领取到期任务，attempt+1、写 `TaskAttempt`、置 `running`、租约 300 秒；
- 成功写结果与 `UsageRecord`；
- 仅 `PROVIDER_UNAVAILABLE`、`TIMEOUT`、`RATE_LIMITED` 自动重试，退避 30/120/480 秒；
- 次数耗尽转 `failed`；非可重试错误立即 `failed`；
- 手工 retry 仅在 `failed/retry_wait` 且 `attempt_count < max_attempts` 时可用，否则 `409 TASK_NOT_RETRYABLE`。

## 五、回调乱序与重复幂等

回调体关键字段：`callback_id`、`task_id`、`event(accepted|completed)`、`provider_task_id`、`attempt_number`、`status(succeeded|failed)`、`output`、`error{code,message,retryable}`、`usage`、`occurred_at`。

判定顺序：

1. `(task_id, callback_id)` 已存在：直接返回首次存储的 `outcome`，并标记 `duplicate=true`，不重复写结果、成本或审计；
2. `occurred_at` 早于 `last_callback_at`：返回 `applied=false, reason=STALE_CALLBACK`；
3. 任务已终态：`reason=TASK_TERMINAL`，不覆盖结果；
4. `accepted` 仅在 `running` 时应用；`completed` 仅在 `running/cancel_requested` 时应用；
5. 供应商不匹配返回 422；attempt 不存在返回 `ATTEMPT_NOT_FOUND`。

先到 `completed` 后再到更晚的 `accepted` 不会把任务回退；重复 `completed` 不二次记账。

## 六、超时回收

`POST /generation/queue/recover` 扫描租约过期的 `running` 任务：把当前 attempt 标记 `failed/PROVIDER_TIMEOUT`，按剩余预算转 `retry_wait` 或 `failed`。回收不假定成功，不补写结果。

## 七、工作流兼容

工作流节点仍需要同步结果来推进 DAG，调用 `execute_task_now()` 在节点事务内执行一次，并令该任务 `max_attempts=1`，避免失败任务残留在共享队列被再次领取。节点自身按 `max_attempts` 重新建任务。

## 八、验证

`tests/domains/generation/test_router.py` 16 条覆盖创建/派发、幂等创建与缺失幂等键、失败重试与预算耗尽、暂停恢复、取消、回调乱序/重复、供应商不匹配、租约回收、鉴权与跨项目镜头拒绝。

```powershell
$env:APP_ENV='test'
$env:DATABASE_URL='postgresql+psycopg://postgres:postgres@localhost:6432/short_play_test'
uv run alembic upgrade head
uv run pytest -q tests/domains/generation
```

本地结果：生成域 16 passed，后端全量 143 passed。

## 九、前端切换待办

页面当前仍通过 mock 的 `/generation-tasks` 与中文状态读写；真实服务需要新增 `services/video/contract.ts`，把页面 `project/ep/shot/kind/priority/est` 映射为后端 `project(record_id)/capability/prompt/parameters`，并把任务状态英中互转。此项随 B-13 一起切换，页面不改。
