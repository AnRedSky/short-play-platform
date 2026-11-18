# API 实际覆盖矩阵（develop 基线）

> 核验基线：develop `37707f82d2f7f9b5983c1c22446139342fcb7977`。  
> 本文按当前 `src/app/domains/*/router.py` 的路由装饰器盘点，不是目标 API 清单，也不替代运行时 OpenAPI。所有路径以 `/api/v1` 为前缀。  
> “存在”只代表路由已注册，不等于完整业务闭环；权限、异常、事务和 E2E 仍需单独验收。

## 1. 当前已注册路由

| 域 | 方法 | 路径 | 当前用途/备注 |
|---|---|---|---|
| Auth | POST | /auth/bootstrap | 初始化管理员/系统引导 |
| Auth | POST | /auth/login | 登录 |
| Auth | POST | /auth/refresh | 刷新令牌 |
| Auth | POST | /auth/logout | 退出 |
| Auth | GET | /auth/me | 当前用户/权限上下文 |
| Auth | POST | /auth/me/revoke-all | 撤销全部会话 |
| Users | GET/POST | /users | 用户列表/创建 |
| Users | GET/PATCH | /users/{user_id} | 用户详情/更新 |
| Organizations | GET | /organizations | 组织列表 |
| Organizations | GET/POST | /organizations/departments | 部门列表/创建 |
| Organizations | GET | /organizations/members | 组织成员 |
| Organizations | GET | /organizations/{organization_id} | 组织详情 |
| Roles | GET/POST | /roles | 角色列表/创建 |
| Roles | GET | /roles/{role_id} | 角色详情 |
| Roles | POST | /roles/{role_id}/assignments | 角色分配（路径 role_id，body user_id） |
| Projects | GET/POST | /projects | 项目列表/创建 |
| Projects | GET/PATCH | /projects/{project_id} | 项目详情/更新 |
| Projects | GET/POST | /projects/{project_id}/members | 项目成员列表/添加 |
| Creation | GET/POST | /projects/{project_id}/episodes | 剧集列表/创建 |
| Creation | GET | /episodes/{episode_id} | 剧集详情 |
| Creation | GET/POST | /projects/{project_id}/stories | 故事列表/创建 |
| Creation | GET/POST | /projects/{project_id}/story-bibles | 故事圣经列表/创建 |
| Creation | POST | /episodes/{episode_id}/scripts | 创建剧本 |
| Creation | GET/POST | /scripts/{script_id}/versions | 剧本版本列表/创建 |
| Creation | GET/POST | /script-versions/{version_id}/scenes | 场次列表/创建 |
| Creation | POST | /script-scenes/{scene_id}/dialogues | 创建对白 |
| Creation | GET/POST | /projects/{project_id}/characters | 角色列表/创建 |
| Creation | GET | /characters/{character_id} | 角色详情 |
| Creation | POST | /characters/{character_id}/versions | 角色版本 |
| Creation | GET/POST | /projects/{project_id}/scenes | 场景列表/创建 |
| Creation | POST | /scenes/{scene_id}/versions | 场景版本 |
| Creation | GET/POST | /projects/{project_id}/props | 道具列表/创建 |
| Creation | POST | /props/{prop_id}/versions | 道具版本 |
| Creation | POST | /episodes/{episode_id}/storyboards | 创建分镜板 |
| Creation | GET/POST | /storyboards/{storyboard_id}/shots | 镜头列表/创建 |
| Creation | GET/POST | /shots/{shot_id}/contracts | Shot Contract 版本列表/创建 |
| Assets | POST | /projects/{project_id}/assets | 上传/登记项目资产 |
| Assets | GET | /projects/{project_id}/assets | 项目资产列表 |
| Assets | GET | /assets/{asset_id} | 资产详情 |
| Assets | GET | /assets/{asset_id}/download | 鉴权下载 |
| Assets | POST | /assets/{asset_id}/versions | 创建资产版本 |
| Assets | POST | /projects/{project_id}/exports | 创建当前导出任务/基础导出入口 |
| Generation | GET | /models/providers | Provider 健康/列表 |
| Generation | POST | /projects/{project_id}/generation/tasks | 创建生成任务；当前路由内仍调用 execute_task，同步执行路径尚未移除 |
| Generation | GET | /generation/tasks/{task_id} | 任务详情与 Attempts |
| Generation | POST | /generation/tasks/{task_id}/cancel | 取消任务 |
| Workflow | GET | /projects/{project_id}/workflows | 项目可用工作流 |
| Workflow | POST | /projects/{project_id}/workflow-runs | 创建工作流运行 |
| Workflow | GET | /projects/{project_id}/workflow-runs | 项目工作流运行列表 |
| Workflow | GET | /workflow-runs/{run_id} | 运行详情 |
| Workflow | POST | /workflow-runs/{run_id}/cancel | 取消运行 |
| Workflow | POST | /workflow-runs/{run_id}/recover | 恢复运行 |
| Audit | GET | /audit-logs | 审计日志查询 |
| Health | GET | /health | Liveness |
| Health | GET | /health/ready | PostgreSQL/Redis readiness |

## 2. 目标功能但当前未发现对应完整路由

