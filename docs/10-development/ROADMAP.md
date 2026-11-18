# 实施路线图（基于现状核实）

> 基线分支：develop  
> 基线提交：fa9f00b9996c5a70e40a7b8c10386e93af19ac64（2026-11-18）  
> 状态：实施规划；本文件区分仓库代码现状与目标建设，不代表所有目标已经实现。  
> 目录约束：保留现有仓库目录结构；本路线不包含 src/app、web、migrations、tests 等既有目录的整体迁移、重命名或重组。

## 1. 本轮核实范围与结论

本轮通过 GitHub 仓库 develop 分支核对了目录树、核心领域代码、路由、ORM Model、Alembic 迁移、前端页面/API、测试文件、CI 工作流和现有产品设计文档。

### 1.1 当前目录结构（保持不变）

后端现有结构：

```text
src/app/
├── bootstrap/
├── config/
├── dependencies/
├── domains/
│   ├── assets/
│   ├── audit/
│   ├── auth/
│   ├── creation/
│   ├── generation/
│   ├── health/
│   ├── organizations/
│   ├── projects/
│   ├── roles/
│   ├── users/
│   └── workflow/
├── infrastructure/
│   ├── providers/
│   ├── broker.py
│   ├── db.py
│   ├── http_client.py
│   ├── media.py
│   ├── redis.py
│   └── storage.py
├── middleware/
├── packages/
├── public/
├── router/
├── utils/
├── workers/
└── main.py
```

前端现有结构：

```text
web/src/
├── api/
├── assets/
├── components/
├── composables/
├── layouts/
├── router/
├── stores/
├── styles/
├── types/
├── utils/
├── views/
│   ├── assets/
│   ├── auth/
│   ├── dashboard/
│   ├── editor/
│   ├── episodes/
│   ├── exports/
│   ├── organizations/
│   ├── production/
│   ├── projects/
│   ├── reviews/
│   ├── roles/
│   ├── storyboards/
│   ├── stories/
│   ├── tasks/
│   └── users/
├── App.vue
└── main.ts
```

其他现有结构包括 migrations/versions、tests/domains、tests/infrastructure、tests/workers、web/tests/unit、web/tests/e2e、docs、docker、scripts 和 .github/workflows。实施时沿用这些位置；新增代码优先放入对应现有目录，不做全量目录搬迁。

### 1.2 实现状态口径

| 状态 | 本路线定义 |
|---|---|
| 已有基础实现 | 后端存在可调用路由/服务和持久化模型；仅代表基础能力存在，不代表生产验收完成 |
| 部分实现 | 有部分领域对象、API、任务或测试，但链路、边界、异常或 UI 未闭环 |
| 原型/Mock | 前端演示数据、静态交互、Mock Provider 或内存状态，不算真实生产业务闭环 |
| 待建设 | 当前目录和代码中未发现可证明的实现 |
| 待运行验证 | 代码和测试存在，但本轮未在目标环境实际执行，不能宣称通过 |

### 1.3 当前实现盘点

