# 项目统一实施基线（2026-11-18）

> 状态：当前唯一实施基线，覆盖产品边界、现状核验、模块职责、技术选型、依赖和交付规则。  
> 代码基线：develop `fa9f00b9996c5a70e40a7b8c10386e93af19ac64`。  
> 前序设计：`PRODUCT_FUNCTIONAL_DESIGN.md`；实施阶段：`../10-development/ROADMAP.md`。  
> 目录政策：必须保留现有目录结构；本方案不要求整体迁移或重命名。

## 1. 目标、范围与不变量

平台为企业内部短剧制作团队提供从创意、剧本、资产、分镜、AI 生成、QA/审核、剪辑到 MP4 交付的可追溯生产系统。Project 是协作与授权边界，Episode 是生产管理单元，Shot 是 AI 生成、审核、返工和用量追踪的核心生产单元。

### 1.1 本期范围
- 企业用户、组织/部门、RBAC、项目成员与项目授权。
- 项目、故事圣经、剧集、剧本版本、场次、对白、角色、场景、道具。
- 项目内资产、不可变资产版本、引用与来源追踪。
- Storyboard、Shot、Shot Contract 和连续性约束。
- Mork Provider Adapter、模型能力配置、生成任务、Attempt、用量和产物登记。
- PostgreSQL + Outbox + Celery 的可恢复工作流。
- 自动技术/内容/连续性 QA、人工审核、返工和 stale 传播。
- 轻量多轨时间线、字幕/音轨、FFmpeg MP4 导出和交付追踪。
- 审计、基础运营指标、私有化部署、备份恢复。

### 1.2 明确不做
- 不做 SaaS 多租户计费/租户自助开通。
- 不做第三方业务系统连接、Webhook 外部集成、爬虫/采集接入。
- 不做版权管理、版权采集授权模块；仍需执行第三方软件许可证和 Provider 服务条款审查。
- 不做跨项目资产搜索、共享、引用。
- 不做多级会签、按内容类型配置审核角色或质量豁免。
- 不做专业级 NLE、实时多人协同剪辑、GPU 推理集群、自研基础模型、Kubernetes、公开插件市场。
- 不承诺模型生成质量或输出自动具备商业可用性。

### 1.3 已确认的强制决策
1. 资产必须有非空 `project_id`；任何 AssetRelation 两端资源必须属于同一项目。
2. 审核只使用项目级统一 `review` 权限；审核记录绑定具体对象版本。新版本重新 QA/审核，不继承旧结论。
3. QA 结果仅 `PASS`、`REVIEW_REQUIRED`、`FAIL`；失败/异常不得自动转 PASS，不提供 WAIVED。
4. 默认 Provider 为 Mork。缺少有效配置/凭据时返回 `PROVIDER_NOT_CONFIGURED`；禁止静默回退 Mock 或伪造结果。Mock 只允许测试和明确标记的演示环境。
5. 时间权威值为整数 PTS + 有理数 `time_base`。视频保留整数帧序号与帧率分数，音频保留整数采样点与 sample_rate。浮点秒不得成为 API、数据库、版本比较的权威字段。
6. 保留当前仓库目录结构；只在现有目录内扩展代码，新增同级领域目录必须经 Issue/ADR 说明边界与必要性。

## 2. 当前仓库结构与技术基线

### 2.1 目录（不得整体搬迁）
- 后端：`src/app/bootstrap`、`config`、`dependencies`、`domains`、`infrastructure`、`middleware`、`packages`、`public`、`router`、`utils`、`workers`、`main.py`。
- 前端：`web/src/api`、`assets`、`components`、`composables`、`layouts`、`router`、`stores`、`styles`、`types`、`utils`、`views`。
- 数据库：`migrations/versions`；测试：`tests`、`web/tests`；规范：`docs`。
- 现有后端领域目录包含 assets、audit、auth、creation、generation、health、organizations、projects、roles、users、workflow。
- 前端继续沿用现有 auth、organizations、users、roles、projects、stories、episodes、assets、storyboards、tasks、reviews、editor、exports 等 views。

