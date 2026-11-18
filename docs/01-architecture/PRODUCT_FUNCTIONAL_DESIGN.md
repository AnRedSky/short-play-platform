# 全产品功能设计：内容全生命周期与资产联动

> 状态：需求/架构设计基线（待产品与技术评审）  
> 版本：1.0-draft  
> 关联：Issue #37；前端信息架构评估 Issue #36  
> 适用范围：短剧平台企业空间、项目生产、AI 内容加工、审核、剪辑与交付  
> 重要声明：本文中的性能数字为 MVP 验收目标，不代表当前系统已达到；协议和字段是目标契约，需在 API/OpenAPI 与领域模型评审后实施。

## 1. 设计目标与现状判定

平台主链路为：创意 → 故事圣经 → 剧集/剧本 → 场次 → 角色/场景/道具 → 分镜/Shot Contract → 图片/视频/语音生成 → QA/人工审核 → 时间线 → FFmpeg → MP4 交付。

本设计覆盖以下模块：
1. 企业身份、组织、部门、角色与权限；
2. 项目空间、项目成员与项目配置；
3. 故事、故事圣经、剧集、剧本、场次和对白；
4. 角色、场景、道具及通用媒体资产；
5. 分镜、镜头和 Shot Contract；
6. AI Provider、模型配置、生成任务、工作流和产物；
7. 自动质量检查、人工审核、返工；
8. 时间线、剪辑版本；
9. 导出、交付、归档；
10. 用量预算、审计、通知和平台运营。

### 1.1 实现状态口径

| 状态 | 判定标准 |
|---|---|
| 已有基础实现 | 仓库存在可调用服务/API，且不是仅前端静态展示；仍需按验收用例确认完整性 |
| 部分实现/契约待核 | 存在部分路由、Schema 或基础领域对象，但关键操作/异常/持久化/事件契约不完整 |
| 原型/演示 | 页面或交互存在，但数据仅在浏览器内存、Mock 或静态配置中 |
| 待建设 | 未发现可证明的生产实现；需要补充领域服务、API、存储、任务或 UI |

当前已核实的前端页面映射明确标注故事、剧集、资产、分镜、AI 任务、审核、时间线和导出主要为 UI 原型 + demo；演示数据不写入后端。项目列表/创建及企业身份/组织/RBAC 有基础 API。生成任务已有创建、详情、取消基础契约；任务列表、重试、SSE 事件、QA 结果、人工审核/返工、媒体上传下载、时间线持久化和真实导出仍有待补齐或核对的契约。不得将“路由已存在”直接等同业务完成。

## 2. 全局领域模型与边界

### 2.1 统一对象

| 对象 | 职责 | 核心字段/约束 |
|---|---|---|
| SourceConnection | 预留外部来源连接抽象（本期不实施） | provider、auth_ref、scopes、status（未来扩展） |
| IngestionRecord | 一次项目内来源接入的不可变原始记录 | source_type、external_id、payload_uri/hash、received_at、idempotency_key |
| ProcessingRun | 一次内容加工流水线执行 | pipeline_version、input_refs、status、attempt、metrics、error |
| ContentObject | 可结构化管理的业务内容 | type、project_id、title、metadata、lifecycle_state |
| Asset | 仅在所属项目内被引用的内容资产 | project_id（必填）、asset_type、classification、current_version_id |
| AssetVersion | 不可变的内容版本 | version、blob_uri、checksum、metadata、created_by、source_ref、processing_run_id |
| AssetRelation | 资产与业务对象之间的显式关系 | from_ref/version、relation_type、to_ref/version、required/optional、validity |
| ReviewRecord | 针对特定对象版本的审核决定 | subject_ref/version、review_type、decision、reviewer、reason、policy_version |
| QualityResult | 自动规则执行结果 | subject_ref/version、rule_set_version、score、issues、decision |
| WorkflowRun/NodeRun | 可恢复的多步骤业务编排 | workflow_version、state、checkpoint、dependency_refs |
| GenerationTask/Attempt | 模型任务及每次外部调用 | capability、provider/model、request_hash、attempt_no、cost、status |
| Artifact | 可交付的任务输出 | media_type、uri、checksum、metadata、source_task、validation |
| TimelineVersion | 不可变剪辑结构快照 | fps、tracks、clips、source_asset_versions、duration |
| ExportJob | 对固定时间线快照的渲染任务 | timeline_version_id、profile、status、progress、artifact_id |

**边界原则**
- 原始输入、结构化内容、媒体资产、加工任务、审核记录、导出产物分别建模，不用一个“文件表”承载所有语义。
- PostgreSQL 保存业务事实、状态、引用、元数据和审计；对象存储保存原始文件与大媒体；Redis 只用于缓存/短期协调；Celery 负责执行分发，不作为业务状态事实来源。
- 外部 Provider 通过 Adapter 接入，不得直接访问业务数据库。
- 所有内容资产必须归属单一 project_id；本期禁止跨项目资产共享、引用和搜索。所有引用均校验 project_id 一致及服务端项目权限。
- 所有版本引用均指向不可变版本；current_version 只是便捷指针，不是历史事实。
- 事件通知可重复、可乱序；消费者必须幂等，查询快照为最终事实。

### 2.2 内容统一信封

所有进入系统的内容在接入层形成标准信封：
- identity：tenant_id、project_id（必填；本期所有内容对象和资产均属于项目）、object_type、external_id；
- provenance：source_type（manual_input/manual_upload/mork_generated/internal_reference）、source_uri（可空）、operator_id、captured_at、received_at；
- payload：media_type、encoding、schema_version、raw_uri 或 inline_payload、checksum、size_bytes；
- policy：classification、retention_policy；
- processing：pipeline_id、pipeline_version、idempotency_key、correlation_id；
- status：received、quarantined、accepted、processing、completed、rejected、failed。