| 能力域 | 当前可确认实现 | 状态 | 主要缺口 |
|---|---|---|---|
| 工程骨架 | FastAPI app factory/bootstrap、配置、数据库、Redis、Celery、Docker Compose、健康检查、CI 工作流 | 已有基础实现 | 当前提交的 CI 运行结果与目标部署环境仍需验证 |
| 身份认证 | auth、users、roles 领域；登录/令牌相关路由和权限依赖；测试目录存在 | 已有基础实现 | 组织成员生命周期、权限矩阵和真实前端完整联调需逐项验收 |
| 组织与项目 | organizations、projects 领域及项目创建/列表/详情/成员能力 | 已有基础实现 | 组织/部门/项目成员边界及多组织场景需补充端到端验证 |
| 内容创作 | creation 聚合域包含 Story、StoryBible、Episode、Script、Scene、Dialogue、Character、Prop、Storyboard、Shot、ShotContract 等模型、服务和路由 | 部分实现 | 编辑器版本协作、对象关系、发布状态、下游 stale 传播及前端真实 API 联通不足 |
| 资产 | assets 域含上传、列表、详情、下载、版本、项目归属、checksum、媒体探测和引用记录 | 部分实现 | 文件安全扫描、异步处理、版本引用一致性、归档/删除保护、跨域关系完整性待补 |
| AI Provider | ProviderAdapter 协议、Capability、Registry、MockProvider、FailingProvider | 部分实现 | 当前无 Mork 真实适配器、无完整 Provider 配置/密钥引用管理；不得把 Mock 结果当真实模型产物 |
| 生成任务 | GenerationTask、TaskAttempt、幂等键、Provider 调用及取消相关逻辑 | 部分实现 | 生成 API 当前存在请求内执行路径；异步化、任务列表/重试/恢复/事件推送、真实产物入库需要闭环 |
| 工作流 | WorkflowDefinition/Version/Run/NodeRun、Checkpoint、Outbox、租约、重试/恢复服务和 Celery 任务 | 已有基础实现 | 默认模板仍使用 mock；需验证真实业务节点、任务隔离、并发和故障恢复 |
| 自动 QA / 人工审核 | 未发现独立质量与审核领域模型、路由及迁移；前端有 reviews 页面入口 | 待建设 | QualityRun/Issue、ReviewRecord、项目统一审核权限、返工和版本绑定 |
| 时间线 | 前端有时间线展示原型 | 原型/Mock | 未发现持久化 Timeline/Track/Clip/TimelineVersion 模型与 API；没有 PTS/time_base 权威契约 |
| 媒体处理 | storage 本地私有存储、ffprobe 探测、FFmpeg 图片序列生成 MP4 | 部分实现 | 当前是图片序列幻灯片导出，不是基于时间线的音视频剪辑/混轨渲染 |
| 导出 | assets 域有 ExportJob 和同步 slideshow 导出入口 | 部分实现 | 无时间线版本快照、异步 Export Worker、完整 profile、音轨/字幕合成及正式交付流程 |
| 前端 API | API client 与 auth、organizations、projects、roles、users 等 API 文件 | 部分实现 | 生产模块多数页面尚未对应真实领域 API 客户端 |
| 前端业务页面 | stories/episodes/assets/storyboards/tasks/reviews/editor/exports 路由和页面入口存在 | 原型/Mock | 多个页面复用 ProductionModule.vue，展示演示数据；时间线和导出明确为交互原型 |
| 自动化测试 | 后端 pytest 按 domains/infrastructure/workers 分层；前端 Vitest、Playwright 配置和少量测试 | 已有基础实现 | 当前 E2E 仅验证工作台导航，缺少从项目创建到成片下载的完整真实链路 |
| 数据库迁移 | Alembic 0001–0006：初始、身份权限、creation、generation、workflow、media assets | 已有基础实现 | 未见 QA/审核/时间线专用迁移；新模型必须先设计迁移与约束 |

### 1.4 重要事实与边界

1. 当前 develop 的基线提交为 467ef96d4b39bac483e4753efc510afa4e0e0c4d；PR #39 已合并，变更仅为产品设计文档。
2. PR #39 的合并不代表运行时代码已实现六项产品决策。
3. Provider Registry 当前注册 MockProvider 和 FailingProvider；默认工作流模板也使用 mock。Mork Provider Adapter 尚未在当前代码树中出现。
4. 前端 ProductionModule.vue 明确展示“演示数据”；时间线使用毫秒示例，导出按钮仅修改演示状态，不会调用 FFmpeg。
5. 当前后端导出实现是图片序列生成 MP4；不能描述为完整 NLE 时间线导出。
6. 当前媒体探测将 ffprobe 秒值转换为毫秒，导出参数包含 float 秒；这不满足产品设计中整数 PTS + 有理数 time_base 的最终时码契约。
7. 当前 combined commit status 查询没有返回状态项；本轮没有执行本地测试，也没有据此宣称 CI 通过。需要在 PR/Actions 中取得实际运行结果后再确认。
8. Issue #36、#37 当前仍为开放状态；产品设计文档是设计基线，不等同于实施验收。

## 2. 实施原则与不变约束