### 2.2 技术选型
| 层 | 选型 | 责任 |
|---|---|---|
| Web | Vue 3、TypeScript、Vite、Pinia、Vue Router | 页面、交互、状态与 API 客户端 |
| API | Python 3.12+、FastAPI、Pydantic v2 | HTTP 契约、认证、输入校验和用例入口 |
| ORM/迁移 | SQLAlchemy 2.x、PostgreSQL、Alembic | 业务事实、关系约束和版本 |
| 异步 | Outbox + Celery + Redis（RabbitMQ 可配置） | 分发和执行；不作为业务状态事实源 |
| Provider | Mork Adapter + 内部 Capability Contracts/Registry | 外部模型协议适配和错误归一 |
| 媒体 | FFmpeg/ffprobe | 受控转码、合成和媒体验证 |
| 存储 | 私有 StorageBackend（当前本地存储） | 二进制文件；数据库只存元数据/存储键 |
| 部署 | Linux、Docker Compose、Nginx | 私有化部署、TLS、服务隔离 |
| 测试 | pytest、Ruff、Vitest、ESLint、TypeScript、Playwright | 单元、集成、契约、E2E 和质量门禁 |

不引入微服务或第二套工作流引擎。Temporal 只有在 ADR Spike 通过后才可替代编排层，不能双引擎并行。

## 3. 模块职责、实现逻辑与边界

| 模块 | 现有代码位置 | 职责与核心逻辑 | 禁止承担 |
|---|---|---|---|
| 身份认证 | domains/auth、users、roles | 登录、令牌/会话、用户、角色、权限 | 前端按钮隐藏代替授权 |
| 组织 | domains/organizations | 组织、部门、成员管理 | SaaS tenant 隔离/计费 |
| 项目 | domains/projects | 项目生命周期、成员和项目授权上下文 | 绕过服务端 project scope |
| 创作 | domains/creation | Story/StoryBible/Episode/Script/Scene/Dialogue/Character/Prop/Storyboard/Shot/ShotContract | 文件二进制存储、Provider SDK |
| 资产 | domains/assets + infrastructure/storage.py | 项目内 Asset/AssetVersion、上传/下载、checksum、引用、ExportJob 基础能力 | 跨项目共享、把文件本体写入 DB |
| Provider | infrastructure/providers | Mork API 协议、鉴权、请求/响应转换、错误归一、能力声明 | 写业务库、创建 Asset、判断项目权限 |
| 生成 | domains/generation | GenerationTask、Attempt、幂等、状态、产物登记和用量 | 直接暴露供应商 SDK 给前端 |
| 工作流 | domains/workflow + workers | Workflow/NodeRun、Outbox、Checkpoint、租约、重试、恢复 | 将 Celery result backend 当业务事实 |
| QA/审核 | 首期在现有 workflow/creation/assets 协作；领域模型按 ADR 决定落点 | QualityRun/Issue、ReviewRecord、返工、版本绑定 | 多级会签、WAIVED、旧版结论继承 |
| 时间线 | 首期评估 domains/assets 与现有模块边界，必要时新增同级领域 | Timeline/Version/Track/Clip、精确时码和引用冻结 | 浮点秒权威值、修改源媒体 |
| 媒体导出 | infrastructure/media.py、storage.py、workers、assets | FFmpeg wrapper、ExportJob、校验、原子发布 | API 进程内长时间渲染 |
| 审计 | domains/audit | 记录 actor/action/resource/request_id/结果 | 普通用户修改审计历史 |
| 前端 | web/src/api、stores、router、views、components、composables | 真实 API、项目上下文、页面状态、编辑交互 | 将 Mock 当生产数据或自创后端能力 |

### 3.1 依赖方向
```text
web views -> web api client -> FastAPI router -> application/service
                                      |                 |
                                      v                 v
                              auth/project policy   domain rules
                                                        |
                              PostgreSQL <--- repository/ORM
                                  |
                               Outbox -> Dispatcher -> Celery Worker
                                                    |-> Mork Provider Adapter
                                                    |-> StorageBackend
                                                    |-> FFmpeg/ffprobe
```
依赖规则：interfaces/router 适配协议；application 编排用例/事务/权限；domain 持有实体、值对象和状态机；infrastructure 实现 DB、队列、Provider、Storage 和媒体端口。禁止循环依赖；Provider 不访问业务数据库。

## 4. 核心业务流程

### 4.1 创作与资产
Project → Story/StoryBible → Episode → Script/ScriptVersion → Scene/Dialogue → Character/Scene/Prop Version → Storyboard/Shot → ShotContract Version。所有可复用引用锁定具体版本。修改上游版本后按依赖图标记下游 stale；不自动覆盖已审核产物。

