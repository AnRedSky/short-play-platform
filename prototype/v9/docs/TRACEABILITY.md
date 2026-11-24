# V9 原型 · 页面与业务方案追溯表

基准文档：`docs/项目业务方案（V3.0）.md`
技术规范：`prototype/通用静态原型开发规范.md`
适用范围：`prototype/v9`（17 域 / 64 条路由 / 6 个身份；V9.1 起业务写操作由 `store.js` 统一承载）

## 1. 全局对照

| 方案条款 | 原型落点 |
| --- | --- |
| §1.3 核心业务原则、§1.5 非目标与边界 | 全站 `demo-strip` 声明、每页 `footer-note`、README「原型边界」 |
| §2.2 业务功能域总图 | `modules/` 17 个目录与侧栏 17 个分组 |
| §2.3 核心业务链路 | `workspace/home` 链路视图；各页面 `chain` 组件 |
| §3.1 业务对象总表 / §3.3 版本与引用规则 | `data.js` 全部 Mock 字典；`post/versions`、`assets/usage` |
| §3.4 状态机总则 | 各页状态列 + `U.pill` 三态配色；`projects/lifecycle` |
| §4.4 角色体系 / §4.5 权限模型 / §4.6 权限基本规则 | `data.js` roles/permissions/identities；`app.js` 三层校验；`orgs/roles` |
| §4.7 凭据与运维隔离 | `models/config`、`models/providers`（`U.masked`，任何角色不可见明文） |
| §4.8 人员变动处理 | `orgs/handover` |
| §5.5 项目状态机（15 状态） | `projects/detail`、`projects/lifecycle`、`data.js projectStates` |
| §12.2 任务状态（11 状态） | `tasks/list`、`tasks/attempt` |
| §18.2 作品与交付状态（6 类） | `post/works` |
| §20.5 页面功能域清单 | 见下表逐域映射 |
| §22.1 数据归属 / §22.4 数据隔离边界 | `data.js` 归属字段、`orgs/*`、`models/config` |
| §24.9 真实性红线 | 全站演示声明；不含真实媒资、真实账单、真实凭据 |

## 2. 逐域映射

