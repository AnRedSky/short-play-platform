# 功能页面与交互流程规范（与当前实现对齐）

> 基线：2026-11-18；统一实施基线见 `../01-architecture/IMPLEMENTATION_BASELINE.md`。  
> 目录政策：保留 `web/src/views`、`api`、`stores`、`router` 等现有目录和页面入口。  
> 本文中的“目标交互”不表示当前页面已实现；各页当前状态明确列出。

## 1. 全局信息架构

### 1.1 企业工作台
- 组织与成员：用户、组织、部门、角色、权限。
- 项目入口：项目列表、创建、最近访问、项目成员。
- 运营概览：任务状态、待审核、失败任务、用量摘要（未接入的指标显示待建设，不展示伪造数字）。

### 1.2 项目生产空间
项目上下文是所有生产数据和权限的边界。项目内导航包含：概览、故事圣经、剧集/剧本、资产、分镜、AI 任务、质量/审核、时间线、导出。切换项目必须清空或重新加载前一项目的缓存数据；所有 API 仍需服务端授权。

### 1.3 专项编辑工作区
剧本编辑、Shot Contract 编辑、资产详情/预览、时间线编辑使用专门工作区；离开未保存内容时提示保存/丢弃。MVP 不承诺多人实时协同。

## 2. 页面功能与当前状态矩阵

| 页面 | 现有路径 | 当前实现判定 | 目标主任务 | 核心数据/API 依赖 |
|---|---|---|---|---|
| 登录 | views/auth | 基础实现 | 登录、续期、退出、过期恢复 | auth/session |
| 企业管理 | views/organizations、users、roles | 基础实现 | 组织/部门/成员/角色维护 | organizations/users/roles |
| 项目 | views/projects | 基础实现 | 项目 CRUD、成员和项目上下文 | projects/project_members |
| 故事圣经 | views/stories | 演示/待接入 | 故事设定、人物关系、版本 | creation Story/StoryBible |
| 剧集剧本 | views/episodes | 演示/待接入 | 分集、剧本编辑、场次/对白、版本 | Episode/Script/ScriptVersion |
| 资产 | views/assets | 部分 UI/待完整联调 | 上传、预览、版本、引用、下载 | assets/AssetVersion |
| 分镜 | views/storyboards | 演示/待接入 | 分镜排序、Shot Contract、引用版本 | Storyboard/Shot/Contract |
| AI 任务 | views/tasks | 待完整联调 | 创建任务、进度、Attempt、重试/取消 | GenerationTask/WorkflowRun |
| QA/审核 | views/reviews | 原型/待后端 | 问题列表、审核意见、通过/拒绝、返工 | QualityRun/ReviewRecord |
| 时间线 | views/editor | 原型 | 多轨编辑、片段裁剪、版本保存 | Timeline/Track/Clip |
| 导出 | views/exports | 原型 | ExportProfile、队列进度、校验、下载 | ExportJob/Artifact |

## 3. 通用交互状态

每个列表/详情/编辑页必须实现并测试：
- loading：骨架/加载指示；禁止空白误导。
- empty：真实无数据，提供有权限的下一步操作。
- error：展示 request_id 和可重试提示；不泄露堆栈。
- forbidden：403 明确提示权限不足，不伪装成空列表。
- not_found：404 或资源已删除；不泄露其他项目资源是否存在。
- conflict：409 展示版本冲突和重新加载/比较动作。
- stale：显示上游变化及受影响对象；不得静默覆盖或自动重跑。
- processing：任务状态和最后更新时间；状态以服务端快照为准。
- success：仅在服务端确认成功后展示；生成结果必须有真实 Artifact/AssetVersion。
- unsaved：离开编辑器前确认保存/丢弃；保存产生新版本。

## 4. 关键页面交互

### 4.1 项目切换
1. 用户选择项目。
2. 前端加载项目详情和成员权限。
3. 路由携带 project_id；store 保存当前项目 ID 和授权摘要。
4. 页面 API 全部显式带项目作用域，服务端再次验证。
5. 切换项目时清理上一项目的查询缓存、编辑草稿和任务订阅。
6. 无权限项目不进入生产工作区。

### 4.2 故事/剧本编辑
1. 打开 Story/Script 当前版本。
2. 编辑器加载正文、版本号、引用和保存状态。
3. 保存请求携带 base_version/If-Match；冲突返回 409，不覆盖他人/旧版本。
4. 保存成功产生不可变新版本。
5. 上游变更时列出受影响的 Scene/Shot/Asset/Timeline；用户确认后触发后续处理。

### 4.3 资产上传
1. 选择文件和资产类型。
2. 客户端做大小/类型预检，但服务端重新校验扩展名、MIME、magic bytes、大小和项目权限。
3. 上传进入临时状态；扫描/探测完成后计算 checksum。
4. 成功后登记 AssetVersion 并可预览；失败隔离并返回错误码。
5. 引用操作只允许当前项目资产，并固定 asset_version_id。
6. 被引用资产禁止直接物理删除。

### 4.4 Shot Contract 与生成
1. 选择 Shot 和有效 Contract Version。
2. UI 根据 Capability Catalog 展示模型支持参数，不推测供应商能力。
3. 用户选择生成能力、参数和项目允许的 Provider。
4. API 校验项目权限、输入版本、Mork 配置、数据外发策略和幂等键。
5. 未配置 Mork 返回 PROVIDER_NOT_CONFIGURED；不得显示“已生成”。
6. 已创建任务返回 task_id；页面轮询/SSE 更新快照。
7. 成功后展示已校验 Artifact；失败展示错误分类、Attempt 和允许动作。