### 4.2 生成与工作流
API 在事务内保存 GenerationTask/WorkflowRun 与 Outbox；Dispatcher 投递 Celery；Worker 幂等领取任务、检查权限/策略/预算、创建 Attempt；Provider 适配器提交调用；短任务等待响应，长任务轮询供应商任务状态；产物先临时保存、校验 checksum/MIME/媒体可读性，再登记 AssetVersion。重试必须新建 Attempt；未知供应商结果不得盲目重复收费。

### 4.3 QA/审核/返工
QA 针对不可变对象版本和 RuleSet 版本运行，保存问题、证据和检测器版本。FAIL 阻断下游；REVIEW_REQUIRED 进入项目统一人工审核；审核记录绑定 subject_version_id。拒绝产生返工任务，修订生成新版本并重新 QA/审核；历史结果不可覆盖。

### 4.4 时间线/导出
时间线引用 AssetVersion，Clip 区间左闭右开。所有计算使用整数/有理数时码。导出绑定不可变 TimelineVersion、ExportProfile 和全部输入版本快照；Media Worker 调 FFmpeg，ffprobe 和完整解码验证成功后计算 checksum、原子发布 MP4 并登记 Artifact/AssetVersion。失败不得发布半成品。

## 5. 数据模型和状态规范

- 所有业务实体 UUID；UTC/TIMESTAMPTZ；数据库外键/唯一约束是最终一致性防线。
- Asset/AssetVersion 必须 project_id；禁止跨项目引用。版本不可变，current_version_id 仅为便捷指针。
- GenerationTask 具有作用域唯一 idempotency_key；TaskAttempt attempt_number 唯一。
- ReviewRecord、QualityRun 绑定对象版本；Audit 历史不可随业务删除级联丢失。
- TimelineVersion 固定 fps 分数、音频采样率、轨道顺序和素材版本。
- 区间使用 `[in_pts, out_pts)`；PTS 是整数；time_base 为 numerator/denominator 正整数且分母非零。
- Task：pending/queued/running/retry_wait/succeeded/failed/cancel_requested/cancelled。
- WorkflowRun：created/running/paused/succeeded/failed/cancelled。
- NodeRun：pending/ready/running/waiting_review/succeeded/failed/skipped/cancelled。
- QA：PASS/REVIEW_REQUIRED/FAIL；Review：pending/approved/rejected；不得存在自动豁免路径。

## 6. API 与前端交互契约

- API 前缀 `/api/v1`；JSON snake_case；统一 data/meta 和 error envelope；列表稳定分页。
- 所有项目资源接口服务端强制校验用户权限、project membership 和 project_id 一致性。
- 长任务创建返回 task_id/status；GET 快照是最终事实；SSE 仅作通知；断线后重拉快照。
- 命令接口支持 Idempotency-Key；错误码至少区分认证、授权、校验、冲突、幂等冲突、Provider 未配置/超时/限流、任务不可重试和资源不存在。
- 前端页面必须区分 loading/empty/error/forbidden/conflict/stale/processing/success；操作成功必须以 API 返回为准。
- Demo/Mock 必须由显式开发配置启用并显示演示标识；生产环境不允许 Mock 成功伪装真实结果。
- 页面路径保留；逐个将 stories、episodes、assets、storyboards、tasks、reviews、editor、exports 接入真实 API。详细页面流见 `../02-requirements/FEATURE_INTERACTION_SPEC.md`。

## 7. 当前实现与偏差（代码基线核验）

状态含义：基础实现 ≠ 完整生产能力；原型不算业务完成；CI 通过只证明对应自动化用例通过。