- 保留现有目录结构和模块入口，不做 src/app 垂直域整体搬迁，不把 web/src/views 重组为另一套新目录。
- 后端继续采用模块化单体；复用现有 domains、infrastructure、workers、router、public、dependencies。
- 前端继续使用 web/src 下现有 api、stores、router、views、components、composables 结构；按现有页面逐步替换 Mock，不一次性推倒重写。
- 现有 creation 聚合域继续承载故事/剧本/分镜相关能力；现有 assets 域继续承载资产与当前导出基础能力。只有在职责边界清晰且有 ADR/Issue 说明时，才新增同级领域目录。
- PostgreSQL 是业务状态事实来源；Redis 是缓存/消息协调；Celery 负责异步执行；对象文件存储不代替业务元数据。
- 资产必须 project_id 归属；跨项目共享、搜索和引用禁止。
- 审核采用项目级统一 review permission；不做多级会签、不按内容类型配置审核角色；新版本重新 QA/审核，不继承旧审核结论。
- 本期不做第三方系统连接、Webhook 接入、爬虫采集和版权管理模块。
- Provider 默认适配器目标为 Mork；未完成真实配置时必须明确报 PROVIDER_NOT_CONFIGURED，不得伪造生成结果。Mock 只用于测试和明确标记的本地演示。
- 媒体时间以整数 PTS + 有理数 time_base 为权威契约；禁止浮点秒作为数据库/API/版本比较权威字段。

## 3. 更新后的阶段路线

阶段不再从“空白项目”起算，而是以当前已有代码为起点，优先补齐真实业务闭环。阶段估算为小型全栈团队工作日粗估，不是日历承诺；完成时间取决于人员、供应商、部署环境和历史数据。

| 阶段 | 建议估算 | 复用现有位置 | 主要交付 | 完成判定 |
|---|---:|---|---|---|
| R0 现状基线与质量门禁 | 2–3d | docs、tests、.github/workflows、scripts | 建立可重复基线、测试报告、缺口 Issue | CI 与空库迁移有实际证据 |
| R1 身份/项目权限收口 | 3–5d | domains/auth、users、roles、organizations、projects；web/src/views 与 stores | 组织/项目权限矩阵、项目上下文、前端真实联调 | 401/403/跨项目隔离 E2E |
| R2 创作域真实化 | 5–8d | domains/creation；web/src/views/stories、episodes、storyboards | 故事圣经、剧集/剧本、场次/对白、分镜真实持久化和版本 | 创建/编辑/刷新/版本历史端到端通过 |
| R3 资产域加固 | 4–6d | domains/assets、infrastructure/storage.py、media.py；web/src/views/assets | 上传安全、版本、项目内引用、预览与删除保护 | checksum、越权下载、跨项目引用拒绝 |
| R4 Provider 与生成闭环 | 5–8d | infrastructure/providers、domains/generation、workers；web/src/views/tasks | Mork Adapter 配置、真实调用契约、异步任务、Attempt、产物登记 | Mock 契约测试 + 受控真实 Provider 测试 |
| R5 工作流与 QA/审核 | 6–9d | domains/workflow、domains/creation、domains/assets、workers；web/src/views/reviews | 业务节点、QualityRun/Issue、ReviewRecord、返工、stale 传播 | 版本绑定、失败阻断、返工闭环 E2E |
| R6 时间线与媒体导出 | 8–12d | domains/assets、infrastructure/media.py、storage.py、workers；web/src/views/editor、exports | PTS/time_base、TimelineVersion、轨道/片段、异步 FFmpeg 导出 | 多帧率混轨、音画同步、MP4 解码与来源追溯 |
| R7 生产验收与运营 | 4–6d | tests、scripts、docs、Compose、CI | 安全、备份恢复、性能、全链路 E2E、运行手册 | 干净环境部署与项目到 MP4 验收通过 |

以上阶段可并行的工作必须先满足依赖；R0 的测试基线应先建立。R1–R3 可按团队能力并行部分前端/API 工作；R4 依赖创作与资产输入契约；R5 依赖版本模型；R6 依赖审核通过的资产与统一时码；R7 依赖核心链路。

## 4. 各阶段具体实施任务

### R0：现状基线与质量门禁

- 固定 develop 基线 SHA，保存目录树和当前迁移版本。
- 在 CI 中确认 backend-quality、frontend-quality、compose-validation、PR policy gate 的真实结果。
- 实际执行 Ruff、pytest、Alembic 空库 upgrade、前端 typecheck/lint/Vitest/build、Compose config。
- 记录现有失败与环境依赖，不以跳过测试或 mock 绿灯替代。
- 对现有 API 生成 OpenAPI 快照，盘点每个路由的权限和响应契约。
- 对现有数据库 Model 与 Alembic revision 做一致性核对。
- 建立现有功能的回归测试基线；不在本阶段改变目录结构。

### R1：身份、组织、项目权限收口

