# API 实际覆盖矩阵（develop 基线）

> 核验基线：develop `fa9f00b9996c5a70e40a7b8c10386e93af19ac64`。  
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
| Roles | POST | /roles/{role_id}/assignments | 角色分配 |
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
3. Generation 创建接口的权限依赖声明 projects:read，但服务内部再检查 projects:write；后续应统一声明和测试写权限。
4. 已修复项目生产前端 demo-project 硬编码：App.vue 根据 route.params.projectId 构造导航，Pinia project store 保存当前项目上下文，项目列表提供进入真实项目工作区入口。仍需完成页面 API 联调、切换缓存清理和项目越权 E2E；见 Issue #43。
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


## 2026-11-18 Runtime Contract Snapshot（CI Run #195）

已实际下载并检查 GitHub Actions artifact `runtime-contracts`（Run ID `44294871572`，artifact ID `14423442790`）：
| 项目 | 快照结果 |
|---|---:|
| Runtime OpenAPI paths | 53 |
| Router declarations | 72 |
| SQLAlchemy tables | 42 |
| Alembic revisions | 7 |
| Alembic head | `0007_workflow_run_workflow_index` |
| Frontend API calls | 15 |
| Matched frontend calls | 15 |
| Unmatched frontend calls | 0 |
| Backend routes without frontend API Client | 57 |
| Duplicate routes | 0 |

### 快照解释与差距
- `openapi.json` 是应用运行时生成的 OpenAPI；路由权限清单由当前领域 router 源码提取声明方法、路径和显式 require_permission，需结合 FastAPI router/dependency 继承关系审阅。
- 前端 API 匹配为 15/15；57 条后端路由尚无 API Client 映射，主要反映页面接入范围有限，不表示这些 API 未注册。
- 当前 stories/episodes/assets/storyboards/tasks/reviews/editor/exports 等生产页尚未全部连接真实 API；生产页面已移除演示记录并显示 API 未接入状态。
- Alembic `0007_workflow_run_workflow_index` 修复了 ORM metadata 与 migration schema 的 workflow_runs.workflow_id 索引差异；Run #195 的 Alembic drift 检查通过。
- 资产当前没有删除路由；不能将删除 IDOR 标记为已测试。
- Generation 的同步执行路径、Provider Registry 默认行为和 QA/Review/Timeline/完整 Export API 仍按 R4–R7 路线管理，不因 OpenAPI 路径存在而宣称闭环。

### R1 资源授权检查边界
服务端负向测试已覆盖 Asset detail/download/version、Creation 资源/版本/Shot-Scene 引用、Generation task detail/cancel/Shot 引用、Workflow run detail/cancel、Export Asset 引用及组织/RBAC 隔离。跨项目引用必须由服务端按资源实际 project_id 校验，不能信任请求体 project_id。


## R1 Web 项目访问入口授权

新增前端路由进入项目工作区前的 API 检查：`GET /projects/{project_id}`。接口使用 `projects:read` 并调用 `get_accessible_project`，非项目成员返回 403；不能只依赖路由中的 projectId 或前端隐藏按钮。
浏览器测试通过真实 API 服务验证项目 A/B 成员可访问、项目 C 非成员不可访问，并使用项目 C 的 Asset ID 验证 `GET /assets/{asset_id}` 和 `GET /assets/{asset_id}/download` 返回 403。CI 最终结果及精确 SHA 待记录。


### 项目成员撤销接口
| Method | Path | Permission | Behavior |
|---|---|---|---|
| DELETE | `/projects/{project_id}/members/{user_id}` | `projects:manage` | 将成员 `is_active=false`，写入 `project.member_removed` 审计事件，返回 204；项目 owner 不可被移除 |

浏览器 E2E 将先在项目列表中缓存项目 C 链接，再通过管理员 API 撤销成员资格，点击旧链接验证项目详情接口仍返回 403。此场景用于验证成员权限变更后不能由前端旧缓存绕过服务端授权。
