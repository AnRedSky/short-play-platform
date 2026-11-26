# 项目域契约（B-01 定稿，B-02/B-03/B-05 已实施）

机器可读契约：[`openapi-projects.yaml`](./openapi-projects.yaml)。基线为前端 mock 的 `/projects` 系列响应，目标是不改页面、只替换 `web/src/services/projects/index.ts` 的实现。

B-02/B-03/B-04 实现记录见第七节，B-01 DTO 与设定持久化见第八节，[`SCRIPT-REVIEW.md`](./SCRIPT-REVIEW.md)。

## 一、字段裁决

| 页面字段 | 后端来源 | 规则 |
| --- | --- | --- |
| `id` | `Project.code` | 对外稳定业务编号（如 `SP-26031`）。 |
| `record_id` | `Project.id` | 数据库 UUID，仅用于项目子资源路由与服务层寻址，不用于展示。 |
| `name` | `Project.title` | 展示标题。后端不再同时返回 `code`/`title`。 |
| `ownerId` / `owner` | `Project.owner_user_id` / `User.full_name` | `ownerId` 用于权限与筛选，`owner` 为展示名；创建人自动成为 owner。 |
| `status` / `phase` | 状态机 | `status` 为 15 状态枚举；`phase` 由服务端 `STATUS_PHASE` 映射，权威阶段取 `workflow.stages`。 |
| `budget` / `actual` / `estimated` | 项目成本列 | JSON 输出 number，单位元；`budgetState` 按 actual/budget 的 85%/100% 输出“正常/预警/超限”。 |
| `created` / `updated` | 项目时间 | `YYYY-MM-DD` / `YYYY-MM-DD HH:mm`，避免页面格式化改动。 |
| `genre` / `audience` / `episodes` / `duration` / `ratio` / `language` / `style` / `constraints` | 项目设定列 | 创建与 PATCH 均可落库，未知字段返回 422，不再静默忽略。 |

`ProjectRead` 已收敛为上述页面 DTO；`serialize_project()` 是唯一序列化边界，列表、创建、详情、PATCH、状态迁移共用。

## 二、接口清单

| 方法 | 路径 | 用途 | 权限 |
| --- | --- | --- | --- |
| GET | `/projects` | 列表、分页、搜索、状态/负责人/题材筛选 | `project.read` |
| GET | `/projects/{record_id}` | 项目详情 | `project.read` + 项目成员 |
| GET | `/projects/{record_id}/summary` | 详情页聚合：项目 + 阶段 + scripts/episodes/assets/costs/tasks/reviews/notifications | `project.read` |
| GET | `/projects/{record_id}/workflow` | 阶段进度、`allowed_actions`、KPI | `project.read` |
| GET | `/projects/{record_id}/timeline` | 审计动作 + 审核记录合并倒序 | `project.read` |
| POST | `/projects/{record_id}/transitions` | 状态迁移（B-02 实现） | 动作级 `action.permission` |

统一返回 `{data, meta}`；错误返回 `{error:{code,message,details,request_id}}`。列表 `meta` 固定 `total/page/page_size`。

**路径裁决**：项目子资源路由当前只接受数据库 UUID（`record_id`）。页面持有的是业务编号 `id`，B-13 切换真实 API 时由 service 缓存列表结果并做 `id → record_id` 映射，页面不拼路径。

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

1. `summary`、`workflow`、`timeline` 三个聚合接口尚未在真实后端注册，需按本契约新增只读路由。
2. 项目子资源路由只接受 UUID，页面业务编号需在 service 层映射为 `record_id`；B-13 前统一。
3. `ProjectRead` 尚未输出 `organization_id` 与 `members`；`deptId`/`dept` 暂为空字符串，待 B-10 组织授权补齐。
4. `actual`/`estimated` 当前只能由 PATCH 或后续成本域写入，B-06 完成后由调用记账驱动。
5. E2E 目前只跑 mock；B-13 完成后增加真实 API 契约测试，对同一组 service 函数分别断言 mock 与真实响应形状一致。

## 六、验收