### 4.5 QA 与审核
1. 选择对象的明确版本运行 RuleSet。
2. PASS 可进入下一阶段；REVIEW_REQUIRED 进入审核队列；FAIL 阻断。
3. 审核人需具有项目级 review permission。
4. 审核记录保存 reviewer、decision、reason、subject_version_id 和时间。
5. 拒绝产生 ReworkTask；修改后新版本重新 QA/审核。
6. 不提供 WAIVED，不提供多级会签，不继承旧版本审核结论。

### 4.6 时间线
1. 创建 Timeline Draft，选择项目内 AssetVersion。
2. 创建 video/audio/subtitle/overlay Track。
3. Clip 选择 source_in/source_out 与 timeline_start，均使用整数 PTS + 有理数 time_base。
4. 预览和保存使用同一 TimelineVersion；保存生成不可变版本。
5. 上游 AssetVersion 变化标记 stale，用户确认后才替换引用。
6. 不支持的高级编辑能力显示明确限制，不伪装为专业 NLE。

### 4.7 导出
1. 选择 TimelineVersion 和白名单 ExportProfile。
2. API 冻结时间线/素材版本快照，创建 ExportJob。
3. Media Worker 执行 FFmpeg；前端显示 queued/running/failed/succeeded。
4. ffprobe + 完整解码 + checksum 全部成功后发布。
5. 失败不提供半成品下载；成功显示 MP4、字幕/报告等真实产物。
6. 每次导出独立版本，不覆盖历史导出。

## 5. 导航与可访问性
- 导航只展示用户可访问的功能，但服务端授权是最终边界。
- 表格有稳定排序、分页、空态、加载态和键盘操作。
- 表单字段提供标签、错误提示、必填说明；异步操作禁重复提交。
- 高风险删除、覆盖、取消、发布需要二次确认并展示影响。
- 页面保留现有路径，不因本规范引发全量目录重构。

## 6. 前端实施顺序
1. 项目上下文和 API 错误/权限状态统一。
2. stories、episodes、storyboards 接入 creation API。
3. assets 接入上传、版本和项目内引用 API。
4. tasks 接入 GenerationTask/Workflow 快照与事件。
5. reviews 等待后端 QA/Review 契约落地后接入。
6. editor/exports 等待 PTS Timeline/ExportJob 后端契约后接入。
7. 删除已被真实 API 替代的演示数据；仅保留明确开发演示开关。

## 7. 验收
- 每页有目标角色、任务、数据依赖、权限、空/错/加载/冲突/stale 状态。
- 不存在无后端支持的成功操作。
- 跨项目切换不泄露缓存数据；直接 API 越权被拒绝。
- 编辑保存产生新版本；并发冲突不丢失数据。
- 生成/审核/导出均以服务端快照为准。
- Playwright 至少覆盖项目切换、权限拒绝、创作保存、资产上传、任务失败/重试、审核返工和导出失败/成功。


## 8. 已落地的交互增量（2026-11-18）
- 项目列表新增“进入项目”入口，跳转到现有 `/projects/:projectId/stories` 路由。
- App.vue 不再固定 demo-project；根据路由参数同步 Pinia 项目上下文，非项目路由清空上下文。
- 工作区导航使用当前真实 project_id 构造路径；无项目上下文时返回项目列表，不拼接假 ID。
- 新增项目上下文 store 单元测试和“导航不指向硬编码 demo 项目”的 Playwright 检查。
- 尚未完成：切换项目清理各页面请求缓存/事件订阅、所有生产页面接真实 API、完整项目权限负向 E2E。


## 2026-11-18 项目上下文与浏览器验收校准

- 项目上下文变更递增 contextVersion，取消所有项目级 AbortController 请求，并执行注册的订阅/缓存 cleanup。
- 请求仅在 contextVersion 未变化且未 abort 时应用响应；组件卸载时释放请求上下文。
- 离开项目路由清空 active project；项目模块导航由当前 route projectId 构造。
- 生产模块未接真实 API 前统一显示明确的“尚未接入真实业务数据”状态，不允许使用本地演示记录或假成功操作。
- PR #53 的真实 Chromium Playwright 已覆盖项目 A/B 路由切换、离开项目清空上下文、工作区导航、无 demo-project 链接和生产页面无演示记录。
- 当前浏览器测试尚未覆盖真实登录态 403 页面和跨项目资源 API 请求拒绝；这些仍是 R1 验收缺口，不能将导航测试等同于权限测试。
- 项目成员权限变更后的缓存失效/重新拉取尚未完成。



## R1 生产路由访问授权补充（2026-11-18）

生产构建下进入任何 `/projects/:projectId/*` 页面前，前端必须请求项目详情 API 验证当前用户的成员权限。前端仅负责呈现状态，服务端 membership 和 permission 校验是授权事实来源。
- 401：清理会话并返回登录页，保留原始 redirect。
- 403：展示“无权访问此项目”，不渲染生产业务内容。
- 404：展示项目不存在。
- API 不可用：fail closed，展示权限无法验证状态。
- 项目切换时 abort 前一个项目的 access-check 请求；被取消的旧请求不得影响当前路由。
- Playwright 将在 production preview + 隔离 API 环境验证匿名、成员项目切换、非成员项目访问和跨项目资产详情/下载拒绝。


### 成员权限变更
成员被移出项目后，项目列表刷新应不再展示该项目；即使当前页面保留了撤销前的旧链接，进入时仍必须重新检查项目权限并显示 403，不允许依赖旧列表缓存授权。项目 owner 不允许通过成员移除接口移除。
