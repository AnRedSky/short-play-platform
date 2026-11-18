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

## 2026-11-18 契约补充

项目资源 API 必须从认证上下文解析成员权限，并校验 URL/Body 中 project_id 与资源归属一致；不允许客户端 project_id 作为授权依据。Asset/AssetVersion/AssetRelation 强制项目内引用。

Provider 管理默认仅配置 Mork Adapter；无可用配置/凭据时生成命令返回 `PROVIDER_NOT_CONFIGURED`（服务不可用/配置缺失的明确错误），不得伪造任务成功或静默使用 Mock。Mock 只在测试/显式演示环境启用。

任务 API 创建后返回 task_id/status；查询快照是最终事实，SSE（若实现）仅作通知。Review API 必须绑定 object_version_id，并使用项目级 review permission。QA 结果只允许 PASS、REVIEW_REQUIRED、FAIL。

时间字段对普通创建时间仍使用 ISO 8601 UTC；媒体时间线字段必须使用整数 PTS 与 time_base numerator/denominator，不得以浮点秒定义 source_in、source_out 或 timeline_start。接口实际可用路由以 FastAPI OpenAPI 为准；本文件的路由目录是目标契约，不代表路由已经全部存在。

## 页面与 API 对齐

页面级 API 依赖和状态处理以 `docs/02-requirements/FEATURE_INTERACTION_SPEC.md` 为准；真实可调用接口以当前 FastAPI OpenAPI 为准。尚未实现的 QA/Review、Timeline、完整 Export API 只属于目标契约，不得由前端 Mock 假装可用。

## 实际路由清单
当前已注册 endpoint 与未实现目标 API 的逐项清单见 [API 实际覆盖矩阵](API_COVERAGE_MATRIX.md)。新增或修改路由时必须同步更新该矩阵。