- 复核 auth/users/roles/organizations/projects 已有服务和迁移，优先补缺而非重写。
- 明确组织成员、项目成员、角色、权限的继承边界。
- 所有项目资源请求统一解析 project_id 并执行服务端授权。
- 检查资源 ID 直接访问、下载、更新、删除的 IDOR 风险。
- 前端移除开发路由守卫绕过生产鉴权的误用；开发 Mock 必须显式开关。
- 将当前 demo-project 固定上下文改为路由参数和真实项目选择状态。
- 验收：不同组织/项目成员访问矩阵、401/403、跨项目资源访问拒绝。

### R2：创作域真实化

- 沿用 domains/creation 的 models/repository/service/router/schemas 组织，不迁移目录。
- 复核 Story、StoryBible、Episode、Script、ScriptVersion、ScriptScene、ScriptDialogue、Character、ProductionScene、Prop、Storyboard、Shot、ShotContract 的现有 CRUD 和版本行为。
- 统一每个可编辑对象的版本创建规则；历史版本不可覆盖。
- 对 ScriptVersion、ShotContract 和引用资产版本建立明确关联。
- 为故事、剧集、剧本、场次、对白、角色、场景、道具、分镜建立真实 API 客户端。
- 将 web/src/views/production/components/ProductionModule.vue 中对应的演示数据逐个替换为真实 API；保留现有路由和页面目录。
- 验收：创建、编辑、列表、详情、刷新后持久化、版本历史和并发冲突测试。

### R3：资产域加固

- 沿用 domains/assets 与 infrastructure/storage.py。
- 保留 project_id 必填与项目级授权；AssetRelation/asset_references 两端引用必须验证项目一致。
- 上传增加扩展名、MIME、magic bytes、大小、路径、恶意文件扫描策略；扫描未完成不得发布。
- 将大文件处理转为异步任务；上传临时对象、校验 checksum 后原子登记。
- 版本内容不可变；当前版本指针与历史版本分离。
- 引用存在时禁止物理删除；提供归档、解除引用和反向引用查询。
- 前端 assets 页面接入真实上传、列表、详情、版本和下载 API。
- 验收：跨项目引用拒绝、无权限下载拒绝、checksum 校验、文件缺失恢复和版本追踪。

### R4：Provider 与生成任务闭环

- 沿用 infrastructure/providers/base.py、registry.py 及 domains/generation。
- 保留 ProviderAdapter/Capability 契约；新增 Mork Adapter 实现真实请求/响应和错误归一。
- Provider 配置通过配置层管理 provider_key、base_url、secret_ref、model_id、capabilities、timeout、rate_limit、enabled；密钥不进入数据库明文、日志或前端。
- 未配置有效 Mork 凭据时返回 PROVIDER_NOT_CONFIGURED；不回退为 Mock 成功。
- 将当前请求内同步执行拆为持久化任务 + Outbox + Celery Worker；API 返回 task_id。
- 建立任务查询、Attempt、重试、取消、租约/心跳、失败分类和事件通知；SSE 仅作通知，快照 API 为最终状态。
- 每个任务固定输入 Script/ShotContract/AssetVersion、Provider 配置版本、模型、Prompt 模板和参数快照。
- 产物校验后登记为 assets 域中的 Asset/AssetVersion，并保存 generation_task_id 来源关系。
- 验收：Mock 契约测试、受控真实 Mork 测试、429/5xx/timeout、重复提交、Worker 重启恢复和产物可追溯。

### R5：工作流、QA、审核与返工

- 沿用 domains/workflow 的 WorkflowRun/NodeRun/Checkpoint/Outbox/Celery 机制，不引入第二套工作流引擎。
- 把默认演示模板逐步替换为真实业务节点：内容校验、生成、资产登记、QA、等待人工审核、返工。
- 建立 QualityRuleSet/QualityRun/QualityIssue；规则执行异常不得误判 PASS。
- 建立 ReviewRecord/ReviewComment/ReworkTask，审核绑定 object_version_id。
- 统一项目级 review permission；不建设多级会签、类型化审核角色或 WAIVED 豁免。
- 对象创建新版本后重新 QA/审核；旧版本审核记录保留但不可继承。
- 通过现有资产引用与内容关系计算下游 stale；明确提示受影响的分镜、生成结果和时间线。
- 验收：QA FAIL 阻断下游、审核拒绝创建返工、新版本重审、上游变更 stale 传播。