禁止将第三方未经授权的数据、个人敏感信息、密钥或完整凭据写入普通日志。

## 3. 内容来源维度：统一接入规范

### 3.1 来源渠道矩阵

| 来源 | 接入协议/格式 | 身份与权限 | 更新/触发 | 约束与边界 |
|---|---|---|---|---|
| 用户主动输入 | Web 表单/编辑器 HTTPS JSON；Markdown、纯文本、结构化表单 | OIDC/Bearer；组织/项目角色；字段级校验 | 用户提交即触发；自动保存可 2–5 秒防抖 | 保存草稿与发布分离；并发编辑使用 If-Match/版本号；限制长度、HTML、脚本 |
| 外部文件导入 | HTTPS multipart 或预签名对象存储直传；PDF/DOCX/TXT/MD/CSV/JSON/SRT/VTT/PNG/JPEG/WebP/MP3/WAV/MP4/MOV | 项目写权限；上传 URL 短时、单对象、单用途；恶意文件隔离 | 上传完成事件；大文件异步解析 | MIME + magic bytes 双检；大小/时长/页数上限；病毒扫描；压缩炸弹/路径穿越防护 |
| 第三方系统 API | 本期不纳入产品范围 | 不启用 | 无 | 后续独立立项后再设计连接器，不预留可执行入口 |
| 第三方 Webhook/事件推送 | 本期不纳入产品范围 | 不配置、不授权 | 无 | 后续独立立项后再定义事件契约 |
| 爬虫/网页采集 | 本期不纳入产品范围 | 无 | 无 | 不开发爬虫、采集调度、网页解析或来源连接功能 |
| 系统自动生成 | 内部任务 API + JSON schema；生成文本/图片/音频/视频 Artifact | 发起用户项目权限 + Mork 配置 + 模型参数策略 + 项目预算 | 工作流节点触发；人工重跑显式触发 | 默认使用 Mork Provider Adapter；默认调用 Mork Provider；真实模型 API 后续通过配置接入；AI 输出默认未审核；记录配置版本和输入快照 |
| 系统内资产引用 | 内部 AssetRef + version_id，不复制文件 | 源资产可读权限与目标模块写权限；引用时重新鉴权 | 绑定/解绑/版本变更事件 | 引用默认固定版本；动态引用必须显式标记并允许 stale 传播 |
| 批量迁移/管理导入 | 本期不提供通用外部批量迁移入口；仅支持经批准的项目内初始化 | 平台运维受限权限 | 按部署/迁移任务触发 | 通过版本化迁移脚本执行，不提供任意文件包导入 API |

### 3.2 接入处理通用步骤

1. 鉴权：验证用户/连接器身份、tenant/project scope、角色与授权用途。
2. 预检：验证协议、Content-Type、扩展名、文件签名、大小、编码、配额和来源许可。
3. 防重：基于 tenant + source + external_id/event_id + payload hash 建立幂等键。
4. 隔离：上传对象进入 quarantine，完成病毒/恶意内容扫描前不可被下游消费。
5. 登记：保存原始载荷 URI、checksum、来源凭证、时间、许可与保留策略。
6. 排队：事务写 IngestionRecord + OutboxEvent；Dispatcher 异步派发。
7. 回执：返回 ingestion_id、状态、request_id；明确区分“接收成功”和“加工成功”。
8. 完成：生成标准化对象或拒绝原因；原始记录保留供审计和重放。

### 3.3 来源接入目标指标

- 文本/JSON 接入 API：p95 ≤ 500 ms（不含异步加工）。
- 大文件上传会话创建 p95 ≤ 500 ms；文件直传对象存储。
- 重复上传/提交按幂等键去重，业务副作用为 0。
- 本期不设置第三方连接、Webhook 或爬虫性能指标。

## 4. 内容处理维度：全链路加工流水线

### 4.1 标准阶段与契约

| 阶段 | 输入 | 处理规则 | 输出 | 失败策略 |
|---|---|---|---|---|
| 接入校验 | Source Envelope/文件 | schema、权限、许可、大小、checksum、MIME、病毒扫描 | accepted/quarantined/rejected | 权限/许可/格式错误不可重试；扫描服务故障可延迟重试 |
| 清洗规范化 | 原始文本/媒体/JSON | Unicode NFC；统一换行/时区；去除无效控制字符；保留原文；HTML 转安全文本；媒体转标准元数据 | NormalizedPayload | 不可解析进入隔离队列；保留原始载荷 |
| 格式转换 | PDF/DOCX/字幕/音视频/图片 | 文档抽取；字幕时间轴规范化；ffprobe 媒体探测；图片方向/色彩空间读取；必要时代理文件转码 | CanonicalDocument/MediaMetadata/Proxy | 工具超时有限重试；损坏文件标记 invalid，不无限重试 |
| 结构化提取 | 规范化内容 | 按 schema 提取故事设定、人物、场景、道具、场次、对白、镜头、时间码；AI 抽取必须附 evidence/span/confidence | Typed Content + provenance | 低置信度进入人工校对；结构校验失败不得发布 |
| 去重与实体解析 | 提取对象 | external_id、checksum、规范化名称、别名和上下文匹配；自动合并仅限高置信度且可逆场景 | EntityLink/duplicate candidates | 不确定时人工合并；不物理删除重复来源 |
| 标签与分类 | 结构化对象 | 项目内受控词表；标签含 namespace、code、label、parent、definition、owner、version | TaxonomyAssignments | 标签失效时保留历史代码并映射替代项 |
| 智能增强 | 故事/剧本/镜头/素材 | 摘要、关键词、角色关系、连续性提示、镜头提示词建议、字幕/转写；生成内容独立版本 | Enrichment Artifact | 模型不可用退化为无增强；低置信度标记 review_required |
| 自动质量检查 | 结构化对象/媒体/生成结果 | schema、完整度、连续性、音视频技术参数、黑帧/静音/时长、安全策略 | QualityResult + issues | 规则执行失败与内容不合格分开；规则服务故障不得误判 PASS |
| 内容审核 | 具体对象版本 + QA | 业务审核与内容安全审核；decision 必须附 reviewer、reason、policy version | ReviewRecord | 拒绝转返工；超时提醒/升级，不自动批准 |
| 发布与索引 | 已通过质量门禁/审核的版本 | 原子切换可见版本；写搜索索引/缓存失效事件 | Published Version | 索引失败可异步补偿；主数据库状态为准 |