| 能力 | 当前可确认情况 | 状态 | 主要差距 |
|---|---|---|---|
| 工程与运行配置 | FastAPI、PostgreSQL、Redis、Celery、Compose；.env.example 分层配置；自动建库迁移 | 基础已实现 | 生产密钥/备份恢复需按部署环境验证 |
| CI | backend-quality、frontend-quality、compose-validation、e2e-acceptance | CI 已通过 | 不能据此推断所有未覆盖功能完成 |
| 身份/组织/项目 | 领域目录、模型/路由/服务、权限依赖 | 基础已实现 | 需完整权限矩阵和前端流程验收 |
| 创作 | creation 模型/服务/API 覆盖故事、剧本、场景、角色、分镜/Shot | 部分实现 | 前端多数仍为演示数据；版本/依赖 stale 闭环待补 |
| 资产 | 上传/列表/详情/下载、版本、checksum、项目归属和引用基础 | 部分实现 | 安全扫描、完整异步处理和引用生命周期待补 |
| Provider | Adapter/Capability/Registry + Mock/Failing | 部分实现 | 未发现 Mork 真实 Adapter 和配置/密钥管理 |
| 生成 | GenerationTask/Attempt 和部分调用/取消路径 | 部分实现 | 请求内执行路径、异步查询/重试/恢复/产物入库未闭环 |
| 工作流 | Workflow/NodeRun/Checkpoint/Outbox/租约/恢复 + Celery | 基础已实现 | 默认模板仍含 mock 节点，需真实业务编排 |
| QA/审核 | 有前端入口和设计文档 | 待建设 | 未发现完整后端 QualityRun/Review/返工 API 与迁移 |
| 时间线 | 前端编辑器原型 | 原型 | 无持久化时间线 API/模型；现有时码不符合 PTS 契约 |
| 媒体导出 | ffprobe、FFmpeg 图片序列 MP4、ExportJob 基础 | 部分实现 | 非多轨时间线渲染；缺少异步完整交付校验 |
| 前端生产体验 | 项目列表可进入真实 project_id 路由；Pinia 项目上下文随路由同步；生产业务页仍复用演示数据 | 部分实现 | 项目切换缓存清理、生产页面真实 API 和权限状态联调待完成 |
| 自动化验收 | develop SHA e2972b80 的 CI 四类 Job 全部成功 | 已验证 | 当前功能覆盖范围以实际测试为准 |

### 7.1 CI 证据
- develop 代码基线 `e2972b80a933718062cf230ad23b5a782a83b33c` 的 CI run #44259347047：backend-quality、frontend-quality、compose-validation、e2e-acceptance 均成功。
- PR #40 文档 CI run #44272707942：同样四类 Job 均成功。
- 当前 develop 头为本文件所记录 SHA；代码没有在 PR #40 中改变。后续代码提交需重新取得对应 SHA 的 CI 证据。

## 8. 阶段路线与依赖

| 阶段 | 交付 | 前置依赖 | DoD |
|---|---|---|---|
| R0 基线和契约 | 测试基线、OpenAPI/模型盘点、偏差 Issue | 当前工程 | 所有现有 CI 检查有记录；迁移/路由/权限矩阵可重复 |
| R1 身份与项目授权 | 成员/角色矩阵、项目上下文、IDOR 防护 | R0 | 401/403/跨项目负向 E2E |
| R2 创作真实化 | Story/Script/Version/Scene/Shot API + 前端联调 | R1 | 创建/编辑/刷新/历史版本通过 |
| R3 资产加固 | 安全上传、不可变版本、项目内引用 | R1/R2 | checksum、越权下载、跨项目拒绝 |
| R4 Mork 与生成 | Mork Adapter、配置、异步 Task/Attempt、产物登记 | R2/R3 | 未配置错误；真实受控调用；重试/恢复/幂等 |
| R5 QA/审核/返工 | RuleSet、QualityRun/Issue、ReviewRecord、stale | R2/R3/R4 | FAIL 阻断；审核版本绑定；新版本重新审核 |
| R6 时间线/导出 | PTS 模型、TimelineVersion、Media Worker | R3/R5 | 混合帧率/音频精确时码；MP4 完整解码 |
| R7 生产验收 | 安全、备份恢复、端到端部署验收 | R1–R6 | 干净环境从项目创建到 MP4 下载 |