| 域（目录） | 路由 | 对应方案章节 | 页面职责 |
| --- | --- | --- | --- |
| ops | `ops/overview` | §21.1 平台管理端 | 平台健康、服务与资源总览 |
| ops | `ops/capabilities` | §21.3 能力字典与适配器治理 | 能力字典、适配器版本与错误码 |
| ops | `ops/queue` | §12.3 调度流程 | 平台级队列与并发、备份演练 |
| ops | `ops/logs` | §21.2 系统设置与基础设施 | 系统日志（服务 / 调度 / 供应商回执）、监控口径与运维边界 |
| ops | `ops/config` | §21.2 系统设置与基础设施、§21.4 数据保留 | 平台参数、保留策略、配置项 |
| orgs | `orgs/enterprise` | §4.1 企业主体 | 企业信息、策略、预算总览 |
| orgs | `orgs/departments` | §4.2 部门与组织单元 | 部门结构与人数、部门预算 |
| orgs | `orgs/members` / `orgs/member` | §4.3 员工账号与成员关系 | 员工列表与单员工档案 |
| orgs | `orgs/roles` | §4.4 / §4.5 | 六角色与 30 个权限码矩阵 |
| orgs | `orgs/grants` | §5.6 项目成员与授权 | 项目成员授权与回收 |
| orgs | `orgs/handover` | §5.7 项目移交、§4.8 人员变动 | 移交与离职回收、历史记录 |
| projects | `projects/list` | §5.1 项目属性 | 项目清单与筛选 |
| projects | `projects/new` | §5.2 项目创建流程 | 创建表单与预检 |
| projects | `projects/detail` | §5.1 / §5.5 | 项目详情、状态推进、成员 |
| projects | `projects/lifecycle` | §5.8 项目异常与终止 | 暂停 / 异常 / 终止与恢复 |
| workspace | `workspace/home` | §20.1–§20.3 工作台 | 我的项目、待我处理、链路进度 |
| workspace | `workspace/assistant` | §20.4 指令式生产助手 | 六类指令识别、解析结果、高风险二次确认 |
| workspace | `workspace/projects` | §20.2 工作台入口 | 我参与的项目与集次进度 |
| notify | `notify/inbox` | §17.1–§17.3 | 通知要素（原因 / 影响 / 动作 / 时限） |
| notify | `notify/incidents` | §17.3 / §17.4 | 异常闭环、4 小时升级、局部暂停原则 |
| creation | `creation/brief`、`creation/plan` | §5.3 创意输入、§5.4 创意方案 | 创意简报七种模式与方案评分 |
| creation | `creation/script`、`creation/review` | §6.1–§6.4、§16.2 节点 A | 剧本版本、变更影响、审核通过/退回 |
| creation | `creation/breakdown` | §7.1 结构拆解 | 集 / 场 / 镜头拆解与重跑 |
| director | `director/plan`、`director/shots` | §7.2、§8.1 镜头生产计划 | 场次规划、镜头契约字段、并行分组 |
| director | `director/cast`、`director/world` | §7.3–§7.6 | 人物 / 场景 / 服装道具档案与一致性 |
| director | `director/storyboard` | §7.2 分镜规划 | 分镜板与镜头状态 |
| video | `video/production`、`video/results`、`video/preview` | §8.2 镜头生成、§8.4 能力清单、§12.7 衔接门禁 | 四状态分离（供应商成功/下载/持久化/质量通过）、版本采用 |
| audio | `audio/dialogue`、`audio/voice` | §9.1 声音配置、§9.2 对白生成 | 对白生成与回听校验、声音档案与授权 |
| audio | `audio/bgm`、`audio/subtitle` | §9.3 音乐音效、§9.4 字幕、§9.5 口型 | 素材授权台账、字幕版本与口型对齐 |
| post | `post/timeline`、`post/episodes` | §10.1 时间线、§10.5 分集输出 | 轨道编排、标脏片段、分集成片质检 |
| post | `post/review` | §16.3 节点 B | 成片审核清单与三种结论 |
| post | `post/delivery`、`post/works`、`post/versions` | §18.1–§18.4 | 9 类交付内容、交付冻结、作品状态、版本链 |
| quality | `quality/gates`、`quality/reports` | §11.1–§11.3、§11.6 | 四级 × 十维矩阵、三态结论、报告 |
| quality | `quality/rework` | §11.4 / §11.5、§8.3 | 返工台账、最小单元、轮次上限 |
| tasks | `tasks/list`、`tasks/queue`、`tasks/attempt` | §12.1–§12.6、§12.8 | 11 状态、依赖并行、Attempt / 调用双层证据 |
| models | `models/config`、`models/providers` | §13.1 供给模式、§13.5 个人配置 | 资源归属、7 家供应商、脱敏凭据 |
| models | `models/routing` | §13.2–§13.4、§13.6 | 能力清单、主/辅/备路由、兼容校验 |
| assets | `assets/library`、`assets/usage` | §14.1–§14.6 | 八类资产、版本不覆盖、引用检查 |
| cost | `cost/ledger`、`cost/budget`、`cost/usage` | §15.1–§15.6 | 预计/实际/失败三列、预算阈值、计量差异 |
| analytics | `analytics/enterprise`、`analytics/departments`、`analytics/employees`、`analytics/me` | §19.1–§19.7 | 三类数据口径、部门/员工对比、个人视图、快照 |
| compliance | `compliance/rights`、`compliance/risks`、`compliance/audit` | §16.6 / §16.7、§16.8、§17.3 | 授权台账与到期提醒、风险等级、11 类审计事件 |

## 2.1 菜单层级与业务链路映射

| 一级菜单 | 二级菜单（流程节点） | 三级子菜单（具体操作） | 依据 |
| --- | --- | --- | --- |
| 创作工作台 | 工作台 / 通知与异常 | 工作台首页、指令式生产助手、我的项目 / 待办与通知、异常中心 | §20.2 工作台入口、§17.1 通知类型 |
| 短剧制作 | 立项与项目 | 项目列表、新建项目、制作流水线、项目详情、生命周期与状态机 | §5.1 项目属性、§5.5 状态机 |
| 短剧制作 | 创意与剧本 | 创意设定、创意方案、剧本版本、剧本审核、剧本拆解 | §5.3 创意输入、§6.1–6.3 剧本与审核 |
| 短剧制作 | 导演与视觉 | 镜头生产计划、人物视觉档案、场景与道具、镜头契约、分镜板 | §7.1–7.7 导演规划与视觉资产 |
| 短剧制作 | 视频生产 | 视频生产队列、生成结果、预览与校验 | §8.1–8.4 镜头生产 |
| 短剧制作 | 音频与字幕 | 对白配音、声音档案、配乐与音效、字幕与口型 | §9.1–9.6 音频与字幕 |
| 短剧制作 | 后期与交付 | 时间线与剪辑、分集成片、最终成片审核、交付包、作品库、版本链 | §10.1–10.6 后期、§16.3 终审、§18 交付 |
| 短剧制作 | 质量与返工 | 质量门禁、质量报告、返工与返工台账 | §11.1–11.6 质量与返工 |
| 资源与治理 | 模型资源 / 生产任务 / 数字资产 / 成本与预算 | 资源配置、供应商与模型、能力与路由 / 生产任务、资源池与队列、尝试与调用记录 / 资产库、引用与使用关系 / 成本台账、预算与阈值、用量与计量 | §13 模型与资源、§12 任务、§14 资产、§15 成本 |
| 经营分析 | 企业经营 | 企业整体数据、部门对比、员工对比、我的数据 | §19.1–19.7 经营分析 |
| 企业与合规 | 组织与权限 / 合规与审计 | 企业主体、部门与组织单元、员工账号、员工档案、角色与权限、项目成员授权、离职与移交 / 权利与授权台账、风险与异常、审计日志 | §4.1–4.8 组织与权限、§16.6–16.8 合规审计 |
| 平台运维 | 平台管理 | 平台总览、能力字典与适配器、队列存储与备份、系统日志、平台业务配置 | §21.1–21.4 平台管理与系统设置 |