### 4.2 标签体系

采用分层受控词表，而不是任意自由标签作为核心分类：
- 内容类型：story、script、scene、dialogue、character、location、prop、storyboard、shot、image、video、audio、subtitle、timeline、export。
- 题材/情绪/风格：都市、悬疑、喜剧、爱情、动作、治愈等；在项目内扩展并版本化。
- 生产状态：draft、in_review、approved、rejected、archived、stale。
- 技术标签：aspect_ratio、resolution、fps、codec、duration、language、sample_rate。
- 内容风险与保留：sensitive、restricted、retention_class（不建设版权许可管理模块）。
- AI 标签：provider、model、prompt_template_version、generation_capability、confidence_band。

每个标签需有唯一 code、定义、适用对象、父级、启停时间和版本。自由标签仅用于个人检索，不能参与自动门禁。

### 4.3 内容审核与质量门禁

质量结果枚举：PASS、REVIEW_REQUIRED、FAIL。MVP 不提供 豁免 豁免通道；质量检查失败必须修复后重新检查。

- 结构质量：必填字段、引用完整性、唯一编号、schema 版本。
- 剧本质量：场次完整、人物出场一致、对白归属、场景切换、时长估算。
- 镜头质量：Shot Contract 字段齐全、资产版本存在、画幅/时长/动作/镜头运动明确。
- 连续性：角色外观/服装、道具状态、场景时间、空间方向和前后镜头衔接。
- 媒体质量：容器/编码、分辨率、帧率、声道、时长、可解码性、音画同步、黑帧/静音检测。
- 安全质量：内容安全策略、敏感信息与平台内容规则。外部来源版权审查不在本期功能范围。

审核必须绑定 object_version_id。采用单项目统一审核流程，不按内容类型配置不同审核角色，不支持多级会签。对象新建版本后，旧版本审核仍然有效，新版本重新执行 QA/审核；审核结果不可跨版本继承。

### 4.4 工作流与异常恢复

遵循现有 PostgreSQL + Celery + Outbox 规范：
- 事务内写业务对象、WorkflowRun/Task 与 Outbox；Dispatcher 可重复投递。
- Worker 通过租约领取；每次真实调用创建独立 Attempt；Checkpoint 保存安全恢复点。
- 可重试错误：网络瞬断、Provider 429/5xx、临时存储故障；指数退避 + jitter + 最大次数。
- 不可重试错误：参数/权限/许可/策略错误、模型能力不支持、schema 永久不合法。
- 人工处理错误：内容拒绝、Mork/Provider 结果不确定、预算阻断、超过最大重试。
- 取消采用 cancel_requested 协作取消；外部供应商不支持取消时记录真实结果，不伪造 cancelled。
- Worker 崩溃以租约/心跳识别孤儿任务，从 Checkpoint 恢复；重复回调按 provider_task_id/event_id 幂等。
- 产物先写临时对象、校验 checksum/媒体信息，再原子发布并登记 AssetVersion。

### 4.5 性能目标（MVP 建议）

| 指标 | 目标 |
|---|---|
| 常规元数据清洗/结构校验 | p95 ≤ 2 秒/对象（不含外部模型调用） |
| 文档抽取 | 20 页 PDF/DOCX p95 ≤ 30 秒；超大文件异步处理 |
| 图片技术元数据探测 | p95 ≤ 3 秒/张 |
| 音视频探测 | p95 ≤ 10 秒/文件（不含全片转码） |
| 任务入队至可查询 | p95 ≤ 1 秒 |
| 任务状态快照 API | p95 ≤ 300 ms |
| Webhook 事件重复处理 | 业务副作用为 0 次重复 |
| 质量规则 | 10 秒短媒体 p95 ≤ 15 秒；长媒体异步并报告阶段进度 |
| 失败可观测性 | 100% 失败有 error_code、request_id、stage、retryable 和 trace/correlation_id |

上述数值须在目标部署规格、样本规模和并发基准测试后固化；Provider 响应时间、视频生成耗时不纳入平台自身同步 API SLO。

## 5. 内容输出维度：结果类型与交付契约

