# 企业级 AI 短剧智能生产平台总体方案

## 1. 产品定义
建设面向企业内部影视创作与制作团队的私有化 AI 短剧生产管理平台。平台把故事创作、影视资产、镜头设计、外部 AI 生成、质量审核、剪辑合成和交付纳入统一的、可追踪的生产体系。

### 1.1 目标
1. 企业用户在授权项目中协作完成剧集生产。
2. 剧本、角色、场景、道具、镜头和素材具备版本与引用关系。
3. AI 任务统一接入、异步执行、可追踪、可重试、可取消和可恢复。
4. 以镜头为最小生产单元，支持独立生成、审核、返工和版本回溯。
5. 通过时间线组织视频、音频和字幕，使用企业内部 FFmpeg 导出成片。
6. 管理员可控制用户、权限、模型、凭据、数据外发、用量和审计。
7. 可在企业 Linux 环境部署、备份、升级和恢复。

### 1.2 非目标
- 不建设 SaaS 多租户、租户计费和租户自助开通。
- 不部署 Ollama、vLLM、ComfyUI 等本地模型推理服务。
- 不建设 GPU 推理集群或自研基础模型。
- MVP 不实现专业级非线性编辑器、实时多人协同剪辑。
- 不拆分微服务、不引入 Kubernetes 或公开插件市场。
- 不允许不可信插件代码直接加载进 API 进程。
- 不承诺任何第三方模型的质量、可用性、价格或生成结果可直接商用。

## 2. 用户与权限
角色包括系统管理员、组织管理员、项目负责人/制片人、编剧/策划、美术/分镜、视频制作人员和审核人员。权限采用系统 RBAC + 项目成员授权双层校验。组织/部门用于人员组织和管理，不等同 SaaS tenant。每次项目资源读取、修改、生成、审核和导出均在服务端验证项目访问权限。

## 3. 核心生产闭环
创意策划 → 故事圣经 → 剧本/分集 → 场次拆分 → 角色/场景/道具资产 → 分镜与 Shot Contract → 图片/视频/TTS/ASR/音乐生成 → 技术/内容/连续性质量检查 → 人工审核 → 时间线编辑 → FFmpeg 合成 → 成片验收与归档。

项目 Project 是协作与授权边界；剧集 Episode 是生产管理单元；镜头 Shot 是生成、审核、返工和成本追踪的最小核心单元。

## 4. 功能范围
### 4.1 企业管理
用户、组织、部门、角色、权限、项目成员、项目授权、Provider 凭据、模型配置、数据外发策略、用量预算、审计日志和系统设置。

### 4.2 创作策划与剧本
题材、创意、故事大纲、世界观、人物关系、分集规划、开篇钩子、每集冲突与悬念、场景、动作、对白、情绪标注、版本比较、审核和锁定。

### 4.3 影视资产
角色档案/外观/服装/状态、场景空间/光线/天气、道具、视觉风格、参考图片、音色档案、文件版本、生成来源和引用关系。

### 4.4 分镜与镜头
场次、镜头顺序、景别、机位、运镜、时长、动作、对白、情绪、参考资产、镜头合同、连续性约束、生成结果、审核和局部返工。

### 4.5 AI 生成
LLM、图片、视频、TTS、ASR、音乐能力；Mock 与外部 Provider；模型能力注册、路由策略、密钥安全、任务状态、Attempt、用量与成本。

### 4.6 媒体与交付
资产上传/预览/下载、时间线、视频轨、音轨、字幕轨、片段裁剪、音量、转场、片头片尾、预览、FFmpeg 渲染、MP4、字幕文件和项目归档。

### 4.7 审核和质量
剧本、资产、镜头和成片审核；技术检测、内容符合度、视觉连续性、交付质量；PASS、REVIEW_REQUIRED、FAIL、WAIVED 质量结果；审核意见、授权豁免和返工历史。

## 5. 总体技术架构
采用模块化单体 + 领域分层 + Provider 适配 + PostgreSQL 持久化业务状态。Vue 3 Web 通过 HTTPS/REST 与 FastAPI 交互，任务状态使用查询/SSE。API 在事务中写业务记录和 Outbox；Celery Worker 执行外部模型调用或媒体处理；PostgreSQL 保存业务/任务元数据，Redis 用于队列与缓存，私有 Storage 保存二进制文件，FFmpeg 在内部执行。

