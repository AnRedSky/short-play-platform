# 前后端 API 对接清单

基线：`docs/04-api/API_CONVENTIONS.md`。统一前缀 `/api/v1`；成功响应 `{ data, meta? }`；错误响应 `{ error: { code, message, details, request_id } }`；JSON 字段 snake_case、时间 UTC ISO 8601。以下已实现路由依据当前 main 后端路由和 Pydantic Schema 核对；未实现模块明确标记待开发，不以猜测路径冒充正式契约。

## 通用约定
- 认证：`Authorization: Bearer <access_token>`；登录/初始化不带 Bearer。
- 分页：`page` 默认 1，`page_size` 默认 20、最大 100；分页响应 meta 为 `{ page, page_size, total }`（部分创建域列表只返回 page/page_size）。
- 错误：按统一错误 envelope 处理；前端 ApiError 保留 HTTP status、code、details、request_id。
- 项目资源由服务端校验项目成员和权限；前端权限只控制展示。
- 生成创建支持 `Idempotency-Key`；若未提供后端会生成随机 key，前端正式接入应主动提供稳定幂等键。

## M1 身份认证

| 场景 | 方法与路径 | 请求体 | 响应 data | 状态/说明 |
|---|---|---|---|---|
| 首个管理员初始化 | POST `/auth/bootstrap` | `{ email, password, full_name, organization_name }`；password 最少 8 字符 | UserRead: `{ id, email, full_name, is_active }` | 已实现；仅首次管理员初始化流程使用 |
| 登录 | POST `/auth/login` | `{ email, password }` | `{ access_token, token_type, expires_in, refresh_token, user }` | 已实现；UserRead 同上 |
| 刷新令牌 | POST `/auth/refresh` | `{ refresh_token }` | 同登录 Token 响应 | 已实现 |
| 退出 | POST `/auth/logout` | `{ refresh_token }` | `{ revoked: true }` | 已实现 |
| 当前会话 | GET `/auth/me` | 无 | `{ user: UserRead, organization_id: UUID|null, permissions: string[] }` | 已实现；Bearer 必需 |
| 撤销所有会话 | POST `/auth/me/revoke-all` | 无 | `{ revoked_sessions: number }` | 已实现；Bearer 必需 |

## M1 用户与组织

| 场景 | 方法与路径 | 请求体/Query | 响应 data | 权限 |
|---|---|---|---|---|
| 用户列表 | GET `/users?page=&page_size=` | Query page/page_size | UserRead[]；meta page/page_size/total | users:read |
| 创建用户 | POST `/users` | `{ email, full_name, password, department_id?: UUID|null, role_ids: UUID[] }` | UserRead | users:write |
| 用户详情 | GET `/users/{user_id}` | UUID Path | UserRead + permissions: string[] | users:read |
| 更新用户 | PATCH `/users/{user_id}` | `{ full_name?: string, is_active?: boolean }` | UserRead | users:write |
| 组织列表 | GET `/organizations` | 无 | OrganizationRead[]: `{ id, name, slug }` | organizations:read |
| 组织详情 | GET `/organizations/{organization_id}` | UUID Path | OrganizationRead | organizations:read |
| 部门列表 | GET `/organizations/departments?page=&page_size=` | Query page/page_size | DepartmentRead[]: `{ id, organization_id, name, parent_id }`；分页 meta | organizations:read |
| 创建部门 | POST `/organizations/departments` | `{ name, parent_id?: UUID|null }` | DepartmentRead | organizations:write |
| 组织成员列表 | GET `/organizations/members?page=&page_size=` | Query page/page_size | MemberRead[]: `{ id, organization_id, user_id, department_id, is_active }`；分页 meta | organizations:read |

## M1 RBAC

| 场景 | 方法与路径 | 请求体/Query | 响应 data | 权限 |
|---|---|---|---|---|
| 角色列表 | GET `/roles?page=&page_size=` | Query page/page_size | RoleRead[]: `{ id, organization_id, code, name, description }`；分页 meta | roles:read |
| 创建角色 | POST `/roles` | `{ code, name, description?: string, permissions: string[] }` | RoleDetailRead（RoleRead + permissions） | roles:write |
| 角色详情 | GET `/roles/{role_id}` | UUID Path | RoleDetailRead | roles:read |
| 分配角色 | POST `/roles/{role_id}/assignments` | 当前 schema 声明 `{ role_id: UUID }`，但路由实现访问 `payload.user_id` | 预期 `{ role_id, user_id }` | **后端契约冲突待修复**：Schema 缺少 user_id，前端暂不调用 |

## M1 项目

| 场景 | 方法与路径 | 请求体/Query | 响应 data | 权限 |
|---|---|---|---|---|
| 项目列表 | GET `/projects?page=&page_size=` | Query page/page_size | ProjectRead[]: `{ id, organization_id, code, title, summary, status }`；分页 meta | projects:read |
| 创建项目 | POST `/projects` | `{ code, title, summary?: string }` | ProjectRead | projects:write |
| 项目详情 | GET `/projects/{project_id}` | UUID Path | ProjectRead | projects:read + 项目访问校验 |
| 更新项目 | PATCH `/projects/{project_id}` | `{ title?: string, summary?: string, status?: string }` | ProjectRead | projects:write + 项目访问校验 |
| 项目成员列表 | GET `/projects/{project_id}/members` | UUID Path | ProjectMemberRead[]: `{ id, project_id, user_id, project_role, is_active }` | projects:read |
| 添加项目成员 | POST `/projects/{project_id}/members` | `{ user_id: UUID, project_role: owner\|producer\|writer\|artist\|editor\|reviewer }` | ProjectMemberRead | projects:manage |