| 输出类型 | 规范/结构 | 格式与展示 | 用途/交付验收 |
|---|---|---|---|
| 故事圣经 | 世界观、人物、关系、规则、主题、版本与来源 | Web 结构化编辑；JSON 导出；PDF 评审稿 | 编剧/导演共识；版本可追溯、字段完整 |
| 剧本 | Episode → ScriptVersion → Scene → Dialogue；角色、场景、动作、对白分离 | Web 编辑；JSON canonical；PDF/DOCX；可选 Fountain/FDX 适配 | 拍摄/生成输入；场次编号唯一、对白归属正确、版本冻结 |
| 内容资产 | Asset + AssetVersion + 元数据 + 来源/许可 | 图片/音视频预览；原文件与代理文件；JSON 元数据 | 项目内跨模块复用；checksum、预览、权限、版本可查询 |
| 分镜/Shot Contract | shot_no、duration、framing、camera、action、dialogue、asset_version_refs、continuity_constraints、prompt_refs | Web 分镜板；JSON schema；PDF/CSV 批量审阅 | AI 生成和制作执行；引用存在、约束可验证、字段完整 |
| AI 生成结果 | Task、Attempt、参数快照、模型信息、成本、Artifact、QA | 图片/视频/音频文件 + JSON manifest | 选择候选素材；保留失败尝试与成本；产物可追溯 |
| QA/审核结果 | subject version、rule set、issues、decision、reviewer、reason | Web 审核队列；JSON API；审计日志 | 阻止不合格产物进入下游；每项问题有处置结果 |
| 时间线 | frame_rate/timebase、tracks、clips、source version、in/out、effects、audio/subtitle | Web 编辑器；JSON timeline interchange | 可重建剪辑结构；引用版本固定、时码无歧义 |
| 成片 | ExportJob、TimelineVersion、ExportProfile、Artifact、probe report | MP4 H.264/AAC 为 MVP；字幕烧录或独立 SRT/VTT | 可播放、可下载、可归档；ffprobe 校验、checksum、快照可追溯 |
| 运营报表 | 使用量、成本、成功率、时延、队列、审核周期 | Dashboard/CSV/JSON | 企业预算、运营与容量规划；租户隔离、口径可解释 |

### 5.1 通用输出 envelope

API 输出遵循现有规范：成功为 data/meta；错误为 error(code/message/details/request_id)。列表分页有 page/page_size 上限、稳定排序；重要命令支持 Idempotency-Key。时间统一 ISO 8601 UTC。

文件输出同时提供：
- artifact_id、asset_id、version_id；
- media_type、size_bytes、checksum_sha256；
- width/height/fps/duration/audio 等适用媒体元数据；
- source_task_id、timeline_version_id、export_profile_version；
- retention/classification；
- authorized download URL（短时签名或受控代理，不暴露永久对象存储凭据）。

### 5.2 交付门槛

- 业务对象：字段和引用完整、状态允许发布、无未解决的阻断问题。
- 媒体资产：checksum 匹配、扫描通过、探测成功、文件可解码。
- AI 产物：保留模型/参数/Prompt 版本；未审核产物带明显状态标识。
- 成片：导出必须固定 TimelineVersion 与 ExportProfile；ffprobe 检查容器、视频/音频流、画幅、帧率、时长；目标文件完整后才标记 succeeded。
- 下载/分享：每次请求重新鉴权；外链有过期时间、访问审计与撤销能力。

### 5.3 时间线时码标准（统一规范）

采用 **整数 PTS + 有理数 time_base** 作为唯一权威时间表示。禁止将浮点秒作为数据库持久化字段、API 写入值或版本比较依据。

- 时间戳：`{ "pts": 70560000, "time_base": { "num": 1, "den": 70560000 } }`，时间值为 pts × num / den 秒。
- 时长：`{ "value": 35280000, "time_base": { "num": 1, "den": 70560000 } }`。
- API 使用 `start`、`duration`、`source_in`、`source_out` 等对象，不使用 `start_seconds` 或 `duration_seconds` 浮点字段。
- 视频轨道以整数帧序号为编辑权威值，记录精确帧率分数，例如 `frame_rate: { "num": 30000, "den": 1001 }`；帧边界通过有理数运算映射为 PTS。
- 音频片段以整数采样点为权威值，并记录 `sample_rate`；混轨时转换到共同有理数时间域，不进行浮点累计。
- TimelineVersion 统一主时钟建议采用 1/70,560,000 秒（可精确表示常见 23.976/24/25/29.97/30/50/59.94/60 fps 以及 44.1/48 kHz 音频）；每个 Clip 同时保留源媒体原生 time_base、帧率/采样率及整数源区间。非标准帧率或采样率通过有理数 time_base 精确表示，不得有损强转。
- 区间采用左闭右开 `[in, out)`；duration = out - in；禁止负时长、溢出和非整数 PTS。
- JSON Schema 要求 num/den 为正整数、PTS 为安全整数；服务端使用整数/有理数运算，禁止序列化为 IEEE-754 浮点。
- 数据库、API、前端编辑器、预览渲染和 FFmpeg 适配器共用该契约；前端可格式化显示秒/时间码，提交时必须回传整数 PTS/time_base。
- SRT/VTT 毫秒时间导入时转换为有理数 PTS；导出按目标格式精度舍入并记录转换策略。

验收：23.976、24、25、29.97、30、50、60 fps 往返转换无累计漂移；44.1/48 kHz 音频与视频混轨 60 分钟偏差不超过 1 个目标视频帧或 1 个音频采样点；同一时间线保存/读取/导出时间戳一致；API Schema 拒绝浮点秒写入。

## 6. 资产关联交互维度

### 6.1 关系类型

| 关系 | 例子 | 语义 |
|---|---|---|
| derived_from | 剧本版本由故事圣经版本加工 | 血缘关系；上游变化可导致 stale |
| references | Shot 引用角色/场景/道具版本 | 固定版本依赖 |
| generated_from | Artifact 由 Shot Contract + Prompt 生成 | 生成可追溯 |
| reviewed_as | ReviewRecord 审核某 AssetVersion | 审核只针对版本 |
| included_in | Clip 引用 AssetVersion | 时间线固定素材版本 |
| rendered_from | ExportArtifact 由 TimelineVersion 渲染 | 成片固定快照 |
| supersedes | 新版本替代旧版本 | 不删除旧版本 |
| attached_to | 文件作为评论/项目附件 | 生命周期受宿主对象策略约束 |

### 6.2 主要数据依赖

