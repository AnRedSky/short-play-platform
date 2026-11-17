# API 接口规范

## 通用协议
- 前缀 /api/v1；资源使用复数名词；JSON 字段 snake_case；时间 ISO 8601 UTC。
- GET 查询、POST 创建/命令、PATCH 局部更新、DELETE 删除/归档。
- 成功：{ "data": ..., "meta": ... }；错误：{ "error": { "code", "message", "details", "request_id" } }。
- 列表分页有最大 page_size 和稳定排序；重要 POST 命令支持 Idempotency-Key。
- OpenAPI 由 FastAPI 生成，权限、错误和示例同步维护。

## 路由域
/auth；/users、/organizations、/departments、/roles；/projects、/episodes；/stories、/scripts、/script-versions；/characters、/scenes、/props；/storyboards、/shots、/shot-contracts；/assets；/generation/tasks；/workflows、/workflow-runs；/reviews、/quality-checks；/timelines、/exports；/models/providers、/models/configs、/models/usage；/audit-logs。

## 错误码
AUTHENTICATION_REQUIRED、PERMISSION_DENIED、RESOURCE_NOT_FOUND、VALIDATION_ERROR、CONFLICT、IDEMPOTENCY_CONFLICT、TASK_NOT_RETRYABLE、PROVIDER_UNAVAILABLE、PROVIDER_TIMEOUT、POLICY_BLOCKED、QUOTA_EXCEEDED、INTERNAL_ERROR。状态码语义：400、401、403、404、409、422、429、502、503、504。

## 权限
每个接口声明 permission；项目资源同时验证成员关系和项目角色。客户端传 project_id 不代表有权。文件下载必须鉴权或使用短时签名 URL。高风险命令写审计记录。

## 异步接口
任务创建返回 task_id/status；查询返回状态、进度、结果摘要、错误码和允许动作。SSE 是通知通道，GET 快照是事实来源；断线后重新拉取快照，支持事件 ID 时可续传。
