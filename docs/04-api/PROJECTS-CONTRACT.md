# 项目域契约（B-01 定稿草案）

机器可读契约：[`openapi-projects.yaml`](./openapi-projects.yaml)。基线为前端 mock 的 `/projects` 系列响应，目标是不改页面、只替换 `web/src/services/projects/index.ts` 的实现。

## 一、字段裁决

| 页面字段 | 后端来源 | 规则 |
| --- | --- | --- |
| `id` | `Project.code` | 对外稳定业务编号（如 `SP-26031`）。数据库 UUID 不进入页面，内部以 `record_id` 保存。 |
| `name` | `Project.title` | 展示标题。后端不得同时返回 `code`/`title` 与 `id`/`name` 两套字段。 |
| `ownerId` / `owner` | 项目负责人 | `ownerId` 用于权限与筛选，`owner` 为展示名。 |
| `status` / `phase` | 状态机 | `status` 为 15 状态枚举；`phase` 仅为展示缓存，权威阶段取 `workflow.stages`。 |
| `budget` / `actual` / `estimated` | 成本域 decimal | JSON 输出 number，单位元；不得输出带货币符号的字符串。 |
| `created` / `updated` | 项目时间 | 保持页面现有 `YYYY-MM-DD` / `YYYY-MM-DD HH:mm`，避免页面格式化改动。 |

现有后端 `ProjectRead` 只有 `id(UUID)/organization_id/code/title/summary/status`，B-01 实施时新增序列化 DTO，保留 UUID 在内部，对外输出上述字段。迁移期间旧客户端继续读 `code/title` 的兼容期不超过一个迭代。

## 二、接口清单

| 方法 | 路径 | 用途 | 权限 |
| --- | --- | --- | --- |
| GET | `/projects` | 列表、分页、搜索、状态/负责人/题材筛选 | `project.read` |
| GET | `/projects/{id}` | 项目详情 | `project.read` + 项目成员 |
| GET | `/projects/{id}/summary` | 详情页聚合：项目 + 阶段 + scripts/episodes/assets/costs/tasks/reviews/notifications | `project.read` |
| GET | `/projects/{id}/workflow` | 阶段进度、`allowed_actions`、KPI | `project.read` |
| GET | `/projects/{id}/timeline` | 审计动作 + 审核记录合并倒序 | `project.read` |
| POST | `/projects/{id}/transitions` | 状态迁移（B-02 实现） | 动作级 `action.permission` |

统一返回 `{data, meta}`；错误返回 `{error:{code,message,details,request_id}}`。列表 `meta` 固定 `total/page/page_size`。

## 三、状态机边界（供 B-02）

15 状态：草稿、创意策划中、剧本创作中、待剧本审核、生产准备中、生产中、后期制作中、质量检测中、待最终审核、已完成、已交付、已归档、已暂停、异常中、已终止。

- 动作合法性只由服务端 `status + action` 决定；前端 `allowed_actions` 仅用于渲染。
- 非法迁移返回 `409 ILLEGAL_TRANSITION`；权限不足返回 `403`；缺原因返回 `422 REASON_REQUIRED`。
- `expected_state` 与当前状态不一致返回 `409 STATE_CONFLICT`，不得静默推进。
- `Idempotency-Key` 必须落库；同一 key 重复提交返回首次结果，不双写审计、不重复生成交付包。
- 终止、交付、归档为不可逆动作，必须写审计并校验原因（交付按现有规则生成交付包）。

## 四、权限边界（供 B-03）

- 接口级：每个 endpoint 声明权限码；项目资源同时校验成员关系，URL 的 `project_id` 不作为授权依据。
- 路由级：6 类身份 × 56 路由的可见性由 `GET /auth/me` 的权限集裁决，前端 `session.can()` 只做 UX 预判。
- 切换身份仅允许测试环境；生产环境移除 `/mock/identity` 等价入口。
- 权限矩阵验收沿用 `web/tests/e2e/__snapshots__/permission-matrix.spec.ts/permission-matrix.json`（owner 41、staff 35、admin 31、dept 24、auditor 21、ops 6）。

## 五、与现有实现的差距

1. `GET /projects` 当前返回 `code/title/summary/status`，缺 `name/genre/episodes/budget/owner/...`；需扩展 DTO，不改表结构即可从现有列与关联取数。
2. `summary`、`workflow`、`timeline` 三个聚合接口尚未在真实后端注册，需按本契约新增只读路由。
3. 真实后端状态写入走 `PATCH /projects/{id}`，绕过状态机；B-02 必须收敛到 `POST /transitions`，并限制 PATCH 不允许改 `status`。
4. E2E 目前只跑 mock；B-01 完成后增加契约测试，对同一组 service 函数分别断言 mock 与真实响应形状一致。

## 六、验收

- `openapi-projects.yaml` 可被 OpenAPI 3.1 解析，6 条路径、20 个 schema。
- 每个响应字段都能在 mock 响应中找到同名同类型来源。
- 前端 `projectApi` 的 `list/detail/summary/workflow/timeline/transition` 六个函数与契约一一对应。
- B-02/B-03 的请求、错误码、权限码已在本文件冻结，后续实现不得改形状。