- Organization → Project → ProjectMember：组织成员身份不自动等于项目成员；项目权限由组织角色与项目角色组合求交集。
- StoryBibleVersion → ScriptVersion → Scene/Dialogue：剧本记录使用的故事设定版本；故事圣经更新时提示影响，不直接改写已冻结剧本。
- Character/Location/Prop AssetVersion → ShotContract：镜头引用具体版本；资产变更时标记引用该版本的 Shot 为 stale_candidate。
- ShotContract → GenerationTask → Artifact：任务保存输入快照；合同变更不改变正在运行任务的输入。
- Artifact → QualityResult → ReviewRecord：质量与审核绑定产物版本；拒绝生成 ReworkTask，重做产生新 Attempt/Artifact。
- Approved Artifact → TimelineVersion：时间线默认只允许使用通过必要审核的资产；若项目配置允许临时素材，必须显式标记 draft。
- TimelineVersion → ExportJob → ExportArtifact：导出固定快照，后续时间线编辑不改变已提交导出任务。

### 6.3 Stale 传播规则

1. 上游对象产生新版本，系统发布 VersionCreated 事件。
2. 依赖图查询引用旧版本的下游对象。
3. 根据 relation_type 和策略标记 stale / stale_candidate / unaffected。
4. 对正在运行的任务保持输入快照，不中途替换；任务完成后再判断是否 stale。
5. 已审核/已交付版本保持历史有效，不被静默撤销；如存在资产撤回或安全风险，触发显式 hold/revocation。
6. 用户可查看影响列表并选择重新生成、重新审核或保留旧版。
7. 自动重跑仅适用于无副作用、预算允许、策略明确的节点；禁止对已产生外部费用的任务自动无限重跑。

### 6.4 操作互斥与并发控制

- 同一业务对象编辑：乐观锁 version/ETag；冲突返回 409 并提供差异，不以后写覆盖前写。
- 发布/审核/归档：状态迁移使用数据库条件更新或领域锁，确保单次有效迁移。
- 同一 TimelineVersion 的导出可并发，但相同幂等键和相同配置只能得到一个逻辑 ExportJob。
- 资产删除：有引用时禁止物理删除；只能归档/撤回，需展示项目内引用影响。
- 同一 Shot 的主版本发布采用单写者/乐观锁；多个 AI 生成任务可并行，但通过候选集选择主产物。
- 项目归档后默认禁止新写入和新任务；恢复需具备权限并审计。

### 6.5 权限继承

权限计算采用：
1. 用户身份有效；
2. 组织状态与成员关系有效；
3. 项目成员关系有效；
4. 项目角色授予具体 permission；
5. 资源 classification、状态策略进一步收紧。

最终权限是各层限制的交集，不存在通过客户端传入 project_id 或猜测 UUID 获权的情况。跨项目引用一律禁止；不建设企业级共享资产。所有 Asset 必须具有 project_id，所有 AssetRelation 的两端 project_id 必须相同。下载 URL 的短时签名不替代业务授权。

## 7. 各模块功能设计卡

### 7.1 企业身份、组织、RBAC

- 来源：管理员创建、邀请邮件/SSO（后续）、SCIM（后续）；JSON 用户批量导入受限。
- 处理：身份验证、邮箱规范化、组织成员绑定、角色权限展开、会话撤销、审计。
- 输出：用户/组织/部门/角色/权限清单、邀请状态、审计记录。
- 联动：组织是项目归属边界；成员离职/禁用后撤销会话并阻止新任务；历史产物保留原操作者。
- 生命周期：invited → active → suspended → deactivated；角色变更立即影响后续请求，不篡改历史审计。
- 异常：重复邮箱/邀请冲突 409；SSO/邮件不可用可重试；权限不足 403。
- 验收：越权 API 100% 拒绝；撤销成员后 60 秒内新请求不可访问；所有高风险权限变更写审计。

### 7.2 项目空间

- 来源：用户表单、受控项目导入、模板创建。
- 处理：编码唯一性、组织归属、成员授权、项目配置初始化、默认工作流与词表绑定。
- 输出：Project、成员列表、项目概览、生产状态。
- 联动：项目是剧本/资产/任务/时间线/导出的隔离根；项目归档阻止新写入和任务创建。
- 生命周期：draft → active → on_hold → archived；恢复需显式权限。
- 异常：编码冲突 409；组织不存在 404；项目配额超限 429/业务错误。
- 验收：跨项目读写隔离 100%；项目创建后默认资源和成员关系事务一致；归档后新任务创建拒绝。

### 7.3 故事与故事圣经

- 来源：编辑器输入、Markdown/DOCX/PDF 导入、授权资料导入、AI 辅助提炼。
- 处理：章节清洗、人物/地点/设定抽取、实体消歧、关系图构建、设定冲突检测、标签与版本化。
- 输出：结构化 StoryBibleVersion、人物关系、设定条目、摘要、PDF/JSON。
- 联动：剧本版本记录采用的 StoryBibleVersion；变更触发下游 stale 检查。
- 生命周期：draft → in_review → approved → archived；版本不可覆盖。
- 异常：抽取低置信度需人工确认；设定冲突输出 issue，不自动合并。
- 验收：导入文本原文可追溯；结构化字段证据定位率 ≥ 95%（评测集）；版本差异可查看；已批准版本不可原位编辑。

### 7.4 剧集与剧本

- 来源：用户编辑、DOCX/FDX/Fountain/Markdown 导入、模板、故事圣经辅助生成。
- 处理：剧集编号约束、场次/对白解析、角色映射、格式规范、字数/时长估算、连续性校验。
- 输出：ScriptVersion、Scene、Dialogue；PDF/DOCX/JSON 等。
- 联动：角色引用绑定角色资产；场景引用场景资产；分镜从特定 ScriptVersion/Scene 派生。
- 生命周期：draft → in_review → approved → locked/archived；新版本复制旧版本后编辑。
- 异常：解析失败保留原文件并给出行/页错误；编号冲突 409；并发编辑 409。
- 验收：剧集编号唯一；对白角色引用有效率 100%；导入可定位原文；批准版本内容不可变。