## 3. V7.5 差距矩阵 P0/P1 项覆盖

| 差距项 | 覆盖位置 |
| --- | --- |
| 独立 Episode / Scene / Character / Prop / Dialogue / Timeline 对象 | `data.js` 独立字典；`creation/breakdown`、`director/*`、`audio/dialogue`、`post/timeline` |
| Shot 全字段契约 | `director/shots` + `video/preview` 契约比对 |
| 预算超限自动暂停与任务衔接规则化 | `cost/budget`、`tasks/queue`、`notify/incidents` |
| 自然语言指令入口（六类目标 + 确认） | `workspace/assistant` |
| 员工横向对比、视频生成量、音频异常率、单位时间完成集数 | `analytics/employees`、`analytics/enterprise` |
| 定时快照与对比 | `analytics/enterprise` 快照表（不可回溯） |
| 合规记录新增/续期/到期提醒 | `compliance/rights` |
| 资产删除前引用检查 | `assets/usage` |
| 交付后新版本链 | `post/works`、`post/versions` |
| 独立资源池与任务队列视图 | `tasks/queue`、`ops/queue` |
| 平台用户从企业成员视图拆出 | `ops/overview` 与 `orgs/members` 分离 |

## 4. 已知未实现项（刻意保留）

- **真实鉴权与持久化**：权限在前端三层校验（身份 → 路由 → 动作 `guard`），无服务端会话；业务现场写入浏览器 localStorage（键 `shortplay.workbench.v937`），顶栏「恢复初始数据」清库回初始态。此为规范 §十三-10 的**有意偏离**，理由与影响见 `AUDIT-V9.6.0.md` S-09 与 README 符合性说明。
- **真实媒资**：音频、字幕文件、视频帧均以参数与状态呈现，不加载任何文件，不播放声音。
- **真实调度与计费**：任务不实际提交供应商，但任务状态机、四状态分离、Attempt 计数、失败分类与转人工、成本台账与预算联动都按真实规则写入本机状态。
- **批量重跑**：剧本变更影响分析已给出八维度汇总与镜头级受影响清单，确认后仅把受影响镜头标记待复核，不自动重做；批量重生成仍需逐条触发。
- **服装资产独立对象**：业务方案 §7.5 的服装档案（人物 × 剧情时间 × 场次 × 状态 × 连续性）尚未独立建模，当前以人物档案中的造型字段表达。
- **跨端**：仅桌面控制台形态（1440 / 1024 / 768 三档断点），未实现移动端专用布局。
- **导出**：CSV 导出为当前表格快照，不含真实账单与凭据；审计导出动作本身写入审计记录。

## 5. 交付前回归记录（V9.6.0 更新）

```
node --check 全量 JS    → 通过（17 模块 + 5 基础设施文件，0 语法错误）
node tools/regress.mjs  → 通过（66 条路由渲染、权限码、占位文本、404/403/空态边界）
node tools/flow.mjs     → 通过（18 条业务流断言，直驱 DB.ops）
node tools/_journey.mjs → 通过（22 条全链路断言：新建→创意→方案→剧本→审核→拆解→资产→计划→生产→字幕→后期→质检→终审→交付→归档）
node tools/_audit_actions.mjs → 322 个注册动作 / 264 处引用 / 0 未注册
node tools/_audit_perms.mjs   → 23 个守卫码 / missing none
node tools/_audit_links.mjs   → 66 路由 · 17 内链 · 255 动作 · 0 失效内链
node tools/_audit_project_guard.mjs → 26 / 26 项目域页面在无可见项目时阻断
_smoke.html（浏览器）   → 通过（66 路由 + 3 身份权限拦截，无 JS 错误）
```

回归结论：路由前缀与模块目录一致、路由无重复、66 条路由均可渲染、渲染结果无 `undefined / null / NaN / [object Object]`、每个页面均含 `page` 骨架、404 / 403 / 空态边界均可正常展示并带返回入口。

身份可见路由统计（由 `regress.mjs` 输出，V9.6.0）：ops 5 / admin 33 / dept 24 / owner 49 / staff 41 / auditor 24。

