# 前后端 API 对接清单

基线：`docs/04-api/API_CONVENTIONS.md`。前缀 `/api/v1`；成功 `{ data, meta }`；错误 `{ error: { code, message, details, request_id } }`；JSON 字段 snake_case、时间 UTC ISO 8601。

**契约状态说明：** 路由域依据正式 API 规范整理；具体路由、字段和实现状态必须以 M1+ 后端 OpenAPI 为准。下列入参/出参为联调建议，不构成后端承诺。对接前由后端确认 schema、权限、分页、错误码和状态码。

通用：认证方式待确认；分页建议 `page/page_size/sort`，响应 `meta: { page, page_size, total }` 待确认；重要 POST 使用 `Idempotency-Key`；项目资源必须由服务端校验成员授权。

## 身份认证与会话（M1）
| 场景 | 方法/路径 | 暂定入参 | 暂定出参 | 状态 |
|---|---|---|---|---|
| 登录 | POST `/auth/login` | `{ username, password }` | `{ data: { access_token, token_type, expires_at?, user } }` | 待确认：路径、字段、Cookie/JWT |
| 当前会话 | GET `/auth/me` | 无 | `{ data: { user, roles, permissions } }` | 待确认 |
| 退出 | POST `/auth/logout` | `{ refresh_token? }` | `{ data: { success } }` | 待确认：服务端会话策略 |
| 刷新令牌 | POST `/auth/refresh` | `{ refresh_token? }` | `{ data: { access_token, expires_at? } }` | 待确认 |

## 用户、组织、RBAC（M1）
| 场景 | 方法/路径 | 暂定入参 | 暂定出参 | 状态 |
|---|---|---|---|---|
| 用户列表/详情 | GET `/users`；GET `/users/{user_id}` | 分页、keyword?/status?；Path user_id | `{ data: User[] , meta }` / `{ data: User }` | 待确认 |
| 创建用户 | POST `/users` | `{ username, display_name, email?, password?, role_ids? }` | `{ data: User }` | 待确认：邀请/初始密码 |
| 更新/禁用用户 | PATCH `/users/{user_id}` | 可变字段；禁用建议 `{ status }` | `{ data: User }` | 待确认 |
| 组织列表/创建 | GET/POST `/organizations` | GET 分页；POST `{ name, description? }` | `{ data: Organization[]/Organization }` | 待确认 |
| 部门列表/创建 | GET/POST `/departments` | GET organization_id?；POST `{ organization_id, name, parent_id? }` | `{ data: Department[]/Department }` | 待确认 |
| 角色列表/创建/更新 | GET/POST `/roles`；PATCH `/roles/{role_id}` | `{ name, description?, permission_codes: string[] }` | `{ data: Role[]/Role }` | 待确认 |
| 权限目录 | GET `/permissions` | module? | `{ data: Permission[] }` | 待确认 |

## 项目与成员（M1）
| 场景 | 方法/路径 | 暂定入参 | 暂定出参 | 状态 |
|---|---|---|---|---|
| 项目列表/创建 | GET/POST `/projects` | GET 分页/keyword?/status?；POST `{ name, description?, owner_id? }` | `{ data: Project[]/Project, meta? }` | 待确认 |
| 项目详情/更新 | GET/PATCH `/projects/{project_id}` | Path；PATCH `{ name?, description?, status? }` | `{ data: Project }` | 待确认 |
| 成员列表/添加 | GET/POST `/projects/{project_id}/members` | POST `{ user_id, project_role }` | `{ data: ProjectMember[]/ProjectMember }` | 待确认：成员路由 |
| 移除成员 | DELETE `/projects/{project_id}/members/{user_id}` | Path project_id/user_id | 204 或成功 envelope | 待确认 |

## 故事、剧集、剧本（M2）
| 场景 | 方法/路径 | 暂定入参 | 暂定出参 | 状态 |
|---|---|---|---|---|
| 剧集列表/创建 | GET/POST `/episodes` | POST `{ project_id, title, episode_number }` | `{ data: Episode[]/Episode }` | 待确认：是否嵌套项目 |
| 剧集详情/更新/归档 | GET/PATCH/DELETE `/episodes/{episode_id}` | Path；可变剧集字段 | `{ data: Episode }` 或 204 | 待确认 |
| 故事设定读取/保存 | GET/PUT `/stories/{story_id}` | `{ title?, premise?, world_setting?, character_relationships? }` | `{ data: StoryBible }` | 待确认：资源路由 |
| 剧本版本列表/创建 | GET/POST `/script-versions` | `{ episode_id, content, change_note? }` | `{ data: ScriptVersion[]/ScriptVersion }` | 待确认 |
| 场次列表/创建 | GET/POST `/scenes` | `{ episode_id, title, sequence }` | `{ data: Scene[]/Scene }` | 待确认：与场景资产区分 |