### R6：精确时间线与媒体导出

- 沿用 domains/assets、infrastructure/media.py、storage.py 和 workers；时间线能力按现有领域边界实现，必要时在 domains 下新增清晰模块，但不得移动现有目录。
- 建立整数 PTS + 有理数 time_base 值对象和统一序列化 schema；主时钟采用产品设计确认的 1/70,560,000 秒。
- 视频轨使用整数帧序号与精确帧率分数；音频轨使用整数采样点与 sample_rate；源媒体保留原生 time_base。
- 区间统一左闭右开 [in,out)，服务端使用整数/有理数运算；不以 float 秒作为权威持久化/API 字段。
- 建立 Timeline/TimelineVersion/Track/Clip；每个 Clip 固定引用 AssetVersion。
- 前端 editor 页面逐步接入真实轨道、片段、保存版本、播放预览和 stale 提示。
- 将当前同步图片幻灯片导出保留为单独能力，不把它等同完整时间线导出。
- ExportJob 改为绑定不可变 TimelineVersion 和 ExportProfile 的异步任务；FFmpeg 渲染后执行 ffprobe、checksum、完整解码检查，再原子发布。
- 验收：23.976/24/25/29.97/30/50/59.94/60 fps 与 44.1/48 kHz 换算；60 分钟混轨无累计漂移；保存/读取/预览/导出时码一致；输出 MP4 可完整解码。

### R7：生产验收与运营

- 补齐全链路 E2E：组织/项目 → 故事/剧本 → 资产 → 分镜 → 生成 → QA → 审核 → 时间线 → 导出 → 下载。
- 补齐权限、安全、IDOR、上传绕过、路径穿越、密钥泄露、任务重复和恢复测试。
- 验证 PostgreSQL 备份恢复、对象存储备份、任务队列重启和服务滚动重启。
- 固化 API、Worker、存储和 FFmpeg 的日志、指标、告警与 correlation_id。
- 用量/预算统计先保证任务级用量可记录；组织报表、复杂预算策略作为后续增强。
- 更新 README、部署手册、开发手册、API 契约和故障处理文档。

## 5. 前端页面实施映射（保留现有路径）

| 现有页面/目录 | 当前定位 | 更新后的工作 |
|---|---|---|
| web/src/views/auth | 登录入口 | 与真实认证、令牌刷新和退出流程联调 |
| web/src/views/organizations、users、roles | 企业管理 | 补齐真实组织/成员/角色 API 与权限状态 |
| web/src/views/projects | 项目管理 | 接真实项目列表、创建、详情、成员和项目上下文 |
| web/src/views/stories | 故事圣经 | 从 ProductionModule 演示数据改为 creation API |
| web/src/views/episodes | 剧集/剧本 | 接真实 Episode/Script/Version/Scene/Dialogue |
| web/src/views/assets | 资产库 | 接真实上传、预览、版本、下载和引用 |
| web/src/views/storyboards | 分镜 | 接 Storyboard/Shot/ShotContract API |
| web/src/views/tasks | AI 任务 | 接 GenerationTask/Attempt/WorkflowRun 快照和事件 |
| web/src/views/reviews | 审核质量 | 待 QA/Review API 完成后接入，不提前制造假审核操作 |
| web/src/views/editor | 时间线 | 保留现有页面入口，后续接 PTS/time_base 时间线模型 |
| web/src/views/exports | 导出交付 | 先明确区分现有图片序列导出与未来时间线导出 |
| web/src/views/production/components | 当前共用演示组件 | 分步抽取真实 API composables 和业务组件，不一次性全量重写 |

## 6. 测试和验收门槛

每个阶段必须同时提供代码、迁移、测试和证据；“页面可见”或“路由返回 200”不等于功能完成。

| 类别 | 必需门槛 |
|---|---|
| 后端 | Ruff、MyPy（按项目配置）、pytest 单元/集成、API 权限和错误路径 |
| 数据库 | Alembic 空库 upgrade；模型与迁移一致；关键约束测试 |
| 前端 | TypeScript typecheck、ESLint、Vitest、生产 build |
| 异步任务 | 幂等、重复消息、重试、超时、取消、租约过期、Worker 恢复 |
| Provider | Mock 契约测试；真实 Provider 在受控凭据环境测试，不进入普通 CI 产生费用 |
| 媒体 | ffprobe、FFmpeg、时间码换算、音画同步、checksum、完整解码 |
| E2E | 至少一条项目到 MP4 下载真实链路；权限负向场景 |
| 交付 | PR 关联 Issue、说明变更/迁移/风险/回滚、CI 证据和未解决问题 |

