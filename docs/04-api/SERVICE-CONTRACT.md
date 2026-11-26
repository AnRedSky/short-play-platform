# Service 契约测试（B-14）

前端 `web/src/services/` 的每个导出函数都有请求 / 响应契约。测试不依赖页面，直接调用 service，因此 mock 与 real 切换只在 `api` 层发生，页面 DTO 不变。

## 一、覆盖范围

`web/tests/unit/service-contract.test.ts` 覆盖 13 个 service 模块、58 个函数：

| 模块 | 函数数 | 代表端点 |
| --- | ---: | --- |
| access | 1 | `/identities` |
| analytics | 1 | `/analytics/{scope}` |
| assets | 3 | `/assets`、`/asset-categories` |
| creation | 9 | `/briefs`、`/scripts`、`/reviews` |
| director | 2 | `/shots`、`/generation/tasks` |
| ops | 2 | `/ops/overview`、`/ops/config` |
| orgs | 3 | `/orgs/enterprise`、`/departments`、`/users` |
| post | 10 | `/timelines`、`/episodes`、`/deliveries` |
| projects | 11 | `/projects`、摘要、工作流、时间线、迁移 |
| quality | 4 | 报告、问题、层级、执行 |
| spec | 1 | 规格页通用 endpoint |
| video | 6 | 项目级任务、attempts、retry/cancel、dispatch |
| workspace | 4 | 首页、成本、通知、发起任务 |

覆盖率由代码保证：测试会枚举 `services` 对象的全部导出方法，与契约表中的函数名逐一比对，新增或漏测函数会直接失败。

## 二、断言口径

每个函数在 `mock` 与 `real` 分支各执行一次：

1. **请求快照**：记录 method、完整 path + query、必要 header。项目子资源在 mock 使用业务码，在 real 使用 `record_id`；视频任务号在 real 使用 UUID。
2. **响应断言**：同一个 `assertResult()` 检查 envelope 或数组形状。分页统一断言 `rows/total/page/page_size`；行字段按页面实际消费的 `rowKeys` 校验。
3. **结构快照**：把页面的稳定结构（envelope 字段、行字段类型）写入 `web/tests/unit/__snapshots__/service-contract.test.ts.snap`，mock/real 的结构签名必须相等。
4. **真实路由**：`tests/contracts/test_service_surface_contract.py` 校验 service real 分支依赖的 FastAPI 路由和成功响应确实存在。

运行：

```powershell
cd web
npm test
```

```powershell
$env:PYTHONPATH='src'
.\.venv\Scripts\python.exe -m pytest tests/contracts/test_service_surface_contract.py -q
```

## 三、本轮修正

契约测试暴露并修正了两处 mock 契约：

- `GET /generation/tasks/{id}/attempts` 原先直接返回种子行，缺少页面依赖的 `n` 与 `fail`；现在补齐为 `n = attempt_number 或序号`、`fail = reason 或 —`，与 real 的 `toAttemptRow()` 输出一致。
- 单条通知已读原先只注册 `GET /notifications/{id}/read`，而 `/notify/inbox` 实际发 `POST`；mock 已改为 POST，并新增回归测试。

## 四、真实 API 缺口

以下 service 函数已纳入契约测试，但后端尚未注册对应路由或路径尚未对齐。它们暂不能做在线真实响应断言，属于后续 B 系列工作：

| 模块 | 缺口 |
| --- | --- |
| projects | `/projects/{id}/summary`、`/workflow`、`/timeline`、`/project-states`、`/stage-pipeline` 未注册 |
| creation | `/briefs`、`/brief-modes`、`/scripts`、`/script-diffs`、`/review-checklist` 未注册；`/scripts/{id}/review` 与 `/reviews` 仍是项目级或版本级路径 |
| assets | `/assets` 列表与 `/asset-categories` 未注册，现有接口是项目级资产与单资产读取 |
| director | `/shots` 全局列表未注册 |
| post | `/timelines`、`/tracks`、`/episodes`、`/delivery-checklist` 全局路径未对齐；`/deliveries` 仅读取，创建走项目子资源 |
| orgs | `/orgs/enterprise` 未注册；部门真实路径为 `/organizations/departments` |
| analytics | `/analytics/{scope}` 未注册 |
| ops | `/ops/config` 未注册 |
| workspace | `/workspace/home` 未注册 |

这些缺口不阻塞 mock 演示与当前真实链路（项目、视频任务、质检、通知、审计、运维），但意味着 B-14 的“真实响应”目前只对已注册端点成立。下一步应在补齐路由时同步更新本表与 `SUPPORTED_SERVICE_ROUTES`。