### 7.5 角色、场景、道具与媒体资产

- 资产作用域：Asset 必须绑定 project_id；只允许同项目内模块引用，不提供跨项目共享/复制/搜索入口。
- 来源：用户表单、项目内文件上传、Mork Provider 生成、项目内引用。
- 处理：病毒扫描、媒体探测、元数据提取、人物/物件标签、版本登记、相似资产候选、元数据完整性校验。
- 输出：Asset/AssetVersion、缩略图/代理文件、元数据、来源记录。
- 联动：剧本/Shot/时间线固定引用版本；引用影响阻止物理删除。
- 生命周期：draft → processing → ready → in_review → approved → archived/revoked；媒体文件上传与资产发布分离。
- 异常：checksum 不匹配隔离；上传中断支持分片续传；扫描失败不发布；资产撤回触发下游 hold。
- 验收：上传文件 checksum 100% 校验；无权限下载 100% 拒绝；版本可追溯；任何引用均可反查来源。

### 7.6 分镜、镜头与 Shot Contract

- 来源：人工创建、剧本场次拆分、分镜文件导入、AI 辅助拆镜。
- 处理：镜头编号、镜头时长、景别/机位/运动、动作、对白、资产版本引用、连续性约束和提示词模板验证。
- 输出：StoryboardVersion、Shot、ShotContractVersion、分镜表/PDF/JSON。
- 联动：依赖 ScriptVersion、Scene、AssetVersion；合同版本是生成任务不可变输入。
- 生命周期：draft → ready_for_generation → generating → in_review → approved → archived；合同变化创建新版本。
- 异常：引用资产版本不存在则拒绝提交；必填字段缺失阻止生成；AI 拆镜结果先进入草稿。
- 验收：每个 Shot 编号唯一；生成输入快照完整率 100%；镜头总时长与分集目标差异可计算；引用版本有效率 100%。

### 7.7 AI Provider、模型、任务与工作流

- 默认行为：未配置真实 API 时由 Mork Provider Adapter 作为默认 Provider Adapter；真实模型 API 通过配置接入 Mork 或切换到其他已配置 Adapter。未完成有效配置时明确报 PROVIDER_NOT_CONFIGURED，不伪造生成结果。
- 来源：内部工作流/用户命令；默认 Provider 为 Mork Provider Adapter；后续真实模型通过配置启用，配置项包括 provider_key、base_url、secret_ref、model_id、capabilities、timeout、rate_limit、enabled。
- 处理：能力路由、策略/预算检查、Prompt 模板渲染、参数 schema 校验、幂等、限流、调用、Attempt、产物校验。
- 输出：Task/Attempt 状态、成本、Artifact、失败诊断、事件通知。
- 联动：任务绑定项目、ShotContractVersion、输入资产版本、模型配置版本；输出资产进入 QA/审核。
- 生命周期：pending → queued → running → succeeded/failed；支持 retry_wait、cancel_requested、cancelled；每次重试新增 Attempt。
- 异常：429/5xx 有界重试；权限/策略/参数错误不可重试；结果未知先查供应商状态；供应商不可取消则记录最终状态。
- 验收：重复提交副作用为 0；每个 Attempt 有成本/耗时/错误；Worker 崩溃恢复不丢任务；取消状态与供应商真实状态一致；任务查询快照 p95 ≤ 300 ms。

### 7.8 QA、审核与返工

- 审核模型：项目级统一审核权限；不配置多级会签，不按故事/剧本/资产/分镜等内容类型配置不同审核角色。
- 来源：系统规则与项目内人工审核。
- 处理：按对象类型选择自动 QA 规则集；人工审核统一使用项目级 review permission，不按内容类型区分角色、不支持多级会签；问题分级；一次审核决定；拒绝生成返工任务。
- 输出：QualityResult、ReviewRecord、ReworkTask、审核报告。
- 联动：审核绑定版本；审核拒绝阻断时间线/导出；返工产生新版本/Attempt，不覆盖被拒绝版本。
- 生命周期：pending → checking → pass/review_required/fail；人工 review：pending → approved/rejected。
- 异常：规则服务不可用不允许默认 PASS；审核超时提醒项目成员；不提供审核豁免状态。
- 验收：审核记录不可篡改；所有拒绝项有 reason；未通过门禁的素材进入受控例外流程，不得静默进入正式成片。

### 7.9 时间线与剪辑

- 时间表示严格遵循第 5.3 节；视频帧序号、音频采样点分别以整数表示，API 不接受浮点秒作为权威字段。
- 来源：用户编排、已审核素材、字幕/音轨导入、模板。
- 处理：统一整数 PTS + 有理数 time_base；视频帧序号和音频采样点分别保留整数权威值；轨道/片段校验；源区间边界；转场/音量/字幕配置；保存版本快照。
- 输出：TimelineVersion JSON、预览代理、剪辑变更记录。
- 联动：Clip 固定引用 AssetVersion；源资产撤回时阻止新导出并提示替换；时间线版本供 ExportJob 固定引用。
- 生命周期：draft → review_ready → approved → superseded/archived；保存产生新版本。
- 异常：并发编辑 409；素材缺失阻止提交；时码越界校验失败；预览渲染失败可单独重试。
- 验收：时间线 JSON 可往返解析；所有片段引用存在；帧级边界无负时长/越界；旧版可恢复；编辑不改变已提交导出快照。

### 7.10 导出、交付与归档

