# 成本台账与预算（B-06）

成本域以 B-05 的 `usage_records` 作为**唯一记账来源**，不新增第二张成本表。每个生成 attempt 最多一条台账，成功、失败、租约回收、运行中取消都落账。

## 一、台账结构

`usage_records` 在原有调用记录字段上增加：

| 字段 | 说明 |
| --- | --- |
| `attempt_id` | 唯一，`uq_usage_records_attempt`；一次 attempt 一条账 |
| `project_id` / `task_id` | 归属项目与任务 |
| `cost_rate_id` | 命中的定价行，未命中为空并走默认单价 |
| `code` / `capability` | 台账号与能力族 |
| `unit` / `quantity` / `unit_price` | 计量单位、数量、单价 |
| `estimated_amount` / `amount` | 预估额与实际发生额 |
| `currency` | 当前 CNY |
| `failure` / `billing_status` / `billing_basis` | 是否失败、已确认/待对账、provider/失败估算 |
| `episode_number` / `shot_id` | 分集与镜头定位 |

`cost_rates` 保存 provider/model/capability/单位/单价/币种/失败计费比例/生效时间/启停。当前无配置时使用默认单价：文本 3.5、图片 6、视频 38、TTS 12、ASR 10、音乐 20 元/单位；失败按 50% 计费。

## 二、记账路径

- 成功：按 单价 × 数量全额，`billing_status=已确认`；
- 失败：按 `failure_ratio` 计失败成本，`billing_status=待对账`；
- 运行中取消：先落账再转 `cancel_requested`，已发生成本不丢；
- 租约过期回收：为过期 attempt 补记失败成本；
- 幂等：`record_attempt_usage()` 以 `attempt_id` 为键，重复回调或重复派发不新增台账。

每次 attempt 结束调用 `refresh_project_totals()`：项目行锁后全量重算 `actual` 与 `estimated`，并由项目 DTO 的 `actual/estimated/budgetState` 直接返回，避免并发增量漂移。

## 三、预算

- `budget=0` 视为未设置，不限流；
- `actual >= budget` 时创建任务抛 `409 BUDGET_EXCEEDED`，`details.budgetState=超限`；
- 状态：未设置、正常、预警（≥85%）、超限（≥100%）；
- 预算检查位于幂等命中之后、真正入队之前；同一 `Idempotency-Key` 的重复请求即使预算已满仍返回原任务；
- 调整预算不得低于已发生 `actual`。

## 四、接口

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/costs?project=&status=&cap=&search=&page=&page_size=` | 台账列表，按可见项目过滤 | `cost.read` |
| GET | `/costs/summary?project=` | 汇总、失败额、按能力分布 | `cost.read` |
| GET | `/budgets` | 企业/项目预算行，企业与项目汇总一致 | `cost.read` |
| GET | `/projects/{project_id}/costs` | 项目台账 | `cost.read` |
| PATCH | `/projects/{project_id}/budget` | 调整项目预算，不得低于 actual | `cost.manage` |

跨项目查询返回 404；预算行输出 `scope/name/project/total/used/reserve/state/owner/currency`。

## 五、验证

`tests/domains/costs/test_router.py` 5 条：成功+失败 attempt 与台账一一对应并回写项目 `actual=5.25/estimated=7.0`；重试产生 attempt 1/2 两条账；预算 3.4 时下一次创建 409；预算页/summary 与台账一致；重复 dispatch 不新增 usage。

```powershell
$env:APP_ENV='test'
$env:DATABASE_URL='postgresql+psycopg://postgres:postgres@localhost:6432/short_play_test'
uv run alembic upgrade head
uv run pytest -q tests/domains/costs
```

本地结果：成本域 5 passed；后端全量 154 passed。