### 5.1 技术选型
- 后端：Python 3.12+、FastAPI、SQLAlchemy 2.x、Pydantic v2、Alembic。
- 异步：Celery + Redis；数据库是业务状态事实来源。
- 数据：PostgreSQL；时间 UTC/TIMESTAMPTZ；主键 UUID。
- 前端：Vue 3、TypeScript、Vite、Pinia、Vue Router。
- 媒体：FFmpeg/ffprobe。
- 存储：私有本地 StorageBackend；后续可适配 MinIO/S3。
- 部署：企业 Linux + Docker Compose + Nginx。
- 工具：uv、npm、pytest、Ruff、MyPy、Vitest、ESLint。

### 5.2 后端领域模块
identity、organization、access_control、projects、episodes、stories、scripts、characters、scenes、props、storyboards、shots、assets、generation、providers、model_management、workflows、reviews、continuity、editing、subtitles、exports、usage、audit、plugin_management。

模块内建议分为 interfaces、application、domain、infrastructure。依赖方向为 interfaces → application → domain；基础设施实现领域定义的端口。Provider 不写业务数据库，业务模块不依赖供应商 SDK。

## 6. 核心业务对象与版本
Project → Episode → Scene → Shot；StoryBible、ScriptVersion、CharacterVersion、SceneVersion、PropVersion、AssetVersion、ShotContractVersion、TimelineVersion、ExportJob 构成可追溯生产数据。
修改上游版本时，不静默覆盖已生成结果；通过依赖快照计算下游对象是否 stale。用户可以查看差异并选择重新生成。源文件不可被剪辑过程覆盖。

## 7. Shot Contract 与视觉连续性
每个镜头在生成前必须形成结构化 Shot Contract，包含叙事目的、镜头参数、画面描述、角色/场景/道具引用、动作、时长、音频、画幅、模型能力约束和质量检查项。引用必须锁定具体资产版本。连续性管理角色外观/服装/状态、场景布局/光线/时间、道具状态、镜头间位置/动作衔接及全片视觉风格。完整规范见 11-production。

## 8. AI Provider 与模型路由
按 Text、Image、Video、TTS、ASR、Music 定义独立能力契约。Registry 注册实现，Capability Catalog 描述模型能力和限制，Router 根据任务能力、输入兼容性、项目策略、预算、可用性和管理员优先级选择模型。Policy 在任何外发前校验数据分类、供应商合同/区域、授权和预算。Mock Provider 是开发和 CI 默认实现；真实 Provider 按供应商独立适配。可选 AI Gateway 只用于确有统一 LLM 网关需求时，不替代多模态业务 Provider。

## 9. 工作流与任务可靠性
Workflow、WorkflowRun、WorkflowNode、WorkflowNodeRun、GenerationTask、TaskAttempt、Checkpoint、Artifact、OutboxEvent 分离。业务事务写任务和 Outbox；Dispatcher 投递 Celery；Worker 以幂等方式执行。外部异步视频任务提交后释放 Worker，通过 Webhook 或轮询获取结果。重试新建 Attempt；超时分类；回调幂等；Worker 崩溃可恢复；取消协作传播；成功节点不无条件重跑。Celery 是执行分发器，不是唯一状态来源。Temporal 仅在长流程复杂度、恢复需求和运维收益明确后通过 ADR 决定是否替代自研业务编排。

## 10. 时间线与媒体导出
时间线由 Timeline、Track、Clip、Transition、AudioMix、SubtitleCue、ExportProfile 构成。Timeline 保存源资产版本、时间基准、轨道顺序、入出点、位置、音量、速度、转场和字幕。MVP 支持基础多轨和片段裁剪，不承诺专业 NLE。FFmpeg wrapper 使用参数数组，禁止 shell 拼接用户输入；导出先临时写入，ffprobe 校验后原子发布。具体规范见 12-editor。

## 11. 质量门禁
技术质量：可解码、分辨率、画幅、帧率、时长、音视频流、文件完整性。内容质量：角色、场景、动作、对白和镜头合同符合度。连续性质量：角色外观、服装、场景、道具和动作衔接。交付质量：字幕、音量、时长、编码和文件完整性。结果分 PASS、REVIEW_REQUIRED、FAIL、WAIVED。WAIVED 必须有权限、原因和审计记录。质量规范见 11-production。

## 12. 数据与存储原则
文件本体不入数据库；存储 storage_key、checksum、mime_type、size、宽高、时长等元数据。私有本地存储通过 StorageBackend 抽象。数据库强制唯一约束、外键和索引；JSONB 不替代核心关系字段。所有 schema 变更通过 Alembic。组织/项目权限不使用 tenant_id 全表注入。