CI 当前定义了 backend-quality、frontend-quality、compose-validation 等检查；必须查看目标 SHA 的实际 workflow/check 结果后，才可记录通过。本轮代码盘点没有执行测试，不作测试通过声明。

## 7. Issue 拆分建议

保留现有 Issue #36（前端信息架构评估）和 #37（产品功能设计基线）作为背景/总纲；实施任务建议拆分为：

1. R0：建立 develop 当前质量基线与代码覆盖清单。
2. R1：身份、组织、项目权限矩阵与前端真实联调。
3. R2：creation 域版本规则与创作 API 闭环。
4. R3：assets 上传安全、版本引用和项目隔离。
5. R4：Mork Provider Adapter 与配置管理。
6. R4：生成任务异步化、Attempt、产物入库。
7. R5：QA 规则引擎和质量问题模型。
8. R5：项目级审核、返工和 stale 传播。
9. R6：PTS/time_base 与 TimelineVersion 模型。
10. R6：FFmpeg 时间线导出 Worker 和交付校验。
11. R7：端到端、安全、备份恢复和部署验收。

每个 Issue 必须包含现状证据、范围、复用的现有目录/文件、API/数据迁移、权限、测试矩阵、验收条件和回滚策略。开发继续遵循仓库分支策略：常规工作集成到 develop，不为每个常规需求建立远程 feature 分支；正式发布通过 develop → main 的规定流程完成。

## 8. 管理和完成定义

- 本路线是根据 2026-11-18 develop 代码树核实后的实施基线；代码变化后需重新核对，不把本文件当作永不过期的实现清单。
- 每个阶段开始前更新相关 Issue 的依赖和验收；阶段结束时附 CI、测试、迁移和演示证据。
- 若实现与既有目录/模块职责冲突，先提交 ADR/Issue 说明，不直接搬迁目录。
- 进入 develop 只代表集成；进入 main 且验收通过才算正式交付。
- 最终 MVP 完成定义：在非演示环境中真实完成一次项目生产链路，所有输入、版本、权限、任务、QA、审核、时间线和导出结果均可追溯，并获得可解码、可下载的 MP4。

## 2026-11-18 最新开发进度校准

本路线图的实施事实基线更新为当前 develop HEAD `fa9f00b9996c5a70e40a7b8c10386e93af19ac64`。该 HEAD 包含 main 已有的运行配置/自动建库代码以及 PR #39 产品决策、PR #40 路线图更新。

### 已通过 CI 的工程进展
- develop 代码提交 `e2972b80a933718062cf230ad23b5a782a83b33c` 的 CI run `44259347047`：backend-quality、frontend-quality、compose-validation、e2e-acceptance 全部成功。
- PR #40 文档提交 `97fc36b59b0ac9238b2d158370d6ac4f8b7582ab` 的 CI run `44272707942`：四类 Job 全部成功。
- 已实现运行配置分层、API_HOST/API_PORT 单一配置、数据库缺失时自动建库和迁移、Compose 健康/就绪检查、Celery Worker/Beat 检查、基础 E2E 与备份恢复检查。
- 上述结果只证明工作流覆盖范围内的检查通过，不表示 Mork、QA/审核、Timeline、多轨导出或前端生产链路已经实现。

R0 当前状态：工程 CI 基线已存在并通过；仍需补齐 OpenAPI/权限矩阵/模型迁移盘点和功能缺口 Issue。R0 不应重复搭建 CI 或基础设施。


## 2026-11-18 R1 开发进度
已在 develop 落地项目上下文第一步：移除 demo-project 硬编码，项目列表可进入 `/projects/:projectId/stories`，Pinia store 与路由参数同步，增加单元测试和导航 E2E。R1 后续仍需清理项目切换缓存/订阅、接入真实生产 API，并完成跨项目 IDOR 负向验证；Issue #43 保持开放。


## 2026-11-18 R0/R1 状态更新（PR #53 已合并）

当前 develop 基线：`a04acff6eeb2a5675e6d009d22c023b214adf5fc`；main 未变更。PR #53 已合并，CI Run #195：
https://github.com/AnRedSky/short-play-platform/actions/runs/44294871572