- 来源：用户选择 TimelineVersion + ExportProfile；系统自动触发 FFmpeg。
- 处理：冻结输入、校验引用/权限/审核、预检磁盘和配额、生成 FFmpeg 命令、渲染、ffprobe、checksum、原子发布。
- 输出：ExportJob、MP4、字幕文件、manifest、probe report、下载链接。
- 联动：固定 TimelineVersion/素材版本/配置版本；交付记录关联项目、剧集和审批。
- 生命周期：created → queued → rendering → validating → succeeded/failed/cancelled；产物可 archived/revoked。
- 异常：FFmpeg 非零退出保留日志和临时文件策略；空间不足/素材缺失/编码错误可诊断；失败重试使用新 Attempt。
- 验收：MP4 可完整解码；视频/音频参数与配置一致；导出来源快照 100% 可追溯；下载权限校验通过；文件完成前不显示成功。

### 7.11 用量、预算、审计与通知

- 来源：Provider Usage 回执、任务成本估算、系统事件、用户偏好。
- 处理：按组织/项目/用户/Provider 聚合 token、时长、金额；预算阈值；异常成本检测；审计不可变。
- 输出：用量报表、预算告警、操作审计、站内通知/Webhook。
- 联动：生成任务创建前检查预算；超预算阻断或要求授权；通知失败不回滚业务事实。
- 生命周期：usage event append-only；预算周期 open → warning → exceeded → closed。
- 异常：供应商账单延迟需标记 estimated/final；重复账单按外部 ID 幂等；通知失败进入重试/死信。
- 验收：任务与成本关联率 100%；预算阻断可解释；审计事件包含 actor/action/resource/time/request_id；报表注明估算或结算口径。

## 8. 全局状态与删除策略

- 业务内容状态：draft、in_review、approved、rejected、archived；stale 是依赖有效性标志，不替代业务状态。
- 媒体状态：uploaded、quarantined、processing、ready、invalid、revoked、archived。
- 任务状态遵循 WORKFLOW_AND_TASKS.md；Attempt 独立记录每次调用。
- 审核决定：approved、rejected；不提供 waived 豁免。项目内统一审核权限，不区分内容类型审核角色、不支持多级会签。
- 导出状态：created、queued、rendering、validating、succeeded、failed、cancel_requested、cancelled。
- 删除默认采用软删除/归档；有审计、合同或引用约束时禁止物理删除。隐私/法定删除请求通过专门的数据保留策略执行，并保留最小化、不可逆的合规审计记录。

## 9. 安全与平台控制

- 租户隔离：所有查询和任务都从认证上下文派生 tenant/project scope，不信任客户端传入的范围。
- 上传安全：magic bytes、病毒扫描、大小/时长限制、压缩炸弹、解压路径穿越、媒体解码沙箱。
- 模型凭据：KMS/Secret Manager 引用；数据库只存 secret_ref；日志脱敏；轮换和吊销可追踪。
- 内容安全：AI 生成内容需执行平台内容策略校验；不能将 AI 结果视为事实或默认审核通过。
- 本期不建设版权管理或外部采集功能；仅保留用户上传/录入及系统生成的来源元数据。
- 隐私：最小化采集、目的限制、保留期限、删除/导出流程；禁止未授权采集登录态/私人信息。
- 不提供网页采集和第三方内容同步能力。

## 10. API 与事件契约建议

统一前缀 /api/v1，JSON snake_case，UTC ISO 8601，Envelope 与错误码遵循 API_CONVENTIONS.md。MVP 默认生成 Provider 为 Mork Provider；真实 API 仅通过管理员配置 Provider Adapter 启用，不在业务代码中写死密钥或供应商 URL。

建议新增/补齐资源域：
- /sources/connections、/sources/ingestions、/sources/ingestions/{id}/retry
- /assets/{id}/versions、/assets/{id}/relations、/assets/{id}/download
- /processing/runs、/processing/runs/{id}
- /projects/{id}/taxonomy、/taxonomy/terms
- /quality-checks、/quality-checks/{id}
- /reviews、/reviews/{id}/decision、/rework-tasks
- /generation/tasks、/generation/tasks/{id}/attempts、/generation/tasks/{id}/events
- /timelines、/timelines/{id}/versions
- /exports、/exports/{id}/cancel、/exports/{id}/artifact
- /usage、/budgets、/audit-logs、/notifications

建议领域事件：IngestionAccepted、AssetVersionCreated、ContentPublished、QualityCompleted、ReviewDecided、GenerationTaskUpdated、ArtifactPublished、TimelineVersionCreated、ExportCompleted、AssetRevoked、ProjectArchived。

事件 envelope 至少包含 event_id、event_type、schema_version、occurred_at、tenant_id、project_id、aggregate_id、aggregate_version、correlation_id、payload。事件采用 Outbox 发布；消费者保存 inbox/dedup key。事件只通知状态变化，不代替查询快照。

## 11. 量化验收与测试矩阵

| 测试领域 | 必测场景 | 验收 |
|---|---|---|
| 来源接入 | 文件类型伪装、重复 webhook、签名错误、过期凭据、未授权采集 | 非法数据拒绝/隔离；重复副作用 0；每次接入可追溯 |
| 结构化处理 | 编码异常、损坏文件、字段缺失、低置信度抽取、实体重名 | 不丢原始文件；错误可定位；低置信度进入人工队列 |
| 版本与血缘 | 上游新版本、资产撤回、依赖循环、旧版引用 | stale 正确传播；无静默覆盖；历史快照可重建 |
| 权限安全 | 跨组织/项目 IDOR、下载 URL 复用、角色撤销 | 越权 100% 拒绝；短时 URL 过期失效 |
| 工作流可靠性 | 重复消息、Worker 崩溃、超时、取消、供应商回调乱序 | 无重复业务产物；可恢复；状态最终一致 |
| QA/审核 | 规则服务不可用、审核拒绝、重复审核决策/无权限审核 | 故障不误判 PASS；拒绝可返工；豁免有审计 |
| 媒体与导出 | 损坏源文件、无音轨、时码越界、磁盘不足、FFmpeg 中断 | 文件未校验不得成功；失败可诊断；快照可追溯 |
| E2E | 创建项目至 MP4 下载 | 项目隔离、剧本/资产/镜头/生成/审核/时间线/导出闭环成功 |
| 迁移与恢复 | 空库升级、备份恢复、对象存储引用恢复 | 迁移可重复验证；元数据与文件 checksum 一致 |