## 6. 视觉复核记录（2026-11-22）

用本机 Chrome headless（1440×1250 与 1120×760 两档）对以下视图做了逐页截图核对：`workspace/home`（默认落地）、`post/timeline`（六轨剪辑）、`quality/gates`（四级×十维矩阵）、`tasks/queue`（状态看板）、`projects/list`、404 与 403 视图。

本轮修正项：

- **长文案裁切**：`.table` 原为 `white-space:nowrap`，中文长句在卡片右缘被截断；改为按内容换行，数字/编号列保留 `nowrap`，`.list-row .v` 允许折行，长句不再丢字。
- **空态文案误作卡片副标题**：`U.card(title, body, sub)` 第 3 参是副标题、`U.table(headers, rows, emptyText)` 第 3 参才是空态文案，此前 24 处把「暂无…」一类空态串传给了卡片副标题，已全部清理。
- **窄屏品牌**：1120 档侧栏品牌副标题原会折成两行，改为单行 + 省略号。

复核结论：侧栏分组与权限过滤符合预期（`owner` 在「经营分析」下仅可见「我的数据」），矩阵、轨道、看板、环形图、指标卡均正常渲染，无重叠与溢出。

## 7. V9.1 真实流程层映射（2026-11-22）

| 业务链路 | 主要动作（`App.on`） | 状态/数据落点 | 交互规格 |
| --- | --- | --- | --- |
| 立项 → 创意 → 剧本 → 锁定 | `projects.create/saveDraft`、`creation.newBrief/deriveBrief/regenPlan/choosePlan/generateScript/submitReview/approveScript/rejectScript/lock/editScript/partialScript/rerunBreakdown` | `projects.status` 走 15 状态机；`briefs`、`creativePlans`、`scripts` 版本递增 | §1、§2 |
| 导演规划 → 固化 → 生产 | `director.freezePlan/confirmChar/confirmLoc/confirmProp/submitShot/batchSubmit/regenerate/pickRegen/replan/addRef/versionChar/check/newShot…` | 门禁 `Store.gate("生产")`；镜头契约、资产引用、版本与「需复核」标记 | §3 |
| 视频生产 → 质检 → 失败处理 | `video.runTask/newBatch/pauseQueue/taskDetail/cancelTask/handleFail/adopt/adoptCurrent/regenShot` | `tasks` 11 状态、Attempt、`shots.status`、`qualityReports`、`Store.spend` | §4 |
| 音频/字幕 | `audio.regenLine/batchDialogue/voiceDetail/newVoice/renew/replaceVoice/fixRights/genSub/batchLip/redoLip…` | `dialogues`、`voiceProfiles`、`rights`、`subtitles`、`lipSync` | §5 |
| 后期 → 终审 → 交付 | `post.newTimeline/exportTimeline/epQc/runEpQc/startReview/pass/rework/newDelivery/confirmDelivery/voidDelivery/archiveProject` | `timelines`、`episodes.qc`、`reviews`、`deliveries`、`works`、项目状态 | §6 |
| 质量与返工 | `quality.reportDetail/judge/rerun/newRework` | `qualityIssues`、`reworkLedger`、质量报告 | §7 |
| 任务治理 | `tasks.detail/execute/batchRetry/switchModel/pauseQueue/decide/cancel/setConcurrency` | `tasks`、`queues` | §8 |
| 通知与异常 | `notify.handle/close/toTask/escalate/incidentAction` | `notifications.state`、`todos`、`incidents` | §9 |
| 合规授权 | `compliance.rightDetail/renew/replace/disable/riskDetail/closeRisk/escalate/newRisk` | `rights`、`risks`、`audits` | §10 |
| 资产 | `assets.detail/refs/deleteCheck/deleteOne/newVersion/upload` | `assets.refs/formal/version` | §11 |
| 成本预算 | `cost.adjustBudget/setThreshold/addBudget/resume` | `budgets`、`costs`、`usage` | §12 |
| 模型资源 | `models.test/setDefault/newProvider/editRoute` | `providers`、路由策略 | §13 |
| 组织与权限 | `orgs.toggle/offboard/newMember/transfer/grantNew/revokeGrant` | `users`、`projects.members`、授权台账 | §14 |
| 平台运维 | `ops.editConfig/saveConfig/restoreDrill/scaleRequest` | `ops.drills`、`ops.changes`、`audits` | §15 |
| 指令助手 | `workspace.run/editParams` | 按意图分发到上述动作；高风险二次确认 | §16 |

验证口径：`tools/flow.mjs` 断言业务规则（前置拦截、扣费、门禁、预算阈值），`_e2e.html` 断言真实点击链路（表单校验、状态不变、数据写回、Toast 文案）。
