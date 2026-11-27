# 单集工作区页面差距与信息架构 V1

> 版本：V1  
> 日期：2026-11-27  
> 状态：待评审  
> 依赖：`docs/06-workflow/SHORT_DRAMA_PROJECT_FLOW_V1.md`、`docs/06-workflow/SHORT_DRAMA_EPISODE_FLOW_V1.md`

本文对照现有页面与 E0–E7 单集流程，给出“保留、改造、新增、下线”的差距清单，并定义单集工作区的信息架构与实施顺序。本版只做页面与数据差距分析，不修改代码。

---

## 0. 整体任务规划

### 0.1 目标

把 E0–E7 单集流程映射到现有页面，明确：

- 现有 9 段页面各自保留什么、改什么、缺什么；
- 单集工作区如何组织，用户如何从批次进入某一集；
- 哪些动作走居中弹窗，哪些留在工作区内；
- 数据层和 API 还缺哪些对象，哪些必须先补；
- 第一阶段能做的最小可用页面是什么。

### 0.2 范围

覆盖：

- `projects/workflow` 与 9 段阶段工作区；
- `creation`、`director`、`video`、`post`、`quality` 现有页面；
- 单集工作区路由、布局、功能清单；
- 批次看板与单集状态展示；
- 数据/API 缺口清单；
- 分阶段实施顺序。

不覆盖：

- 本轮不写页面代码；
- 不删除旧路由；
- 不做真实模型调用；
- 不做完整 NLE 剪辑器。

### 0.3 交付物

1. 现有页面能力清单；
2. 9 段页面差距表；
3. 保留/改造/新增/下线分类；
4. 单集工作区信息架构；
5. E0–E7 功能矩阵；
6. 数据与 API 缺口；
7. 三阶段实施计划。

### 0.4 验收标准

- 能指出每个现有页面在 E0–E7 中的位置；
- 能判断哪些交互已经存在、哪些只是只读展示；
- 单集工作区有明确入口、路由、布局和状态步进；
- 批次只做分组和治理，不强迫批量编辑；
- 数据缺口能直接转成接口和字段任务；
- 第一阶段范围可在不改旧页面的前提下独立交付。

---

## 1. 现有页面能力清单

| 页面/路由 | 当前能力 | 主要问题 |
|---|---|---|
| `/projects/workflow` 项目概览 | KPI、项目档案、预算、阻塞、成本、动作历史、关卡动作 | 没有批次、单集矩阵、模型基线和单集风险 |
| `/projects/workflow?stage=brief` | BriefWorkspace：基线、方向、方案、版本、门禁，全部弹窗 | 已基本满足 P1；可作为其他阶段的交互样板 |
| `/projects/workflow?stage=script` | 剧本版本表、版本变更、审核记录、审核清单，只读 | 没有 24 集分集剧本矩阵、逐集编辑与逐集锁定 |
| `/creation/script` | 新建剧本版本、提交审核；版本详情抽屉 | 新版本只填版本号与说明，不编辑正文；仍是项目级 |
| `/creation/review` | 项目级剧本审核、7 项清单、通过/退回弹窗 | 审核对象是整个项目剧本，不是单集 |
| `/projects/workflow?stage=plan` | 计划列表、全项目镜头表、资产计数、缺项提示 | 没有逐集镜头契约、资产锁定、模型基线、试跑 |
| `/director/shots` | 镜头卡片、镜头详情、单镜/批量提交生成 | 项目级镜头列表；无镜头契约编辑、无 take、无资产锁 |
| `/projects/workflow?stage=video` | 四列任务队列、任务明细、预算与失败提示 | 只读汇总；没有 take 对比、换模型、单集素材包 |
| `/video/production` | 全局任务队列、新建任务、重试、取消、推进队列、尝试记录 | 没有按集分组；没有换模型；没有接受/退回 take |
| `/projects/workflow?stage=audio` | 对白、声音档案、音频资产、字幕、口型、混音检查，只读 | `/audio/*` 全是 SpecPage，没有真实生成、校对、锁定动作 |
| `/projects/workflow?stage=post` | 分集状态、时间线版本、轨道视图、输出准入 | 没有 E4/E5 单集工作区；时间线只按 query 切集 |
| `/post/timeline` | 分集时间线轨道、重建过期片段、提交质检 | 只能查看/重建，没有剪辑版本、画面锁定 |
| `/post/episodes` | 分集列表、单集输出、单集质检、跳时间线 | 有单集动作，但入口分散，不是单集工作区 |
| `/projects/workflow?stage=qc` | 质检报告、问题项、质量矩阵、返工台账，只读 | 报告与单集未强绑定；没有逐集 QC 门禁 |
| `/quality/reports` | 执行质检、报告详情、确认通过 | 项目级报告列表，不是单集检查清单 |
| `/quality/rework` | SpecPage 占位 | 没有返工单流转、退回阶段、复验 |
| `/projects/workflow?stage=delivery` | 交付清单、交付记录、门槛检查 | 只有项目级交付包，没有单集入库 |
| `/post/review` | 全项目终审通过/退回 | 终审以项目整体为单位，不能逐集入库 |
| `/post/delivery` | 项目级交付包生成、冻结、记录 | 没有单集交付包与批次交付 |