- `openapi-projects.yaml` 可被 OpenAPI 3.1 解析，6 条路径、20 个 schema。
- 每个响应字段都能在 mock 响应中找到同名同类型来源。
- 前端 `projectApi` 的 `list/detail/summary/workflow/timeline/transition` 六个函数与契约一一对应。
- B-02/B-03 的请求、错误码、权限码已在本文件冻结，后续实现不得改形状。

## 七、B-02/B-03 实施记录（2026-11-26）

### 状态机

- 15 个中文状态直存 `projects.status`；旧五态在迁移 `0008` 回填并在读取时兼容；
- `POST /projects/{id}/transitions` 接受 `action / reason / expected_state`，服务端从 `status + action` 重算合法迁移；
- 错误码：`409 ILLEGAL_TRANSITION`、`409 STATE_CONFLICT`、`422 REASON_REQUIRED`、`403 PERMISSION_DENIED`；
- `Idempotency-Key` 落库到 `project_transitions`，同一项目同一 key 返回首次结果，不重复写审计；
- 暂停时记录 `previous_status`，`resume` 精确恢复；终止、交付、归档、退回、暂停必须填写原因；
- `PATCH /projects/{id}` 只允许 `title/name/summary/genre/audience/episodes/duration/ratio/language/style/constraints/budget`，请求体出现 `status` 或未知字段返回 422。

### 权限

- 权限目录收敛为 36 个点号码（`src/app/domains/roles/constants.py`），旧的冒号码全部移除；
- 六个身份模板 `ops/admin/dept/owner/staff/auditor` 与前端 mock 角色权限逐码一致；
- 所有项目资源接口执行接口权限 + 项目成员双重校验；`project.manage` 才可绕过成员检查，URL 的 `project_id` 不构成授权；
- 验收：`tests/domains/roles/test_permission_matrix.py` 覆盖 6 身份 × 56 路由 = 336 个判定，与前端快照逐项一致；`tests/domains/projects/test_transitions.py` 覆盖成员缺失、权限缺失、非法迁移、重复提交与缺原因。

### 迁移与测试

- `0008_project_state_machine.py`：状态回填、`previous_status`、迁移明细/幂等表；
- `0009_script_reviews.py`：剧本审核表（B-04）；
- 本地全量后端：`133 passed`（独立测试库 + `APP_ENV=test`）。

## 八、B-01 DTO 与项目设定持久化（2026-11-26）

### 模型与迁移

- `projects` 新增 `owner_user_id`（FK `users`）与 `genre/audience/episodes/duration/ratio/language/style/constraints/budget/actual/estimated/done_episodes/delivered_episodes/quality/script_version/timeline_version`；
- `owner` 为 `lazy="joined"` 关系，供 DTO 读取负责人展示名；
- 迁移 `0010_project_dto_fields` 加列、加 owner 索引，并从有效 `project_members(project_role='owner')` 回填 `owner_user_id`；
- `get_project_for_update` 使用 `.with_for_update(of=Project)`，避免 joined eager load 触发 PostgreSQL 外连接锁错误。

### 接口行为

- 创建接口接受 `title` 或 `name`，并可直接写入全部 brief 字段；创建人写入 `owner_user_id`；
- `ProjectRead` 输出 `record_id + id(=code) + name(=title) + brief + status/phase + done/delivered/quality + ownerId/owner + budgetState + created/updated + scriptVersion/timelineVersion`；
- PATCH 白名单落库 brief 字段，`name` 统一映射为 `title`，未知字段返回 422；
- 列表、创建、详情、PATCH、状态迁移全部经由 `serialize_project()`，字段形状不再分叉；
- 状态迁移写库后先 `flush + refresh` 再序列化，`updated` 不返回旧值。

### 测试

- `tests/domains/projects/test_project_dto.py` 3 条：DTO 形状与日期格式、brief PATCH 持久化、未知字段 422；
- 项目域 + 创作域回归 20 passed；随后全量后端 143 passed。

## 九、B-05 生成队列（2026-11-26）

实现细节与回调幂等规则见 [`GENERATION-QUEUE.md`](./GENERATION-QUEUE.md)。