## M2 创作与镜头（部分路由已实现）

| 场景 | 方法与路径 | 请求体 | 响应/说明 |
|---|---|---|---|
| 剧集列表/创建 | GET/POST `/projects/{project_id}/episodes` | 创建 `{ episode_number, title, synopsis }` | EpisodeRead[] / EpisodeRead；列表带 page/page_size |
| 剧集详情 | GET `/episodes/{episode_id}` | 无 | EpisodeRead |
| 故事列表/创建 | GET/POST `/projects/{project_id}/stories` | `{ title, logline, synopsis }` | StoryRead[] / StoryRead |
| 故事圣经列表/新版本 | GET/POST `/projects/{project_id}/story-bibles` | `{ content: object }` | StoryBibleRead[] / StoryBibleRead |
| 创建剧本 | POST `/episodes/{episode_id}/scripts` | `{ title }` | ScriptRead |
| 剧本版本列表/新版本 | GET/POST `/scripts/{script_id}/versions` | `{ content: object }` | ScriptVersionRead[] / ScriptVersionRead |
| 剧本场次列表/创建 | GET/POST `/script-versions/{version_id}/scenes` | 以 ScriptSceneCreate schema 为准 | ScriptSceneRead[] / ScriptSceneRead |
| 创建对白 | POST `/script-scenes/{scene_id}/dialogues` | 以 ScriptDialogueCreate schema 为准 | ScriptDialogueRead |
| 角色列表/创建 | GET/POST `/projects/{project_id}/characters` | AssetCreate: `{ name, description }` | AssetRead[] / AssetRead |
| 角色详情/版本 | GET `/characters/{character_id}`；POST `/characters/{character_id}/versions` | AssetVersionCreate | AssetDetailRead / AssetVersionRead |
| 场景资产列表/创建 | GET/POST `/projects/{project_id}/scenes` | AssetCreate | AssetRead[] / AssetRead |
| 场景资产版本 | POST `/scenes/{scene_id}/versions` | AssetVersionCreate | AssetVersionRead |
| 道具列表/创建 | GET/POST `/projects/{project_id}/props` | AssetCreate | AssetRead[] / AssetRead |
| 道具版本 | POST `/props/{prop_id}/versions` | AssetVersionCreate | AssetVersionRead |
| 创建分镜 | POST `/episodes/{episode_id}/storyboards` | `{ version_number }` | StoryboardRead |
| 镜头列表/创建 | GET/POST `/storyboards/{storyboard_id}/shots` | ShotCreate schema | ShotRead[] / ShotRead |
| 镜头合同列表/创建 | GET/POST `/shots/{shot_id}/contracts` | `{ payload: object }` | ShotContractRead[] / ShotContractRead |

## M3 Provider 与生成

| 场景 | 方法与路径 | 请求体/Query | 响应 data |
|---|---|---|---|
| Provider 健康状态 | GET `/models/providers` | 无 | `{ code, healthy }[]` |
| 创建生成任务 | POST `/projects/{project_id}/generation/tasks` | `{ capability, prompt, parameters?: object, model_code?: string, provider_code?: string, shot_id?: UUID|null }`；Header `Idempotency-Key?` | GenerationTaskRead: `{ id, project_id, capability, provider_code, model_code, status, idempotency_key, result_payload, error_code, error_message }`；meta.created |
| 查询任务详情 | GET `/generation/tasks/{task_id}` | UUID Path | GenerationTaskDetailRead（任务字段 + attempts[]） |
| 取消任务 | POST `/generation/tasks/{task_id}/cancel` | 无 | GenerationTaskRead |

## M4/M5 尚待后端提供正式接口
- M4：任务列表、重试、工作流运行详情、任务 SSE/事件流、暂停/恢复等；当前 generation 路由仅提供创建、详情、取消。
- M5：素材文件上传/下载、Timeline、ExportJob、导出取消与进度等；当前 main 未发现对应 API 路由。
- 审核、质量检查、模型配置管理和审计日志分页虽在产品/领域范围内，需逐一以 OpenAPI 核对；当前审计列表 GET `/audit-logs?page=&page_size=&action=`，响应 data 为审计记录数组，权限 audit:read。

## 对接与阻塞事项
- [ ] 后端修复 `RoleAssignment` schema 与路由对 `user_id` 的字段冲突，并补接口测试。
- [ ] 后端发布 OpenAPI JSON；前端生成类型并锁定接口快照。
- [ ] 确认权限码完整清单、默认角色权限、项目成员角色枚举。
- [ ] 补充刷新令牌自动续期、401 并发刷新和会话失效处理。
- [ ] M4/M5 发布正式路由后补齐任务、媒体、时间线和导出页面。