补充事实：

- `StageWorkspace.vue` 除 brief 外，基本都是 DataTable/卡片只读展示；
- `stageLinksMap` 仍把剧本、导演、视频、音频、后期、质检、交付指向独立页面，用户会跳页；
- 单集详情目前走 `AppDrawer`，只展示场次/镜头/时长/质检/状态，不能完成 E0–E7；
- `episodes` 数据只有 `project/no/title/scenes/shots/duration/status/qc/timeline`，没有 `batch/currentStep/owner/modelBaseline/gate`；
- `shots` 数据有 `model` 字符串和 `version='待生成'`，但没有 take、模型版本、seed、参数和接受记录；
- 示例项目 SP-26031 的 24 集中，16 集已通过质检、7 集待生产、1 集生产中，但项目层只有一个“生产中”状态，项目与单集状态尚未打通。

---

## 2. 差距分类

### 2.1 保留

- `projects/workflow` 固定页头 + 阶段管线 + 工作区壳；
- `BriefWorkspace` 的弹窗交互模式和门禁表达；
- 现有可能的数据表、状态标签、抽屉、确认弹窗；
- 项目概览作为治理看板，不承担单集执行。

### 2.2 改造

| 现有页面 | 改造方向 |
|---|---|
| 项目概览 | 增加批次进度、单集矩阵、模型基线、交付风险 |
| 剧本创作 | 从“项目剧本版本表”改为“24 集剧本矩阵 + 当前集剧本工作区” |
| 导演规划 | 从“全项目镜头表”改为“当前集镜头契约 + 资产锁 + 模型基线” |
| 视频生产 | 从“全局任务队列”改为“按集任务队列 + take 对比 + 换模型” |
| 音频字幕 | 从只读表改为“当前集对白/音效/字幕/混音”可操作工作区 |
| 后期合成 | 从分集表 + 轨道视图改为“当前集剪辑/画面锁定”工作区 |
| 质量检测 | 从项目报告列表改为“单集 QC 清单 + 批次抽检” |
| 终审交付 | 从项目终审/交付包改为“单集终审入库 + 季包交付” |

### 2.3 新增

1. **批次对象与批次看板**：B1–B4，每批 6 集，显示开工门禁、交付门禁、模型基线。
2. **单集状态机**：E0–E7、`返工中/阻塞`、当前阶段、负责人。
3. **单集工作区**：同一壳内切换 E0–E7，不再跳独立页面。
4. **24 集剧本矩阵**：每集剧本状态、版本、锁定人、审核结论。
5. **镜头契约与资产锁**：逐镜配置、角色/场景引用、模型配置、试跑。
6. **Take/版本树**：每次生成一个 take，保留父版本、模型、参数、成本、接受状态。
7. **模型基线与变更单**：镜头级/单集级/批次级，审批与重检范围。
8. **单集 QC 报告**：与集号、母版版本绑定。
9. **单集交付包**：单集入库记录，季包另行汇总。
10. **返工单**：退回阶段、问题类型、复验状态。

### 2.4 下线/重定向

不立即删除，先保留深链；流水线入口移除，功能对齐后逐步重定向到单集工作区：

- `/creation/script`、`/creation/review` → E1；
- `/director/shots` → E2；
- `/video/production` → E3；
- `/post/timeline`、`/post/episodes` → E4/E5；
- `/quality/reports`、`/quality/rework` → E6；
- `/post/review`、`/post/delivery` → E7。

原则：旧路由只作为兼容入口，不再作为流程主路径。

---

## 3. 单集工作区信息架构

### 3.1 路由与入口

建议使用同一路由，通过 query 切换视图，避免新增大量页面：

```text
/projects/workflow?view=project
/projects/workflow?view=batch&batch=B1
/projects/workflow?view=episode&batch=B1&episode=1&step=E3
```

- `view=project`：项目概览与 9 段阶段管线；
- `view=batch`：批次看板，显示 6 集矩阵；
- `view=episode`：单集工作区，显示当前集 E0–E7；
- `step`：当前单集阶段，默认取 `episodeState.currentStep`。