### CI 实际结果
- backend-quality：通过（含 Ruff、pytest、空库 migration、Alembic drift、runtime contract export）。
- frontend-quality：通过（typecheck、lint、unit tests、production build）。
- frontend-browser-e2e：通过，实际执行 Chromium Playwright。
- compose-validation：通过。
- e2e-acceptance：通过，包含备份恢复验证。
- Runtime artifact：53 OpenAPI paths、72 route declarations、42 tables、7 revisions、15/15 frontend API calls matched、57 backend routes currently without frontend API Client、0 duplicate routes。

### R0
R0 的运行时 OpenAPI、ORM/Migration 自动差异核查和页面 API 映射快照已生成并检查。仍需将快照差距、路由依赖继承和权限矩阵逐项人工审阅后，才可关闭 #42。

### R1
- 项目切换请求取消、上下文版本和 cleanup 机制已实现。
- 服务端跨项目引用和资源读取/修改边界已有负向 API 测试。
- Playwright 目前证明项目路由切换和离开项目时清理上下文，但尚未覆盖真实登录态 403 页面和跨项目资源 API 的浏览器访问拒绝。
- 生产页真实 API 接入、权限变更后的缓存失效、资产删除（当前不存在删除 API）仍未完成。
- 不因 PR #53 的 CI 全绿而关闭 #43；补齐浏览器权限场景并逐项满足 Issue 验收后再关闭。

### 执行顺序约束
继续只处理 R0/R1；未完成 Issue #42/#43 验收前，不启动 R2。线上真实环境/真实用户数据测试不在本轮范围内。


## R1 项目访问授权与真实浏览器测试增量（2026-11-18）

- 生产路由增加项目详情访问前置校验，401/403/404/服务不可用分别处理；未知错误 fail closed。
- 项目切换时取消旧的权限检查请求，防止异步竞态。
- Playwright 从仅启动 Vite dev server 改为 production build + preview，并在 CI 启动临时 PostgreSQL、Redis 和 FastAPI。
- E2E fixtures 通过真实 API bootstrap 管理员、创建 projects:read 用户、创建 A/B/C 项目、仅授予 A/B 成员资格并在 C 上传测试资产。
- 浏览器验收覆盖匿名访问、A/B 项目切换、C 项目 403、C 项目资产详情/下载 403。
- 此阶段仍只处理 R1，不进入 R2。以上变更的最终验收以 CI run 成功和浏览器报告为准。


CI 调试记录：PR #56 首次 Run #206 的 backend-quality、frontend-quality、compose-validation 均通过；Playwright job 在启动前端服务时发现项目没有 `npm run preview` script。已将 Playwright webServer 命令修正为直接调用 `npx vite preview`，等待更新后的完整 CI 复验。该失败属于测试环境启动命令问题，不是浏览器用例通过证据。


第二次 Playwright 调试记录：Run #208 的真实 API 已正常启动，失败原因是 Playwright APIRequestContext 对以斜杠开头的 URL 重置了 `/api/v1` 前缀，导致 bootstrap 请求落到 `/auth/bootstrap` 并得到 404。已将 fixture 改为基于带尾斜杠的 API base URL 使用相对路径，并修正浏览器页面导航为绝对站内路径；更新后继续重跑。


第三次 Playwright 调试记录：Run #211 的 API base path 已修正，fixture 成功创建用户和项目；随后发现项目成员角色枚举不包含 `viewer`（允许值为 owner/producer/writer/director/artist/editor/reviewer），并暴露了 RequestValidationError 的 ctx.ValueError 无法 JSON 序列化、错误返回 500 的后端问题。已将 fixture 改为合法的 reviewer 角色，并修复 `register.py` 对 Pydantic 验证错误上下文的 JSON 安全序列化；fixture 增加非法角色应返回 422 的断言。更新后继续重跑。


第四次 Playwright 调试记录：Run #214 已通过 API bootstrap、用户/角色/项目创建、成员角色校验（包含非法 viewer 返回 422）和项目成员加入；在上传跨项目测试资产时发现浏览器专用 API Job 未安装 ffprobe，API 正确返回 MEDIA_PROBE_UNAVAILABLE。已为该 Job 增加 FFmpeg/ffprobe 安装步骤，保证真实上传路径具备与 backend-quality 相同的媒体探测依赖，更新后继续重跑。