## 9. 交付与变更管理
- Issue 是任务、依赖、验收和风险唯一事实来源；一个 Issue 控制在 0.5–3 工作日。
- 常规开发直接集成到长期 develop，不创建常规 feature/fix/task 远程分支；docs/* 仅用于跨文档治理例外。
- 文档与代码同 PR 更新；API/模型/迁移变化同步 OpenAPI、数据规范、测试与交互文档。
- 自动合并只能在 exact SHA 的必需 CI、策略检查和保护规则成功后执行，不绕过门禁。
- 正式发布 develop → main 使用 merge commit。
- 进入 develop 仅代表集成；只有业务验收和正式发布后才可宣称交付。


### R1 首个增量交付（2026-11-18）
已完成第一步：移除 App.vue 的 demo-project 硬编码；新增 `web/src/stores/project.ts` 管理当前项目 ID，并由 `route.params.projectId` 同步；项目列表新增“进入项目”入口；补充 Pinia 单测和导航 E2E。此交付仅解决项目上下文入口，不代表所有生产页已接真实 API，也不代表完整 IDOR/缓存隔离验收完成。


## 2026-11-18 R0/R1 验证证据增补（PR #53 合并后）

当前代码基线：develop `a04acff6eeb2a5675e6d009d22c023b214adf5fc`；main 仍为稳定发布分支，本轮没有发布 main。

### R0 运行时快照（GitHub Actions Run #195）
CI artifact `runtime-contracts` 已实际生成、下载并检查，包含 openapi.json、route-permissions.json、database-schema.json、frontend-api-map.json、duplicate-routes.json。
- FastAPI runtime OpenAPI：53 个路径。
- 路由声明清单：72 条（包含不进入 OpenAPI schema 的路由声明）。
- SQLAlchemy schema：42 张表；Alembic revision 7 个，当前 head 为 `0007_workflow_run_workflow_index`。
- 前端 API Client：15 个调用，15 个匹配；0 个未匹配。
- 后端已注册但当前无前端 API Client 映射：57 条；这是页面/API 接入缺口盘点，不代表 57 个接口错误。
- 重复 method/path：0。
- 无显式 require_permission 声明的 8 条为 auth/health 路由；业务域路由另需结合依赖继承和资源归属检查，不能仅按 AST 列表推断最终授权。

### R1 浏览器与业务边界
- PR #53 的 frontend-browser-e2e 在 Run #195 实际安装 Chromium 并执行 Playwright，Job 成功。
- 当前 Playwright 用例覆盖工作区导航、项目 A/B 路由上下文切换、离开项目清空上下文、无 demo-project 硬编码链接、生产页不显示本地演示记录。
- 该浏览器套件目前尚未覆盖真实登录态下 403 无权限页面和跨项目资源详情/下载请求；不可把现有 E2E 说成完整 R1 浏览器授权验收。
- 项目 Store 已实现 contextVersion、AbortController、cleanup 注册和请求上下文有效性判断；useProjectRequest 防止旧项目异步响应写入新项目状态。
- 服务端已增加资产、Creation、Generation、Workflow 和组织/RBAC 的跨项目/跨组织负向 API 测试；没有资产删除路由，因此不宣称已覆盖资产删除 IDOR。

### 验收状态
R0 运行时导出、模型迁移 drift 检查、前端映射盘点已有实际 CI 证据；R0 文档/权限审阅仍需合并本轮 docs PR 后复核 Issue 验收条目。
R1 后端隔离和项目上下文基础已实施，但浏览器 403/跨项目资源访问场景仍缺；真实业务页面 API 接入和成员权限变更后的缓存失效仍未完成。Issue #42/#43 在对应验收项补齐前保持开放。


## R1 项目访问前置授权（2026-11-18，待 CI 验证）

- Web Router 在生产构建中打开项目工作区前先请求 `GET /projects/{project_id}`，由后端项目成员权限作最终授权。
- 未登录访问项目路由跳转登录并保留 redirect；401 清除本地会话；403 显示明确无权限状态；404 显示项目不存在；权限服务不可用时 fail closed，不渲染项目业务页。
- 新导航会 abort 旧的项目授权检查，旧检查结果不得授权新路由。
- Playwright 改为通过 Vite production preview 运行，并连接 CI 独立 PostgreSQL/Redis 和真实 FastAPI 服务；测试数据在临时 CI 数据库中 bootstrap。
- 新增浏览器场景：匿名访问重定向、成员在项目 A/B 间切换、无成员项目 C 返回 403 页面、跨项目 Asset detail/download 返回 403。
- 此代码已提交 develop；最终通过情况以本次 CI run 为准，未通过前不计入验收完成。


### 项目成员撤销与缓存授权复核
- 新增 `DELETE /projects/{project_id}/members/{user_id}`：仅 `projects:manage` 可执行，将成员标记为 inactive 并记录 `project.member_removed` 审计事件；不允许移除项目 owner。
- 项目列表仅返回活跃成员可访问的项目。即使浏览器仍保留撤销前的旧项目链接，进入项目时仍会重新请求项目详情并由服务端返回 403。