入口：

- 项目概览的批次卡 → 批次看板；
- 批次看板的集卡 → 单集工作区；
- 各阶段工作区的“集 × 阶段”矩阵 → 单集工作区；
- 单集工作区顶部“返回批次”。

### 3.2 页面壳

单集工作区固定为：

1. **顶部面包屑**：项目 / B1 / 第 1 集；
2. **单集头**：集名、时长、状态、负责人、当前阶段、模型基线；
3. **E0–E7 步进条**：点击切换阶段，显示每个阶段状态；
4. **主工作区**：随阶段切换；
5. **右栏**：门禁、阻塞项、变更记录、评论、版本；
6. **底部动作条**：通过门禁、退回、查看批次、查看上游版本。

阶段管线仍保留项目级 9 段，但单集工作区内使用 E0–E7 步进，避免“项目阶段”和“单集阶段”混用。

### 3.3 批次看板

批次看板不是批量编辑页，而是治理视图：

- 顶部：B1–B4 批次切换、开工/交付门禁、模型基线、负责人；
- 主区：6 集卡片，显示 E0–E7 当前阶段、QC、阻塞、负责人；
- 右侧：批次风险、资产锁状态、模型变更、抽检结果；
- 点击集卡进入单集工作区；
- 不提供“批量填写 6 集表单”。

### 3.4 单集工作区布局

```text
┌ 面包屑：项目 / B1 / 第 1 集 ─────────────────────────────┐
│ 单集头：标题 · 90 秒 · 状态 · 负责人 · 模型基线 · 门禁      │
│ E0 ─ E1 ─ E2 ─ E3 ─ E4 ─ E5 ─ E6 ─ E7                  │
├ 主工作区（当前阶段面板） ───────────────┬ 右栏 ───────────┤
│ 输入清单 / 剧本 / 镜头 / 素材 / 剪辑 ... │ 门禁 / 阻塞      │
│                                          │ 变更 / 评论 / 版本│
├ 底部：通过门禁 · 退回 · 返回批次 ────────────────────────┤
└──────────────────────────────────────────────────────────┘
```

---

## 4. E0–E7 功能矩阵

| 阶段 | 主工作区内容 | 可用动作 | 交互方式 |
|---|---|---|---|
| E0 输入确认 | 输入清单、前后集摘要、人物/场景需求、资产可用性、阻塞项 | 确认输入、标记阻塞、指派负责人 | 轻量动作弹窗；清单内嵌 |
| E1 剧本锁定 | 当前集剧本、版本对比、钩子/时长检查、连续性、合规 | 新建版本、编辑正文、提交审核、锁定 | 正文内嵌；版本/审核/锁定弹窗 |
| E2 镜头与资产 | 镜头表、镜头契约、角色/场景/道具引用、音色、模型配置、试跑 | 编辑契约、锁定资产、锁定模型、发起试跑 | 镜头表内嵌；契约/资产/模型弹窗 |
| E3 素材生产 | 镜头队列、take 对比、成本/耗时、素材包 | 生成、接受、退回、重试、换模型、标记素材齐 | 队列内嵌；take/换模型/接受弹窗 |
| E4 剪辑 | 镜头序列、粗剪/精剪版本、时长与节奏、缺失镜头 | 组装、重剪、画面锁定、退回素材 | 序列内嵌；锁定/退回弹窗 |
| E5 声音字幕 | 对白/配音、口型、音效/配乐、混音、字幕、片头尾 | 生成对白、对轨、混音、字幕校对、锁定 | 轨道/字幕内嵌；生成/校对/锁定弹窗 |
| E6 QC | 质检清单、问题分级、退回阶段、整改复验 | 执行 QC、标记问题、退回、复验、签字 | 清单内嵌；退回/签字弹窗 |
| E7 终审入库 | 终审清单、元数据、字幕/封面、权利、交付包 | 终审通过、打包、入库、退回 | 清单内嵌；终审/打包/入库弹窗 |

交互边界：

- 轻量、一次性的动作走居中弹窗；
- 长文本、镜头表、时间线、字幕表留在工作区内；
- 所有从单集工作区发起的动作不跳新页面；
- 退回、换模型、重制必须二次确认并记录原因；
- 已交付集只读，重制入口单独标识。

---

## 5. 数据与 API 缺口

### 5.1 数据对象