## 影视资产、分镜与镜头（M2）
| 场景 | 方法/路径 | 暂定入参 | 暂定出参 | 状态 |
|---|---|---|---|---|
| 角色 CRUD | GET/POST `/characters`；GET/PATCH `/characters/{character_id}` | `{ project_id, name, description?, appearance? }` | `{ data: Character[]/Character }` | 待确认 |
| 场景资产 CRUD | GET/POST `/scenes`；GET/PATCH `/scenes/{scene_id}` | `{ project_id, name, description?, visual_description? }` | `{ data: Scene[]/Scene }` | 待确认：需与剧本场次区分 |
| 道具 CRUD | GET/POST `/props`；GET/PATCH `/props/{prop_id}` | `{ project_id, name, description? }` | `{ data: Prop[]/Prop }` | 待确认 |
| 分镜列表/创建 | GET/POST `/storyboards` | `{ episode_id, title? }` | `{ data: Storyboard[]/Storyboard }` | 待确认 |
| 镜头 CRUD | GET/POST `/shots`；GET/PATCH `/shots/{shot_id}` | `{ scene_id, sequence, title?, duration_seconds? }` | `{ data: Shot[]/Shot }` | 待确认 |
| 镜头合同 | GET/POST `/shot-contracts` | `{ shot_id, contract: object }` | `{ data: ShotContract }` | 待确认：独立 JSON Schema |

## AI 任务、工作流与审核（M3/M4）
| 场景 | 方法/路径 | 暂定入参 | 暂定出参 | 状态 |
|---|---|---|---|---|
| 创建生成任务 | POST `/generation/tasks` | `{ project_id, shot_id?, capability, input }` + Idempotency-Key | `{ data: { task_id, status } }` | 待确认 |
| 任务列表/详情 | GET `/generation/tasks`；GET `/generation/tasks/{task_id}` | 分页/status?/project_id? | `{ data: Task[]/Task }` | 待确认 |
| 重试/取消任务 | POST `/generation/tasks/{task_id}/retry`；POST `/generation/tasks/{task_id}/cancel` | `{ reason? }` | `{ data: Task }` | 待确认：动作路由 |
| 工作流运行 | GET `/workflow-runs`；GET `/workflow-runs/{run_id}` | 分页/project_id? | `{ data: WorkflowRun[]/WorkflowRun }` | 待确认 |
| 审核列表/提交 | GET/POST `/reviews` | `{ resource_type, resource_id, decision, comment? }` | `{ data: Review }` | 待确认 |
| 质量检查 | GET/POST `/quality-checks` | `{ resource_type, resource_id, check_type? }` | `{ data: QualityCheck }` | 待确认 |
| 任务 SSE | GET `/generation/tasks/{task_id}/events` | Last-Event-ID? | 状态/进度/结果摘要事件 | 待确认：事件 schema |

## 媒体资产、时间线与导出（M5）
| 场景 | 方法/路径 | 暂定入参 | 暂定出参 | 状态 |
|---|---|---|---|---|
| 上传资产 | POST `/assets` | multipart 文件、project_id、asset_type | `{ data: Asset }` | 待确认：直传/分片 |
| 资产列表/详情 | GET `/assets`；GET `/assets/{asset_id}` | 分页/项目/类型筛选 | `{ data: Asset[]/Asset }` | 待确认 |
| 下载/删除 | GET `/assets/{asset_id}/download`；DELETE `/assets/{asset_id}` | Path asset_id | 文件/短时 URL；204 | 待确认 |
| 时间线读取/保存 | GET/PUT `/timelines/{timeline_id}` | `{ version, tracks: Track[] }` | `{ data: Timeline }` | 待确认：JSON schema |
| 创建导出 | POST `/exports` | `{ timeline_id, profile, output_format }` + Idempotency-Key | `{ data: { export_id, status } }` | 待确认 |
| 导出查询/取消 | GET `/exports`；GET `/exports/{export_id}`；POST `/exports/{export_id}/cancel` | 分页/Path | `{ data: ExportJob[]/ExportJob }` | 待确认 |

## 后端对齐检查表
- [ ] 发布并锁定 M1 OpenAPI（认证、用户、组织、部门、角色、权限、项目、成员）。
- [ ] 确认认证方式、刷新/撤销、CORS、CSRF、Cookie/SameSite。
- [ ] 确认 ID 类型、时间、枚举、分页和排序。
- [ ] 确认权限代码、项目授权校验和审计要求。
- [ ] 确认 Pydantic schema、错误码、状态码和示例。
- [ ] 确认文件传输、SSE 事件和幂等协议。
- [ ] 用 OpenAPI 生成类型替换 provisional schema，并添加契约测试。
