# 通知收件箱与审计只追加（B-11）

通知把业务门禁转成“可定位、可处理”的站内待办，审计保存特权动作的不可改写证据。两者共享同一组织与操作者上下文。

## 1. 通知接口

| Method | Path | Permission | 说明 |
|---|---|---|---|
| GET | `/api/v1/notifications` | `notify.handle` | 当前用户收件箱；支持 `project`（项目 code 或 UUID）、`unread`、`state`、`type`、`q`、`limit` 或 `page/page_size` |
| POST | `/api/v1/notifications/{notification_id}/read` | `notify.handle` | 单条已读，返回更新后的通知 |
| POST | `/api/v1/notifications/read-all` | `notify.handle` | 批量已读；支持 `project`、`type` 限定，返回 `updated` |

通知列表只返回当前登录用户作为 `recipient_user_id` 的记录，不能跨用户读取。

### 1.1 返回字段

| 字段 | 含义 |
|---|---|
| `id` | 通知 UUID |
| `type` | 业务类型，如 `待剧本审核`、`质量不通过`、`终审退回` |
| `project` / `project_name` | 项目 code / 名称；平台级通知为 `null` |
| `title` / `reason` / `impact` / `action` | 标题、原因、阻塞影响、建议动作 |
| `link` | 处理页相对路由，如 `creation/review?project=SP-26031` |
| `state` / `unread` / `read_at` | 待处理/已处理、未读、已读时间 |
| `at` | 最近一次事件时间（合并后取最后一次） |
| `merge_count` | 同对象合并次数；首次为 1 |
| `object_type` / `object_key` | 合并键；同一对象同一类型未读时合并 |

### 1.2 同对象合并

合并条件为：

- 同一 `organization_id`
- 同一 `recipient_user_id`
- 同一 `type`
- 同一 `object_type`
- 同一 `object_key`
- 原通知仍 `unread=true`

命中后不新增行，而是刷新标题、原因、影响、动作、`link`，`merge_count += 1`，`last_at` 更新为最新事件时间。已读之后再次发生的事件会新建一条，避免“已处理”状态吞掉新的待办。

### 1.3 自动生成的通知

项目门禁迁移时由服务端直接生成，不依赖前端轮询：

| 动作 | 类型 | 处理页 |
|---|---|---|
| `submitScript` | `待剧本审核` | `creation/review?project={code}` |
| `failQc` | `质量不通过` | `quality/reports?project={code}` |
| `finalReject` | `终审退回` | `post/review?project={code}` |
| 生成任务终态失败 | `任务失败` | `tasks/list?project={code}&task={id}` |

收件人为项目 owner。同一项目同一门禁反复触发时按上述规则合并；例如多次质检退回只保留一条未读通知并累计 `merge_count`。

前端现状：`/notify/inbox` 已读取 `/notifications` 并支持单条/全部已读；`link` 字段已随列表返回，但该规格页尚未渲染“点击跳转处理页”，跳转交互属于后续前端任务。

## 2. 审计接口

`GET /api/v1/audit-logs`（`audit.read`）支持 `action`、`resource_type`、`result`、`q` 和分页。

返回在原有技术字段之外补充页面直出字段：

| 字段 | 含义 |
|---|---|
| `time` | 与 `created_at` 相同，页面时间列 |
| `actor` | 操作者姓名；系统事件为“系统” |
| `object` | 资源中文标签 + 业务 code/资源 id |
| `src` | 请求 id 或调用来源 |
| `link` | 详情页路由（写入时放在 `details.link`） |
| `result` | 页面直出中文结果：`成功` / `失败`，其他值原样返回 |
| `result_code` | 原始结果码：`success` / `failure`，供集成方判断 |

`result` 过滤参数仍使用原始结果码（`success` / `failure`），避免页面文案影响查询契约。

审计写入时自动解析操作者当前组织并落到 `audit_logs.organization_id`，列表按组织过滤；操作者离职后记录仍保留，不因成员关系停用而消失。

### 2.1 只追加

三层保护：

1. ORM 层：`AuditLog` 注册 `before_update`/`before_delete` 事件，应用代码尝试改写或删除时抛 `AuditLogImmutableError`。
2. 行级触发器：迁移 `0017_notifications_audit` 创建 `trg_audit_logs_append_only`，任何 `UPDATE`/`DELETE` 直接以 `check_violation` 失败，绕过 ORM 的批量 SQL 也无法改写。
3. 语句级触发器：`trg_audit_logs_no_truncate` 阻止 `TRUNCATE audit_logs`，避免整表清空绕过行级触发器。

审计接口只有 `GET`，没有修改、删除或清空入口。

## 3. 迁移

`0017_notifications_audit`：

- `audit_logs` 增加 `organization_id`、索引、外键，并按操作者的全部组织成员关系回填历史记录（不限制 `is_active`，保证离职者历史审计不丢）。
- 创建审计只追加触发器。
- 新建 `notifications` 及收件人未读、合并键等索引。

## 4. 验收

- `tests/domains/notifications/test_inbox_audit.py`
  - 同一对象连续两次事件合并为一行，`merge_count=2`，已读后再次事件新建一行。
  - 项目提交剧本后自动出现 `待剧本审核` 通知，`link` 可直接定位 `creation/review`。
  - 审计列表返回页面字段与中文 `result`；直接 `UPDATE audit_logs` 被数据库拒绝。
  - ORM 改写/删除审计行被 `AuditLogImmutableError` 拒绝。
  - 直接 `TRUNCATE audit_logs` 被语句级触发器拒绝。