| 对象 | 现状 | 需要补 |
|---|---|---|
| Batch | 不存在 | `id/project/index/range/status/startGate/deliveryGate/modelBaselineId` |
| EpisodeState | 只有 `status/qc/timeline` | `batch/currentStep/owner/gate/blockers/modelBaselineId/updatedAt` |
| EpisodeScript | 只有项目级 `scripts` | `project/ep/version/content/status/lockedBy/lockedAt` |
| ShotContract | 有 `shots`，字段不全 | `ep/shot/modelConfig/refs/duration/dialogue/acceptance/pilotStatus` |
| Take | 不存在 | `shotId/parentTakeId/modelVersion/seed/params/cost/status/accepted` |
| ModelBaseline | 只有 `model` 字符串 | `id/scope/model/version/params/approver/effectiveBatch` |
| EpisodeQC | 报告有 `level` 和 `object`，未强绑集 | `project/ep/masterVersion/dimensions/result/issues` |
| EpisodePackage | 只有项目级交付 | `project/ep/version/files/metadata/rights/status` |
| ReworkOrder | 有返工台账，缺流转 | `sourceStage/targetStage/issueType/round/status/verifier` |

### 5.2 API 草案

```text
GET  /projects/:id/batches
GET  /projects/:id/batches/:batch/episodes
GET  /projects/:id/episodes/:no/state
PATCH /projects/:id/episodes/:no/state

GET  /projects/:id/episodes/:no/script
POST /projects/:id/episodes/:no/script
POST /projects/:id/episodes/:no/script/lock

GET  /projects/:id/episodes/:no/shots
POST /projects/:id/episodes/:no/shots
POST /projects/:id/episodes/:no/assets/lock
POST /projects/:id/episodes/:no/model-baseline

GET  /shots/:id/takes
POST /shots/:id/takes
POST /takes/:id/accept
POST /takes/:id/retry
POST /takes/:id/switch-model

GET  /projects/:id/episodes/:no/qc
POST /projects/:id/episodes/:no/qc
POST /projects/:id/episodes/:no/package
```

所有写接口需带 `projectId`、`episodeNo`、`version`，并返回新的状态与门禁结果。

---

## 6. 分阶段实施计划

### 阶段 1：单集工作区只读壳（优先）

- 新增 `view=batch` 批次看板；
- 新增 `view=episode` 单集工作区；
- 显示 E0–E7 步进、当前状态、门禁、阻塞、负责人；
- 集卡进入单集工作区；
- 复用现有 episodes/shots/tasks 数据，先做只读汇总。

验收：能从项目概览进入 B1，再从 B1 进入第 1 集，看到完整 E0–E7 状态，不跳旧页面。

### 阶段 2：E0–E3 可操作

- 输入确认；
- 单集剧本版本与锁定；
- 镜头契约、资产锁、模型基线；
- 生成队列、take 对比、接受/重试/换模型；
- 单集素材包。

验收：第 1 集可从 E0 推进到素材齐，所有动作有记录。

### 阶段 3：E4–E7 可操作

- 剪辑与画面锁定；
- 声音、字幕、混音；
- 单集 QC 与退回；
- 终审、单集交付包、入库；
- 批次抽检。

验收：第 1 集可从素材齐走到已交付，批次看板同步更新。

### 阶段 4：旧页面收口

- 流水线不再跳旧页面；
- 旧路由保留兼容，逐步重定向；
- 补权限、审计、异常态；
- 3 集试跑与指标采集。

---

## 7. 当前完成情况

已完成：

- 现有页面能力盘点；
- 9 段页面差距表；
- 保留/改造/新增/下线分类；
- 单集工作区路由与布局；
- E0–E7 功能矩阵；
- 数据与 API 缺口；
- 四阶段实施计划；
- 阶段 1 代码改造（提交 `001270f`）：`view=batch` 批次看板、`view=episode` 单集工作区、项目概览批次摘要、E0–E7 步进、集卡入口与返回批次。
- 阶段 2 代码改造（提交 `e5d4125`）：单集状态契约、E0–E3 动作接口、居中弹窗动作、E3 镜头任务、失败重试、换模型 take 与单集事件流。

未完成：

- E4–E7 写操作与真实单集交付包；
- 真实后端 `episodeState`、take、模型基线接口；
- 旧阶段深链收口；
- 3 集试跑。

---

## 8. 后续推进计划

### 8.1 阶段 1 已完成

阶段 1 已落地并通过验证：

1. 项目概览新增批次摘要，可直接进入 B1–B4；
2. 批次看板按 6 集分组，显示开工门禁、交付门禁、模型基线占位和集卡；
3. 单集工作区支持 E0–E7 步进、当前阶段面板、门禁/风险/版本右栏；
4. `view=batch|episode` 使用 query 驱动，可回退到项目概览与批次；
5. 验证通过：`npm run check`、`npm run test`（98 例）、`npm run test:e2e`（7 例）、`npm run build`、`npx eslint . --quiet`。