| 功能 | 当前情况 | 目标接口/动作 |
|---|---|---|
| QA 规则与质量结果 | 未发现独立 QA 路由 | QualityRuleSet、QualityRun、QualityIssue、重新检查 |
| 人工审核/返工 | 未发现 reviews 路由 | ReviewRecord、意见、通过/拒绝、ReworkTask |
| 时间线持久化 | 未发现 Timeline API | Timeline/Version/Track/Clip CRUD、版本比较 |
| 完整导出管理 | 仅 assets 域创建导出入口 | ExportJob 列表/详情/取消/下载/验证报告 |
| Provider 配置与凭据 | 仅 Provider 列表/健康路由 | Mork 配置、密钥引用、模型配置、Capability Catalog |
| 用量/预算 | 未发现完整路由 | UsageRecord、预算、项目用量报表 |
| 通知/事件 | 未发现面向业务用户的完整事件 API | 站内通知；SSE 若需要仅作通知，快照 API 为事实 |
| 项目内搜索 | 未发现完整搜索 API | 仅项目范围内检索，禁止跨项目资产搜索 |

## 3. 已知 API/业务偏差

1. Generation 创建路由当前在 HTTP 请求中直接执行 Provider 调用；目标是 Task + Outbox + Celery Worker 异步执行。
2. Provider Registry 当前默认注册 MockProvider 和 FailingProvider，未发现 Mork Adapter；生产未配置时必须失败关闭并返回 PROVIDER_NOT_CONFIGURED。
3. Generation、Creation、Assets、Workflow 的写路由已统一声明 projects:write；读路由使用 projects:read。
4. 已移除 demo-project 硬编码；Project Store + useProjectRequest 提供项目上下文版本、请求取消和 cleanup。生产页已移除本地演示数据，尚未接真实 API 的页面显示未接入状态。
5. API 列表不代表所有对象支持完整 CRUD；目前部分对象只有创建/列表/版本操作，更新、归档和删除接口需要按业务生命周期补齐。

## 4. 统一接口规则

- 所有项目资源接口在服务端验证认证用户、项目成员权限、资源 project_id 一致。
- 所有 Asset 必须 project_id；引用只能发生在同项目。
- Generation、Workflow、Export 长任务创建后应返回 task_id/run_id；查询快照是最终事实，SSE 仅为通知。
- Review 接口绑定不可变 subject_version_id，并要求项目级统一 review permission。
- QA 结果只允许 PASS、REVIEW_REQUIRED、FAIL。
- 时间线媒体时间只使用整数 PTS + 有理数 time_base。
- Mork 未配置返回 PROVIDER_NOT_CONFIGURED；Mock 只能在 CI/显式演示环境。
- 每个新增/修改路由必须同步 OpenAPI Schema、权限声明、错误码、契约测试和页面交互说明。

## 5. 后续维护

每次 PR 修改 router/schema/service 时，同步更新本矩阵并附 OpenAPI 导出差异。当前路由实现以代码为准，目标接口以统一实施基线和功能交互规范为准；二者必须明确区分。


## 6. 2026-11-18 R1 进度
项目工作区入口与 route-driven project context 已合入 develop；该进度只覆盖导航/上下文初始状态，不代表所有项目资源接口和前端生产页面已完成授权闭环。


## 6. 2026-11-18 R0 运行时契约与授权核查

### 6.1 自动化快照
CI 的 runtime-contracts artifact 包含：
- openapi.json：FastAPI 运行时 OpenAPI。
- route-permissions.json：实际 APIRoute 的 path、HTTP methods、tags 和声明的权限依赖。
- database-schema.json：SQLAlchemy 全量表、列、外键、索引及 Alembic revision 链。
- frontend-api-map.json：web/src/api 下 API Client 调用与后端 method/path 的匹配情况，列出未匹配前端调用和当前没有 API Client 的后端路由。
- duplicate-routes.json：重复 method/path 检查结果。

OpenAPI 路径与实际注册路由路径由脚本进行一致性检查；模型与迁移通过 CI 中的 alembic check 核对。快照 artifact 的最终 SHA/运行链接记录在 Issue #42。

### 6.2 权限矩阵摘要
| 资源层级 | 访问规则 | 服务端校验 |
|---|---|---|
| 组织 | 当前组织成员才能读取组织详情；部门父级必须属于同一组织 | OrganizationMember.is_active + organization_id |
| 用户 | 用户列表、详情、修改限定当前组织 | 用户组织成员关系 |
| RBAC | 角色归属当前组织；分配角色的目标用户必须属于同一组织；当前权限计算只汇总当前组织 Role | Role.organization_id + OrganizationMember |
| 项目 | projects:manage 允许组织级项目管理；普通成员必须属于项目且具备对应项目角色 | project membership + project_id |
| 资产 | 详情、下载、版本、导出引用必须归属当前项目 | Asset.project_id |
| Creation | 资源读写必须通过所属项目授权；Shot 不得引用其他项目 Scene | 资源反查 project_id |
| Generation | 任务读写必须通过所属项目授权；Task 不得引用其他项目 Shot | task.project_id + shot.project_id |
| Workflow | Run 读取、取消、恢复限定所属项目 | run.project_id |
| Audit | 日志列表按当前组织内活跃成员的 actor 归属过滤 | OrganizationMember |

### 6.3 API Client 与业务差距
- 已存在 API Client：auth、organizations、projects、roles、users；其余生产页面仍有未映射/未使用路由，具体以 frontend-api-map.json 为准。
- Role assignment 的前端 API Client 已修复为 `rolesApi.assign(roleId, userId)`，请求体为 `{ user_id }`。
- 目前无资产删除 API；不应把不存在的删除接口列为已验收能力。
- Generation 当前仍有同步执行路径；Provider/Mork 异步化属于 R4，不能因路由存在而宣称生成闭环完成。
- QA/Review、Timeline、完整 Export 管理 API 尚未建设；不提前进入 R2–R7。