E2E 主场景：
1. 管理员创建组织成员并授予项目角色；
2. 创建项目、故事圣经版本、剧集与剧本版本；
3. 创建角色/场景/道具资产并上传参考文件；
4. 创建场次、分镜、Shot Contract，固定资产版本；
5. 使用默认 Mork Provider 创建生成任务，验证 Attempt、重试/取消和 Artifact；
6. 执行 QA 与人工审核，拒绝一次并完成返工；
7. 选择已审核素材创建 TimelineVersion；
8. 创建 ExportJob，执行 FFmpeg，ffprobe 校验并下载 MP4；
9. 修改上游资产，验证下游 stale 提示但不改变已提交导出；
10. 重启 API/Worker 后，任务/资产/审核/导出状态仍可恢复。

## 12. 分阶段落地路线

| 阶段 | 交付 | 依赖/完成条件 |
|---|---|---|
| D0 需求与领域基线 | 本文评审、模块责任边界、术语/状态/权限矩阵 | 产品、后端、前端、QA 对边界达成一致 |
| D1 内容接入与资产底座 | 项目内 IngestionRecord、Asset/Version、对象存储、上传扫描 | 幂等、项目隔离、checksum、隔离测试通过；不含第三方连接器/爬虫 |
| D2 创作结构化 | StoryBible/Script/Scene/Dialogue、导入解析、标签与版本 | 结构化导入、版本差异、引用校验通过 |
| D3 资产与分镜 | 资产关系、Storyboard/Shot/ShotContract、stale 图 | 固定版本引用与影响分析通过 |
| D4 生成工作流 | Mork Provider Adapter、Provider 配置、Task/Attempt/Outbox、事件、预算 | Mork Provider E2E、重试/取消/恢复通过；真实 API 可通过配置启用 |
| D5 QA 与审核 | QualityResult、ReviewRecord、ReworkTask、审核工作台 | 审核版本绑定、门禁不可绕过 |
| D6 时间线与导出 | TimelineVersion、ExportJob、FFmpeg、媒体校验 | 可重建时间线、真实 MP4 E2E |
| D7 运营治理 | Usage/Budget/Audit/Notification、报表 | 成本关联、审计与告警可验证 |
| D8 前端信息架构重设计 | 企业工作台、项目空间、创作/审核/剪辑工作区 | 以真实 API 能力和端到端流程为准，不用 demo 假装生产 |

每个阶段必须按 Issue 拆分可独立验收任务；常规开发进入 develop，跨文档体系设计可按仓库 docs/* 例外分支提交。进入 develop 仅表示集成，不代表正式交付；发布到 main 且完成约定验收才关闭任务。

## 13. 待评审决策清单

1. 第三方系统接入与网页采集：本期忽略，不建设对应功能。
2. 资产共享：仅项目内共享；跨项目资产共享和引用禁止。
3. 审核流程：不支持多级会签，不按内容类型划分审核角色；采用项目统一审核权限与单次审核决定。
4. 模型供应商：默认使用 Mork Provider；真实模型 API 后续通过 Provider 配置接入。
5. 时间线时码：采用整数 PTS + 有理数 time_base 的统一时间表示，禁止浮点秒作为持久化/API 权威值（详见 5.3）。
6. 性能目标需依据部署规格、并发和媒体样本压测后固化。

## 14. 设计完成定义

- 全部模块均覆盖来源、处理、输出、资产关联四个维度。
- 每个模块有生命周期、输入输出边界、异常、权限和验收指标。
- 本期来源限定为用户输入、项目文件上传、Mork 生成和项目内引用；生成产物具备模型/配置/参数追溯。
- 所有引用可追溯到具体版本；审核和导出均绑定不可变快照。
- 状态机、幂等、重试、取消、恢复和 stale 规则与现有工作流规范一致。
- 所有待建设项明确标记，不将方案描述为现有实现。
- 通过产品/架构评审后，拆分为可交付 Issue，再进入实现阶段。

## 2026-11-18 实施状态与决策对齐

本文为产品功能设计基线；具体模块边界、技术选型、代码现状和分阶段 DoD 以 [统一实施基线](IMPLEMENTATION_BASELINE.md) 为准，页面级交互以 [功能页面与交互流程规范](../02-requirements/FEATURE_INTERACTION_SPEC.md) 为准。

必须遵守：保留当前仓库目录；本期不建设第三方业务系统/Webhook/爬虫接入及内容版权管理；资产严格项目内隔离；审核为项目统一 review permission，不做多级会签/WAIVED；QA 仅 PASS、REVIEW_REQUIRED、FAIL；默认 Mork Provider，未配置报 PROVIDER_NOT_CONFIGURED 且不回退 Mock；时间线以整数 PTS + 有理数 time_base 为唯一权威时间。

本文中任何目标能力、数据模型或 API 描述均不代表已经开发。代码状态必须引用实施基线的已实现/部分实现/原型/待建设矩阵，并以对应 commit 的测试证据确认。

## 页面交互与代码映射

前端目标页面、当前演示/真实状态、操作状态机和异常交互统一维护于 [功能页面与交互流程规范](../02-requirements/FEATURE_INTERACTION_SPEC.md)。不得仅因页面路由存在就把业务能力标记为已交付。