仍保留旧阶段深链，避免破坏现有页面入口与 E2E；旧路由收口放到阶段 4。

### 8.2 阶段 2 已完成：E0–E3 可操作

阶段 2 已落地（提交 `e5d4125`）：

1. 新增 `episodeStates` 集合：从现有分集状态派生 `currentStep`、`batch`、`inputConfirmed`、`scriptLocked`、`assetsLocked`、`productionStarted`、`modelBaseline`，不修改旧分集字段。
2. 新增 `POST /projects/:id/episodes/:ep/actions`：支持 `confirmInput`、`lockScript`、`lockAssets`、`startProduction`、`retryTask`、`changeModel`、`acceptTake`。
3. E0–E3 动作进入居中弹窗；每次动作写入 `episodeEvents`，右栏显示变更记录。
4. E2 锁定模型基线；E3 按本集镜头批量派发任务，任务表显示 `Take`。
5. 单镜头换模型时旧任务标记“已替代”，新任务生成独立 take，不覆盖旧版本。
6. E3 失败任务可重试；任务完成后可接受 take，全部镜头接受后自动推进 E4。

验证结果：

- `npm run check` 通过；
- `npm run test` 101 例通过；
- `npm run test:e2e` 8 例通过；
- `npm run build` 通过；
- `npx eslint . --quiet` 0 error；
- 1366 / 1600 宽度无横向溢出。

边界仍然明确：

- 单集状态来自 mock 派生数据，真实后端 `episodeState` 接口尚未接入；
- 任务状态仍由 mock 队列控制，没有真实生成回调；
- E4–E7 仍是只读展示。

### 8.3 阶段 3 已完成：E4–E7 可操作

阶段 3 已落地：

1. E4 剪辑：`buildTimeline` 建立单集 6 轨时间线，`lockTimeline` 锁定时间线并推进 E5。
2. E5 声音字幕：`generateAudio` 生成对白音频与字幕初稿，`approveSubtitle` 确认字幕，`runLipSync` 执行口型同步，`checkMix` 混音检查后推进 E6。
3. E6 单集 QC：`runEpisodeQc` 生成单集 QC 报告，`acceptEpisodeQc` 确认通过并推进 E7；`reworkEpisode` 可退回 E4 或 E5，旧 QC 报告归档，返工后可重新执行 QC。
4. E7 终审入库：`approveEpisode` 生成单集终审记录，`packageEpisode` 生成 `DP-<projectCode>-EP##` 单集包并置为已交付。
5. 所有动作继续走居中弹窗并写入单集事件流；右侧门禁按 E4–E7 分别展示剪辑、音字、QC 与交付检查项。
6. 为让演示数据中的 E4 可达，增加 `advanceQueue`：将本集活动任务批量置为已通过并推进 E4；UI 明确标注为 Mock 队列推进。

验证结果：

- `npm run check` 通过；
- `npm run test` 102 例通过；
- `npm run test:e2e` 9 例通过，新增 E4→E7 全链路；
- `npm run build` 通过；
- `npx eslint . --quiet` 0 error；
- 1366 / 1600 宽度无页面级横向溢出。

边界仍然明确：

- 单集状态与交付仍来自 mock 派生数据，真实后端 `episodeState`、take、单集 QC 与单集交付接口尚未接入；
- `advanceQueue` 是 mock 便利动作，不是真实生成回调；
- `runEpisodeQc` 当前固定 PASS，QC FAIL 的退回路径已具备接口与 UI，但缺少正常触发 FAIL 的演示数据。

### 8.4 下一步：旧页面收口与真实接口

1. 收口旧阶段深链，保留现有 E2E 入口兼容层。
2. 接入真实后端 `episodeState`、take 版本树、模型基线与单集 QC/交付接口。
3. 增加 QC FAIL 的可复现场景，验证“QC 失败 → 退回 E4/E5 → 复验”闭环。
4. 执行批次级 3 集试跑，验证批次交付门禁与单集包汇总。

---

## 9. 风险与待确认

- 现有 mock 数据没有批次、take、模型基线和单集状态，阶段 1 需要先做派生数据或补 seed；
- 旧页面仍有独立入口，收口前可能出现双路径；
- 权限体系按项目/动作授权，尚未有单集级权限；
- 完整时间线是否内置，还是只做镜头序列与外链 NLE；
- 平台是否按 6 集包交付，决定批次看板的交付门禁口径。