## 13. 安全、隐私与运营
密码使用 Argon2id 等现代哈希；会话/JWT 生命周期明确；密钥应用层加密；密钥材料独立安全注入。项目授权服务端校验；外发策略默认拒绝未授权敏感数据；Provider URL、DNS、重定向、文件下载防 SSRF；上传校验 MIME/签名/大小；FFmpeg 参数数组调用并限制资源；日志脱敏。按用户、部门、项目、剧集、镜头、Provider、模型记录用量。区分供应商账单、返回 usage 和平台估算成本。运营包括队列、失败率、重试率、Provider 延迟、磁盘、备份恢复、依赖扫描和许可证治理。

## 14. 部署
Docker Compose 服务：Nginx/Web、API、Celery Worker（按队列可拆 AI/Media worker 进程）、PostgreSQL、Redis；需要周期任务时启用 Beat。生产容器非 root；PostgreSQL、Redis、媒体文件使用持久卷。生产配置通过安全渠道注入，仓库只保留 .env.example。升级执行迁移、健康检查、冒烟测试和回滚预案。备份覆盖数据库、媒体和必要配置；密钥恢复材料单独保管。

## 15. 测试与交付
单元、集成、Provider 契约、API 权限、工作流可靠性、媒体、E2E、安全和迁移测试。PR 必须 lint/format/typecheck、相关测试、空库迁移和构建通过。核心 E2E 从项目创建走到 MP4 导出。测试环境默认 Mock，不依赖真实模型账单。

## 16. 实施路线
M0 工程基础；M1 身份组织与 RBAC；M2 创作核心域和镜头合同；M3 Provider 与模型能力；M4 持久化工作流；M5 资产、时间线与 FFmpeg；M6 企业部署、安全与 E2E；M7 生产质量和体验增强。工期以 ROADMAP 为基线估算，T0 由团队确认，工作日估算不构成日历承诺。每阶段必须满足对应验收门槛。

## 17. 运营规则
GitHub Issue 是任务唯一事实来源；PR 关联 Issue；至少一名非作者审查；CI 通过后合并。任务有负责人、优先级、依赖、目标日期和可测试验收标准。版本发布记录代码版本、迁移、配置、已知问题和回滚方式。故障分级响应，安全/数据损坏/凭据泄露立即升级。生产模型密钥、用户数据和素材不得进入 Git 或测试日志。

## 18. 外部开源项目与合规
可借鉴短剧工作流、镜头 QA、时间线、模型网关、持久化执行和媒体渲染的设计，但不默认复制代码。任何第三方依赖在合入前核对许可证、版本、商业使用限制、传递依赖、安全公告和分发义务，维护 SBOM。具体清单见 14-compliance。

## 19. 完成定义
只有代码、测试、文档、审查和验收证据全部满足才可关闭任务。设计文档、Issue、截图或演示不能替代可运行代码与测试。每个功能必须说明状态、权限、失败路径、审计、恢复、成本影响和运维要求。

## 2026-11-18 统一实施决策补充

本节与旧版总体方案冲突时，以 `docs/01-architecture/IMPLEMENTATION_BASELINE.md` 为当前实施基线。目录保持仓库现有 `src/app`、`web/src`、`migrations`、`tests` 结构，不执行整体迁移。

本期排除第三方业务系统接入、外部 Webhook 集成、爬虫/采集接入和内容版权管理/采集授权；不排除第三方软件许可证、Provider 服务条款和数据外发安全审查。资产仅项目内共享，必须 project_id 归属，跨项目搜索/引用/共享禁止。

审核采用项目级统一 review permission；不做多级会签、类型化审核角色和 WAIVED 豁免。QA 结果仅 PASS、REVIEW_REQUIRED、FAIL。新版本必须重新 QA/审核，审核记录绑定具体对象版本。

模型默认 Mork Provider Adapter；无有效配置时返回 PROVIDER_NOT_CONFIGURED，禁止静默切换 Mock 或伪造结果。Mock 仅用于 CI 和显式演示环境。异步任务使用 PostgreSQL + Outbox + Celery；外部供应商异步任务优先通过 Provider Adapter 轮询，不建设第三方业务 Webhook 集成。

时间线唯一权威时间格式为整数 PTS + 有理数 time_base；视频帧序号/帧率和音频采样点/sample_rate 均保留整数/分数精度，浮点秒不得作为 API、数据库或版本比较权威字段。专业级 NLE、实时协同仍为非目标。

当前代码已具备身份/项目、创作、资产、生成、工作流、FFmpeg 图片序列导出等不同程度基础；前端生产页面、Mork 真实接入、QA/审核、持久化时间线和多轨导出不可描述为已交付。实际状态以统一实施基线中的代码核验表为准。
