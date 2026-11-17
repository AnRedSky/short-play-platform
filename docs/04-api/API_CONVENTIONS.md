# API 接口规范

## 1. 通用约定

- 前缀：`/api/v1`；资源名使用复数名词；JSON 使用 snake_case。
- HTTP：GET 查询、POST 创建/命令、PATCH 局部更新、DELETE 删除。
- 成功响应结构统一为 `{ "data": ..., "meta": ... }`；错误结构统一为 `{ "error": { "code", "message", "details", "request_id" } }`。
- 列表接口支持 page/page_size 或 cursor；限制最大 page_size；默认稳定排序。
- 时间使用 ISO 8601 UTC；金额/计量明确单位。
- 重要 POST 命令支持 Idempotency-Key；不得将密钥、令牌或完整敏感 Prompt 写入普通日志。
- API 文档由 FastAPI OpenAPI 生成，变更时同步示例和权限说明。

## 2. 路由基线

| 域 | 示例路径 |
|---|---|
| 系统认证 | GET /health、POST /auth/login、POST /auth/logout、POST /auth/refresh、GET /auth/me |
| 用户组织 | /users、/roles、/permissions、/organizations、/departments |
| 项目剧集 | /projects、/projects/{id}/members、/projects/{id}/episodes、/episodes/{id} |
| 剧本 | /episodes/{id}/scripts、/scripts/{id}/versions、/scripts/{id}/approve |
| 角色场景 | /projects/{id}/characters、/projects/{id}/scenes、/projects/{id}/props |
| 分镜 | /episodes/{id}/storyboards、/storyboards/{id}/shots、/shots/{id}/regenerate |
| 生成任务 | /generation/tasks、/generation/tasks/{id}、/generation/tasks/{id}/retry、/cancel |
| 工作流 | /workflows、/workflows/{id}/execute、/workflow-runs/{id}/pause、/resume、/cancel |
| 素材 | /assets、/assets/upload、/assets/{id}/download、/preview |
| 合成导出 | /compositions、/compositions/{id}/execute、/exports、/exports/{id}/download |
| 模型管理 | /models/providers、/models/configs、/models/configs/{id}/test、/models/usage |

以上为路由设计基线，实际实现应以模块边界、权限和具体用例为准，不要求一次性全部实现。

## 3. 错误码建议

- AUTHENTICATION_REQUIRED、PERMISSION_DENIED、RESOURCE_NOT_FOUND。
- VALIDATION_ERROR、CONFLICT、IDEMPOTENCY_CONFLICT。
- TASK_NOT_RETRYABLE、TASK_CANCELLED、PROVIDER_UNAVAILABLE、PROVIDER_TIMEOUT。
- POLICY_BLOCKED、QUOTA_EXCEEDED（仅内部资源/用量策略，不表示 SaaS 租户计费）。
- INTERNAL_ERROR。

HTTP 状态码应语义一致：400 参数错误、401 未认证、403 无权限、404 不存在、409 状态/幂等冲突、422 业务校验失败、429 限流、502/503 上游错误、504 上游超时。

## 4. 权限要求

每个业务接口明确所需 permission；涉及项目资源时同时验证用户对该 project 的成员关系/角色。禁止仅凭客户端传入 project_id 即视为有权。下载链接必须经过授权，或使用短时签名地址。

## 5. 异步接口

创建任务返回 task_id 和当前状态；查询接口返回状态、进度、结果摘要、错误码和可执行动作。SSE 仅作为状态推送通道，客户端仍可通过 GET 恢复当前快照。断线重连需支持 Last-Event-ID 或重新拉取快照。
