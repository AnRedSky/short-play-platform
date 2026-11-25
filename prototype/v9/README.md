# FRAME 短剧工场 · 第 9.7.0 版静态交互原型

单一企业内部 AI 短剧制作平台的静态交互原型。**全部数据为虚构示例数据**，不连接任何真实模型、存储、任务调度或账单系统；但业务流程按真实系统执行：状态机、门禁、表单校验、权限拦截、成败反馈与数据联动都是真实逻辑，不是占位 Toast。

交互规格（可直接作为前端实现参考）：`docs/INTERACTION-SPEC.md`。

## 产品主线（V9.1 起）：单人跑完整部剧

主线口径已定为**「一名项目负责人 + AI 独立跑完整部短剧」**：创意→剧本→导演规划→视频→音频/字幕→后期→质检→交付，全部入口按这条链路的顺序排列；组织、部门、授权、移交是**可选的协作能力**，不是完成作品的必要环节。

由此确定的三条硬约束：

1. 默认视角是项目负责人（`i-owner`）；工作台、项目、生产域都以「我负责 / 被我授权的项目」为数据范围。
2. 审批节点 A/B 保留，但负责人可以自己完成确认（同一人既是制作人也是审核人），不强制第二人。
3. 顶栏身份切换冻结为**评审模式**：只用于让评审者查看其他角色的权限与数据范围，不作为产品功能。

#### 9.7.0 · B3–B7 补记（骨架、按钮密度、权限与账本）

B2 收盘后在同版内继续做了五类整改，均以脚本断言落地：

- **命名派生（B3）**：页眉章节不再手写——`ui.js` 的 `chapterOf()` 按当前路由在 `DB.menu` 里取二级菜单名，56 个调用点零改动；面包屑改三级（一级 / 二级 / 三级），全部由 `DB.menu` 派生；模块注册的 `label` 降级为内部 key。新增 `tools/_audit_naming.mjs`，56 路由断言 0 失败。
- **导航动作收口（R-10）**：全站的「返回项目列表」统一为 `common.projects`（删掉 `projects.listLink` / `director.toProjects` 两个动作），文案一致。
- **首页瘦身（R-21）**：`workspace/home` 从 13 区块压到 hero + 下一步 + 链路一行摘要 + 分集卡 + 3 KPI + 今日待办，共 6 个页面级操作；链路明细只在 `projects/workflow`。
- **按钮密度与体量（R-18 / R-22 / R-23）**：新增 `tools/_audit_buttons.mjs`（按 tab 渲染 76 个快照，口径为"表格行内、带 `data-value`/`data-id`/`data-pid` 的按钮随数据重复，不算页面操作"）。结果：同页重复动作 0、动作 >6 的页 0、≥12KB 的页 0；`analytics/enterprise` 14929 → 10989 字符（口径表 25 行 → 10 行核心指标 + 指向规范 §19.3–§19.5），`ops/overview` 的队列明细改为一行摘要、明细归 `ops/queue`。
- **权限对齐（B5）**：新增 `delivery.read` / `task.read`；`workspace/home` 改 `project.read|platform.read`（六身份全可达）；`post/delivery` 读走 `delivery.read`、执行走 `delivery.execute`；`tasks/*` 路由 `task.read`、写按钮 `task.operate`；`models/config` 改 `models.own|models.manage`，管理员多一张「企业托管资源与额度」。
- **预算单账本（R-32）**：`DB.analytics.depts` 与 `DB.enterprise` 的预算字段降级为 `DB.budgets` 的投影，由 `derived.syncScopeBudgets()` 在账本变动后回写；补齐「短剧二组」「经营管理部」两条部门账本；`_audit_kpi` 112 → 127 项（新增"部门/企业已用 = 账本 used"断言）。
- **规则卡收敛（R-17）**：`tools/_audit_rules.mjs` 盘出 43 张规则/口径卡（10 页各 2 张）。每个域只留 1 张（共 **15 张**，单页 ≤1），其余 28 张条文由 `tools/_dump_rules.mjs` 渲染抽取进 `docs/RULES-V9.7.0.md`（§R-01…§R-43 按域分节），页面对应位置折叠为一行 `U.notice("口径与规则见《口径与规则汇总》§R-xx：…")`。折叠由 `tools/_fold_rules.mjs` 做括号配对替换，信息不丢、可回查。
- **密度修补（R-17 收尾）**：折叠后 `tools/_audit_density.mjs` 报出 5 个过薄页。处理：①同页并排的两条折叠提示合并为一条带结论的口径行（`ops/logs` §R-21+R-22、`audio/voice` §R-08+R-09、`audio/subtitle` §R-06+R-07、`post/delivery` §R-28+R-29、`analytics/me` §R-02+R-03），不再出现"两行空提示"的视觉空洞；②`ops/logs` 补两张**真实派生**卡（来源分布按日志表实时统计、队列积压/失败/重试按 `DB.ops.queue` 投影）；③`creation/script` 无正文样本时补「剧本流转与当前位置」卡（四步流转 + 当前停在哪一步），不再只有空态。判定口径同步收紧为「<1400 字符，或 卡≤1 无表且 <3000 字符」，`orgs/member`（下钻缺 query 的空态）白名单。结果：**过薄 0 页 / 56 页**，规则卡仍 15 张、单页 ≤1。
- **按钮文案收口（R-19）**：新增 `tools/_audit_labels.mjs`（按 `U.btn("<文案>","<动作>")` 整对扫描 244 个动作），同动作多文案 **12 组 → 0 组**——`projects.wfOpen` / `projects.detail` / `compliance.toAudit` / `post.newVersion` / `director.check` / `director.regenerate` / `director.shotDetail` / `video.regenShot` / `creation.toPlan` / `creation.toScript` 统一为单一文案；`video/preview` 里「采用该版本」与「接受并记录理由」指向同一动作（同一行重复决策入口），删前者、只留强制写理由的那颗。白名单收敛为 3 条并写明理由：`common.export`（按对象命名）、`quality.judge`（判罚选项）、`projects.wfDelivery`（交付状态互斥 CTA）。
- **布局简洁度（S-01）**：新增 `tools/_audit_layout.mjs` 量化 56 页骨架（台账 28 / 详情 15 / 评审 9 / 看板 4）与六个密度指标；首批把 4 张最宽的表裁到 ≤10 列：`cost/ledger` 18→9（归属七维移入「核验」抽屉）、`compliance/rights` 14→9、`tasks/list` 13→10、`models/providers` 11→9。方向与后续清单见 `docs/REVIEW-SIMPLIFY-V9.7.0.md`（列 ≤9 / 卡 ≤5 / 提示 ≤1 / 容器 ≤2 四条基线）。
- **重复功能复核（R-35）**：新增 `tools/_audit_overlap.mjs`，56 路由（菜单 53 + 下钻 3）逐页渲染后按四个维度比对：同名卡片 0、真双入口写动作 0（改前 `director.check` 在 cast/world 两页）、页面相似度 ≥0.5 为 0 对。据此修掉 4 处残留：`projects/workflow` 去掉暂停入口（归 `projects/detail` 单项目 / `projects/lifecycle` 批量）、`projects/detail`「发起移交」改为跳 `orgs/handover`（新增 `orgs.toHandover` + `orgs.handoverProject` 预选）、`projects/lifecycle` 删掉与项目列表重复的「可见项目状态分布」、`director/cast` 与 `director/world` 去掉项目级「一致性抽检」（只留 `director/shots`）。另把 `models/config` 的「新增资源」按权限分流（管理员→`models/providers`，无管理权限员工才见新增）。允许重复只留三类：导航到同一目的地、页面本地导出、首页全局创建入口。
- **E2E 稳定性**：`_e2e.html` 里 5 处 `App.job` 等待由 3200ms 放宽到 5200ms。此前偶发 4 条误报（质量裁决 / 通知闭环），根因是作业动画与断言赛跑，不是功能回归；连跑两次均 **37/37**。
- **浏览器验收（R-28）**：`_smoke.html` 56 路由 + 9 条合并页 tab 断言 + 3 身份拦截 → **Smoke OK**；`_e2e.html` 断言 **28 → 37**（新增交付包 / 成本台账 / 分镜板三页的「切 tab 后内容正常 + `App.refresh()` 后仍停在该 tab」）→ **E2E OK**。
- **冒烟与回归**：`_smoke.html` 路由遍历自适应 `App.routes()`（当前 56），并新增 9 条合并页 tab 断言（点击 `data-value` 后断言非空、无 `undefined/NaN`）。切 tab 前会把身份重置为项目负责人（`i-owner`），`analytics/*` 用 `i-admin`——否则上一步角色遍历留下的无权限身份会让页面变 403，误判成"缺 tab 控件"。

> 施工纪律（事故后写入）：**不要用 PowerShell 对 `modules/*/pages.js` 批量 `.Replace`**。本版曾因 `$map` 被展平导致 4 个文件的全部双引号被替换成中文字符（director→`进`、post→`处`、projects→`打`、video→`去`），已按"两侧皆为非 ASCII 视为正文"的邻接规则逐字符恢复并有全量 `node --check` 与回归证据。改文案一律用编辑器逐处替换，或写 `.mjs` 用 Node 读写。



一批「同一实体两份实现」的重复页全部收敛为一个宿主页 + tab/视图，**没有删除任何业务能力**，只是把入口从 9 个页面变成 9 个 tab：

| 原路由 | 并入 | 形态 | 旧链接 |
| --- | --- | --- | --- |
| `workspace/projects`（我的项目） | `projects/list` | 「关系筛选」全部 / 我负责 / 我参与 / 待我审核 + 卡片「我的角色」 | 转发 |
| `quality/gates`（质量门禁） | `quality/reports` | 「门禁」tab（四级 × 十维矩阵、三态结论、阻断与豁免） | 转发 |
| `post/works`（作品库） | `post/delivery` | 「作品」tab（作品清单 / 状态口径 / 交付摘要 / 新版本链） | 转发 |
| `video/results`（生成结果） | `video/preview` | 「版本列表」tab（多版本并存、设为采用） | 转发 |
| `director/storyboard`（分镜板） | `director/shots` | 「分镜视图」（列表 / 分镜双视图，筛选不丢） | 转发 |
| `assets/usage`（引用关系） | `assets/library` | 「引用」tab（引用表、删除阻断、引用统计） | 转发 |
| `cost/usage`（用量与计量） | `cost/ledger` | 「用量」tab（计量差异、按能力用量、计费口径） | 转发 |
| `notify/incidents`（异常中心） | `compliance/risks` | 「处置」tab（异常台账、处置原则、高频处置口径） | 转发 |
| `analytics/departments` + `analytics/employees` | `analytics/enterprise` | 「部门对比」「员工对比」两个 tab；删除「对比入口」卡 | 转发 |

配套约定：

- 合并后统一 `X.tab` 动作族（`post/assets/cost/compliance/analytics/director.view/video.tab`），页面主体写成 `xxxBlock(p)` 纯函数，宿主页只做 `tabsBar + (tab === ... ? block : ...)`。
- 旧地址一律经 `app.js` 的 `LEGACY` 转发到新宿主页，不报 404；跨项目聚合视图统一交给工作台首页与项目列表，页内只按单一项目投影。
- 路由 65 → 56、动作注册 324、失效内链 0；`tools/_probe_tab.mjs` 逐 tab 渲染断言（避免出现「合并了但 tab 空白」）。
- `tools/_audit_links.mjs` 新增 LEGACY 断言（从 `app.js` 解析映射表，验证旧地址已下线、目标存在、宿主页渲染非空），10 条 100% 通过；同时补齐项目上下文桩，链接/动作覆盖由 242 提升到 1468。
- 未做、且刻意不做：M10–M13（`projects/detail`、`tasks/attempt`、`models/routing`、`orgs/member`）是**下钻层级**，不是重复实体，合并只会丢上下文。

### 9.6.4：作品库并入交付包（B2 · M2）

- 删除 `post/works` 路由与 `o-works` 菜单项：作品清单、作品状态口径、交付后可变更、交付摘要、新版本链规则、最近审核抽为 `worksBlock(p)`，成为 `post/delivery` 的**「作品」tab**（与「交付包」并列）。
- 作品视图不再提供「可见项目聚合」：跨项目交付概览由工作台首页「最近交付作品」承担；`post/delivery` 只按单一项目投影，「新建 V2」「版本链」「详情」仍在作品 tab 内完成。
- 删除自指的「作品视图」按钮与 `post.toWorks` 动作；新增 `post.tab`；`LEGACY` 追加 `#/post/works → post/delivery`；交付完成通知链接改指 `post/delivery`。
- 合并后 63 路由 / 318 动作；`_probe_tab` 实测作品 tab 3703 字符 · 7 卡 · 0 指标，交付包 tab 5095 字符不变。

### 9.6.3：质量门禁并入质量报告（B2 · M7）

- 删除 `quality/gates` 路由与 `q-gates` 菜单项：「四级检测范围 / 十维矩阵 / 三态结论 / 阻断与豁免」抽为 `gatesBlock(p)`，成为 `quality/reports` 的**「门禁」tab**（与「报告」「返工台账」并列）。
- 门禁页头的「质量门禁」自指按钮删除；`quality.toGates` 动作删除，全站无残留引用；`LEGACY` 追加 `#/quality/gates → quality/reports`，旧链接不 404。
- 合并后 64 路由 / 318 动作；`tools/_probe_tab.mjs` 新增（按 tab 渲染探针，用于验证并入的 tab 真的出内容：门禁 tab 10043 字符 · 12 卡 · 16 指标，无 undefined/NaN）。

### 9.6.2：项目清单唯一化（B2 · M1）

- 删除 `workspace/projects`（我的项目）路由与 `w-projects` 菜单项：项目清单全站只剩 `projects/list` 一处。
- 原「我负责 / 我参与 / 待我审核」三 tab 变为 `projects/list` 的关系筛选（`projects.setRel`），卡片新增「我的角色」标记；关系判定与负责人列同源，管理员看到空关系是正确结果。
- 首页入口卡里的「创作项目」改为「项目列表」并指向 `projects/list`；「新建项目 / 全部项目」两个同义动作合并为 `projects.new` / `projects.listLink`，删除 `workspace.newProject`、`workspace.toProjects`、`workspace.tab`。
- `app.js` 新增 `LEGACY` 路由转发：`#/workspace/projects` 落到 `projects/list`，老链接不报 404。
- 回归：65 路由全渲染、319 动作 0 未注册、失效内链 0、`_audit_perms` 0 missing、口径回归 112 项通过。

### 9.6.1：口径收口（B1）

- 预算收敛为**单一账本**：`DB.budgets` 项目记录是唯一金额源，`store.js` 内新增 `ensureProjectBudget()`（缺失补建、存在则回写项目字段），修复 `SP-26015 / SP-26007` 与账本不一致、4 个项目无账本的漂移；`p.actual / p.budget` 降级为账本投影。
- 预算状态判定收敛为 `budgetStateFor(used, total, frozen)` 一处，85% 阈值移入 `DB.pricing.budgetWarnRate`，删除三处重复判断。
- `DB.derived` 新增五个单一口：`budgetOfProject / progressOf / taskStats / deliveryStats / duties`；`home()` 改为 `scope: "mine"`、成本预算来自单项目账本之和，并删除从未渲染的 `decisions`。
- 工作台首页统一口径：hero 预算百分比改用账本、`可见项目成本`更正为`我负责项目成本（合计）`、待办卡 / 指标 / 明细表全部取自 `duties()`（此前三处各算一遍）。
- 删除两处系数造假：字幕单价、抽检比例与每镜均价移入 `DB.pricing`；分镜抽检样本改为读取常量并在报告里注明比例与下限。
- `common.export` 文件名改为「页面标题 + 项目编号 + 日期」派生，20 个"导出 X"入口不再共用 `prototype-export.csv`。
- 新增 `tools/_audit_kpi.mjs`（106 项口径断言）与 `tools/_audit_ia2.mjs` / `_audit_ia3.mjs`（命名与按钮落点盘点），纳入交付前回归。

### 9.5.0：全链路 1:1 落地、菜单跳转收口与体验优化

- 新增 `UI.projectGuard`，26 个项目域页面在无项目 / 项目不可见时统一阻断并回项目列表；清除 `creation/brief|plan`、`audio` 4 页、`post` 5 页共 11 处空项目回退。
- 顶栏项目区新增「切换 / 流水线」：切换抽屉按可见项目列出并保持当前菜单路径，只替换 `id`；流水线链接一步回到当前项目制作流水线。
- 流水线项目解析与全部 `wf*` 动作加 `wfNeed` 空上下文守卫；`projects.pause`、创意域生成 / 审核 / 编辑 / 拆解 / 派生动作去掉跨项目兜底，执行前校验项目与对象归属。
- 新建项目正式创建后直接进 `projects/workflow`，草稿仍进 `projects/detail`；剧本审核通过后回流水线，不再停在详情页。
- 首页 8 阶段生产链路由静态展示改为可点击入口，带项目 id 进入剧本、拆解、计划、视频、字幕、质检、终审、交付页面。
- 剧本工作台默认集改为当前项目首个未通过集；正文样本由 `studioSample` 标记控制，去掉 `SP-26031` 硬编码；无剧本时按阶段给「去选方案 / 生成候选剧本 / 回流水线」入口。导演规划未到阶段时同步给回剧本或回方案的主动作。
- 剧本版本比对改为读取同项目上一版本，按场 / 镜 / 行实际差值展示；`post.newVersion` 增加来源项目可见性校验。
- 创意设定输入方式按 `briefMode:<pid>` 隔离；声音档案补 `project` 字段并按项目过滤；预算调整去掉缺省项目；首页当前项目优先取当前上下文；持久化加载只补静态字段，不覆盖业务现场。
- `creation/brief` 版本记录移入左栏，消除左侧大块空白；左右栏高度收口。
- 版本串同步为 `?v=9.5.0`，品牌副标题、`_smoke` / `_e2e` 同步；持久化键继续 `shortplay.workbench.v937`。
- 验证：17 模块 / 65 路由回归通过，owner 49 / 65；309 注册动作 / 0 未注册 / 0 重复；34 权限定义 / 22 守卫码；65 路由 / 492 动作引用 / 0 失效内链；26 / 26 项目页阻断；`flow` 18 / 18；`_journey` 22 / 22 归档；`_smoke` 65 路由无 JS 错误；`_e2e` 28 / 28 PASS。
- 详细调整点、菜单逐组校验、22 步验收与开发对接说明见 `docs/AUDIT-V9.5.0.md`；截图 `docs/workflow-950.png`、`docs/brief-950.png`、`docs/script-950.png`。

### 9.4.0：项目上下文全链路收口与创意设定版本化

- `App.currentProject(query)` 从「按 id 找项目」升级为**先校验可见性**：带 `?id=SP-*` 的页面与动作只能解析当前身份可见项目；不可见、不存在或历史遗留 id 均返回空，不再进入页面后被外壳或数据层二次兜底。
- 清理 43 处 `App.get("projects","wfCurrent","SP-26031")` 与空键回退：`audio / compliance / creation / assets / director / post / projects / quality / video / workspace` 的页面动作统一改走 `App.currentProject()`；无可进入项目时返回空值并走既有阻断/提示，不再操作不可见项目。
- `director` 5 页、`video` 3 页、`creation/breakdown`、`creation/script`、`creation/review` 与 `post` 动作层全部改为严格项目上下文；`video/preview` 的镜头跨项目访问直接阻断，不回退全局首镜头。
- 创意设定真正版本化：`Store.ops.submitBrief` 与「派生新版本」改为**追加新记录并保留旧版**，旧版标记「已被替代」，不再原地覆盖 `CB-*`；新版本继承来源与操作者，项目状态、下游镜头「需复核」与审计记录同步更新。
- 创意设定提交前置校验项目状态：仅「草稿 / 创意策划中」允许提交，锁定项目返回明确原因，不产生半写入；新建设定弹窗的项目池只列当前身份可见项目。
- 统一可见文案：项目流水线面包屑归入「项目中心」，`post` 下时间线、分集成片、版本链统一归入「后期与剪辑」，不再出现菜单名与页眉章节名不一致；流水线 8 个阶段节点由静态展示改为可点击入口，按当前项目跳转到对应阶段页面。
- 版本串同步为 `?v=9.4.0`，品牌副标题同步；持久化键继续使用 `shortplay.workbench.v937`，不重置已有业务现场。
- 验证：`node tools/regress.mjs` 17 模块 / 65 路由通过，owner 49 / 65；`node tools/flow.mjs` 18 / 18；动作审计 306 注册 / 0 未注册；权限审计 34 定义 / 22 守卫码 / missing none；`_smoke` 65 路由无 JS 错误；`_e2e` 28 项 PASS。

### 9.3.9：逐菜单业务逻辑审查与数据真实性收口

- 按真实短剧生产顺序逐菜单审查入口、页面跳转、项目上下文与动作归属。owner 身份当前为 **16 个可见分组、47 条可见链接**；`projects/new`、`projects/detail`、`orgs/member` 仍为上下文页，不进一级菜单。
- **单人主线的资源配置缺口**：owner 原先没有 `models.own`，视频生产「去资源配置」无法落到可操作页面。现已授予 owner 个人资源配置权限，侧栏新增「模型与资源 / 资源配置」，页内只展示本人名下资源；路由策略仍只对企业管理员开放，避免越权按钮。
- `models/config` 改为按当前身份 `userId` 计算名下资源，拆分个人自持、企业分配、额度占用与异常资源；`models/providers`、`models/routing` 的数量同样由真实数组派生，不再写死「7 家 / 6 个 / 2 项兼容不满足」。
- `ops/overview` 的任务、镜头时长、已确认/待核实成本、服务健康全部由 `D.tasks / D.shots / D.costs / D.ops.services` 实算；存储环图由正式资产、临时素材、审计日志与备份余量派生；顶部「队列与存储」「平台配置」由 `common.noop` 改为真实跳转。
- `ops/queue` 的饱和提示与降级提示由队列并发占用、服务状态实时生成，不再写死「38%」；存储占比同样从 `D.ops.storage` 解析。
- `orgs/member` 无效 `?id=` 不再回落到第一名员工，改为明确「员工不存在」阻断页；`projects.wfProject` 兜底增加可见项目范围；`assets/library` 引用关系表头与空状态统一为「当前范围 / 可见项目」。
- `post/works` 无项目 id 时聚合当前可见项目：展示 4 个可见项目、已交付作品的集数与时长、交付包版本与最近审核记录；有 id 时才进入单项目视图，不可见 id 直接阻断。
- 版本串同步为 `?v=9.3.9`；65 条路由回归、306 条动作注册审计、34 个权限定义审计、18 项流程断言与浏览器 `_smoke` 全绿。

### 9.3.8：侧栏分组折叠导航

- 侧栏从「全部模块标题 + 全部链接平铺」改为**手风琴式分组导航**：每个业务域一个可点击组标题，标题右侧显示该组当前身份可见的路由数量；组内链接默认折叠。
- 进入任意页面时，只自动展开当前路由所属分组；点击其他分组标题会收起上一组并展开该组，同一时间最多展开一组。
- 折叠只更新 `is-open` 与 `aria-expanded`，不重建整个外壳，避免页面滚动位置与内容状态被重置；路由切换（`hashchange`）后重新自动定位到新页面所属分组。
- 导航仍由模块注册表与权限实时派生，不维护第二份手写菜单；无权限的分组与链接不会出现在侧栏。9.3.8 当时 owner 渲染 14 个可见分组、48 条可见链接；9.3.9 调整入口后为 16 组 / 47 链接。
- `common.navGroup` 为新增折叠动作，注册动作总数由 304 增至 305；纯 UI 变更，持久化键继续使用 `shortplay.workbench.v937`，不重置已有业务现场。
- 版本串同步为 `?v=9.3.8`；回归 65 条路由、动作审计、权限审计、`_smoke` 与 `_e2e` 全部通过。

### 9.3.7：创作域项目化与阶段锁定

- `creation/brief` 按 `?id=` / 当前项目读取创意设定、版本与台账；新项目不再固定显示 `SP-26031` 的 `CB-26031-03`。
- 创意设定进入「生产中 / 待审核 / 已交付」等阶段后锁定只读：隐藏新建与派生入口，动作层同样拦截；已交付项目只保留「查看方案」「新建 V2」与「导入小说另立项目」。
- `creation/plan` 按项目读取方案，对比表由真实方案动态生成列（核心卖点 / 主题 / 开场钩子 / 风险 / 自检分）；仅「创意策划中」可重新生成或重选方案。
- `creation/script` 去掉「只有 `SP-26031` 能看正文」的封锁：其他项目展示真实版本规模、提交人、说明与该项目的分集覆盖；只有 `SP-26031` 保留完整稿纸样本。
- `creation/review` 无 `?id=` 时按当前项目取待审剧本，不再跨项目借用；`creation/breakdown` 的完整性自检改为 `p.episodes`，12 集项目不再被 24 集预期误判。
- 新项目链路实测：草稿 → 创意设定确认 → 生成方案 → 选定方案 → 生成候选剧本 → 审核锁定 → 拆解 12 集 / 216 镜；集数与镜头由项目集数生成，而非固定 24 集 / 432 镜。
- 补种 `SP-26019`、`SP-26015` 的创意设定、方案与锁定剧本，已交付 / 异常项目的创作历史不再为空。
- 任务列表、队列、尝试记录与批量重试按 `Derived.visibleProjects()` 过滤；非成员项目任务不可见，暂停队列与批量重试不会动到不可见任务。
- `post/episodes` 无 `?id=` 时按当前项目；`post.newTimeline` 的兜底项目也改为当前项目。
- 持久化键升级为 `shortplay.workbench.v937`，首次加载使用 9.3.7 基线；版本串同步为 `?v=9.3.7`。

### 9.3.6：交付冻结与项目上下文收口

- 全局项目守卫：任何 `?id=SP-*` 先校验存在性与可见性；无权限项目不再用 `D.projects[0]` 兜底，统一显示「项目不存在 / 项目不在可见范围」。顶栏项目上下文只在项目可见时写入。
- 已交付/已归档项目进入只读：视频生产、镜头库、资产库、时间线输出、集级质检，以及创作、导演、音频、质量域的生产动作统一被拦截；返工必须先新建版本链。
- 作品库与版本链新增「新建 V2」：从已交付项目复制设定、集数与规模建立新项目草稿，重新走创意与剧本审核；V1 交付包与历史记录不变。
- 管理域移除同名旧演示动作，`models / notify / ops / orgs / workspace` 只保留一套真实实现；个人模型配置可「仅本人」测试，新建供应商为「待验证」。
- 工作台按项目解析：发起返工取当前项目未通过镜头，交付/成本跳转均带项目 id，集卡打开视频任务精确到集。
- 合规审计支持按项目过滤；资产上传、删除与版本登记按当前项目归属校验，交付项目资产只读。
- `post/timeline`、`post/works` 按当前项目投影；时间线与成片按钮携带项目与集次，作品库不再混入其他项目。

### 9.3.5：项目上下文与旧动作层收口

- 音频、资产、合规、质量、视频、成本、任务模块删除早期演示动作，同名动作只保留一套真实实现；页面引用与动作注册重新对齐。
- `compliance/rights`、`compliance/risks` 支持 `?id=` 按项目投影，台账、阻断、到期、类型分布由当前范围实时计算；项目负责人、部门管理员、审计角色新增 `compliance.read`，可只读查看本项目授权与风险。
- `post` 的集级质检、未过质检清单、引用检查、版本链改为按当前项目解析，不再固定 `SP-26031`；未引用的旧终审/交付动作已移除。
- `audio/bgm` 补齐 `audio.replaceAsset`：替换后登记新授权、标记时间线标脏，并要求重混与复检；`Store.ops.replaceRightsAsset` 不再写死《第七码头》素材。
- 资产登记、风险登记、授权登记、返工建立都按当前项目校验归属，跨项目报告、素材或对象会被拦截。

## 界面语言与小说改编

- **全中文标注**：页面标题、页眉、按钮、表头、说明、抽屉、Toast 与通知全部中文；页眉格式「业务域 / 子页」。创意 brief 统一称「创意设定」，Attempt 称「尝试」，PASS / FAIL / REVIEW_REQUIRED 显示为「通过 / 未通过 / 需人工判断」；供应商与模型用中文代号。内部路由与字段标识保持英文，只在展示层做映射。
- **小说导入改编**：`创意设定` 页提供「导入小说改编」入口。填写小说名、作者、忠实度、题材、受众、风格、集数、时长、预算、部门与原文并确认授权后，系统建项目、确认创意设定（小说改编）、生成 24 集候选改编稿、创建改编任务并记文本成本，项目进入「待剧本审核」。原文少于 300 字、未确认授权、预算超可用余额都会被拦截。

## 启动方式（必须走 HTTP）

```
cd prototype\v9
.\start.ps1
```

或手动：

```
cd prototype\v9
node serve.js
```

浏览器打开 `http://localhost:4190/`。

- 直接双击 `index.html`（`file://`）**不可用**：静态站点依赖同源脚本加载，`file://` 会被浏览器策略拦截。
- 端口默认 `4190`，被占用时用 `$env:PORT=4191; node serve.js` 改端口。
- macOS / Linux 使用 `./start.sh`。

## 技术边界

- 原生 HTML/CSS/JS（ES2019），零第三方运行时依赖；图表与图标均为内联 SVG。
- Hash 路由单页（`#/域/页面`），参数走查询串。
- 业务状态写入浏览器 `localStorage`（键 `shortplay.workbench.v937`）：刷新后继续上次现场；顶栏「恢复初始数据」清库并回到初始示例。仍不连接任何真实模型、存储、任务调度或账单系统。
- 业务写操作统一走 `DB.ops`：状态机校验 → 数据变更 → 副作用（审计 / 通知 / 成本 / 资产 / 返工台账）→ 落库，返回 `{ok, msg, data, fields}`。
- 全局只暴露 `DB` / `UI` / `App` 三个核心对象（规范 §三、§四）：业务状态层并入数据层命名空间为 `DB.ops`，派生计算层为 `DB.derived`；两者不再反向调用应用层，运行时身份与角色由 `App.start()` 通过 `bind()` 注入。

## 目录结构

```
v9/
├─ index.html              入口（加载顺序：data → store → derived → ui → menu → app → modules）
├─ serve.js                零依赖静态服务
├─ start.ps1 / start.sh    启动脚本
├─ assets/
│  ├─ css/base.css         令牌、外壳、栅格、断点
│  ├─ css/components.css   卡片、表格、表单、抽屉、作业遮罩等组件
│  └─ js/
│     ├─ data.js           数据层：业务字典、15 状态、权限码、供应商供给模式
│     ├─ store.js          业务状态层（DB.ops）：状态机、门禁、成本、审计、通知
│     ├─ derived.js        派生数据层（DB.derived）：可见范围、跨页指标、项目事实汇总（唯一计算口）
│     ├─ ui.js             组件层：纯函数渲染
│     ├─ menu.js           菜单栏布局组件：左侧一级 / 折叠二级 / 顶部横向子菜单，独立状态管理与事件通知
│     └─ app.js            应用层：路由、权限、弹窗、异步作业、反馈
├─ modules/<域>/pages.js   模块层：路由 + 动作（文件末尾为 v9.1 真实流程层）
├─ docs/INTERACTION-SPEC.md 交互规格（操作路径、校验、边界）
├─ docs/TRACEABILITY.md    页面 ↔ 业务方案对应关系
├─ docs/DESIGN-REVIEW-V9.1.md 产品经理视角评审与整改口径
├─ docs/AUDIT-V9.6.0.md  本轮对齐业务方案 V3.0 与通用静态原型开发规范的逐项记录
├─ _smoke.html             浏览器巡检页（56 路由 + 角色权限）
├─ _e2e.html               浏览器真实点击链路（28 条断言）
└─ tools/                  回归与业务流断言脚本
```

依赖方向单向：`data.js → store.js(DB.ops) → derived.js(DB.derived) → ui.js → menu.js → app.js → modules/*`；模块不得直接改字典，也不得自己用系数或对象 ID 编造指标。`store.js` / `derived.js` 不引用 `App`，运行时上下文由 `App.start()` 注入。

## 菜单栏布局组件（assets/js/menu.js）

侧栏采用三段式结构：一级菜单垂直固定在左侧，二级菜单折叠式展开，三级（子）菜单在内容区导航栏（顶栏）下方以横向按钮组呈现。

| 结构 | 呈现 | 说明 |
| --- | --- | --- |
| 一级菜单 | 左侧垂直列表 | 宽度由 `--sidebar-w` 令牌控制，可通过 `Menu.init({width})` 覆盖 |
| 二级菜单 | 左侧折叠列表 | 同一时刻只展开当前激活一级菜单下的二级列表，其余保持收起 |
| 三级子菜单 | 内容区导航栏下方的横向按钮组 | 位于顶栏（面包屑 / 身份切换）正下方并随其吸顶，超宽时横向滚动；激活态含背景色、文字色与边框三重区分 |

双向联动：切换一级菜单 → 顶部按钮组同步更新并重置为该二级菜单的默认子菜单；切换子菜单 → 全局菜单状态同步更新；路由变化 → 菜单状态反向同步。

吸顶层级：顶栏 `position:sticky;top:0`（z-index 22）→ 子菜单条 `position:sticky;top:var(--topbar-h)`（z-index 20），两者依次吸顶且互不压盖；≤900px 窄屏下子菜单条改为 `position:static` 随内容滚动。

```js
Menu.init({ tree: DB.menu, can: App.can, iconOf: UI.ico, onSelect: go });
Menu.getState();                   // { l1, l2, l3, path }，只读副本
Menu.setActive({ l1, l2, l3 });     // 手动切换（支持部分字段，其余按默认值补齐）
Menu.selectPath(path);             // 路由 → 菜单反向同步
Menu.on('change', (state, reason) => {});   // 统一事件通知
```

- 状态管理独立于渲染：激活的一级 / 二级 / 子菜单 ID 全局统一记录，变更即派发 `menu:change` 事件与 `change` 回调，不存在状态不同步。
- 键盘操作：一级菜单 ↑↓ 切换、Enter 展开；二级菜单 ↑↓ 切换、Enter 选中、← 返回一级；顶部按钮组 ←→ 切换、Enter 激活；Home / End 跳到首尾。
- 无障碍：`role="menubar" / menu / menuitem / toolbar`、`aria-expanded`、`aria-controls`、`aria-current="page"`、roving tabindex 焦点管理，以及 `aria-live` 状态播报区。
- 动效时长全部控制在 200ms 以内（过渡 .14s–.18s），并尊重 `prefers-reduced-motion`。
- 菜单数据 `DB.menu` 与路由注册表的一致性由 `tools/regress.mjs` 交叉校验：每条路由必须且只能出现一次，权限码必须一致，避免两处口径漂移。
- 菜单层级：短剧制作整体流程收在「短剧制作」一个一级菜单下，其二级菜单即生产流程节点（立项与项目 → 创意与剧本 → 导演与视觉 → 视频生产 → 音频与字幕 → 后期与交付 → 质量与返工），三级为各节点下的具体操作。

## 路由清单（17 域 / 56 条）

> B2 归并进行中（已并入 3 条）：`workspace/projects`（我的项目）→ `projects/list` 的「关系筛选」；`quality/gates`（质量门禁）→ `quality/reports` 的「门禁」tab；`post/works`（作品库）→ `post/delivery` 的「作品」tab。三者都用 `app.js` 的 `LEGACY` 转发保活旧链接。其余合并见 `docs/PLAN-IA-REMEDIATION-V9.7.0.md`。

| 域 | 路由 |
| --- | --- |
| ops 平台管理 | `ops/overview` `ops/capabilities` `ops/queue` `ops/logs` `ops/config` |
| orgs 企业与组织 | `orgs/enterprise` `orgs/departments` `orgs/members` `orgs/member` `orgs/roles` `orgs/grants` `orgs/handover` |
| projects 项目 | `projects/list` `projects/workflow` `projects/new` `projects/detail` `projects/lifecycle` |
| workspace 工作台 | `workspace/home` `workspace/assistant` |
| notify 通知 | `notify/inbox` |
| creation 创意与剧本 | `creation/brief` `creation/plan` `creation/script` `creation/review` `creation/breakdown` |
| director 导演规划 | `director/plan` `director/cast` `director/world` `director/shots`（含「分镜视图」） |
| video 视频生产 | `video/production` `video/preview`（含「版本列表」） |
| audio 音频与字幕 | `audio/dialogue` `audio/voice` `audio/bgm` `audio/subtitle` |
| post 后期与交付 | `post/timeline` `post/episodes` `post/review` `post/delivery`（含「作品」tab） `post/versions` |
| quality 质量与返工 | `quality/reports`（含「门禁」tab） `quality/rework` |
| tasks 任务队列 | `tasks/list` `tasks/queue` `tasks/attempt` |
| models 模型资源 | `models/config` `models/providers` `models/routing` |
| assets 资产 | `assets/library`（含「引用」tab） |
| cost 成本预算 | `cost/ledger`（含「用量」tab） `cost/budget` |
| analytics 经营分析 | `analytics/enterprise`（tab：企业整体 / 部门对比 / 员工对比） `analytics/me` |
| compliance 合规审计 | `compliance/rights` `compliance/risks`（含「处置」tab） `compliance/audit` |

## 六个身份与可见范围

顶栏下拉可切换身份，切换后侧栏与按钮权限立即变化，内存态清空。**该下拉属于评审模式**：产品主线是负责人单人作业，身份切换只用于让评审者验证不同角色的权限与数据范围是否自洽。

| 身份 | 角色 | 可见路由 | 说明 |
| --- | --- | --- | --- |
| 周砚 | 系统运维管理员 | 5 | 仅平台总览 / 能力 / 队列 / 系统日志 / 平台参数 |
| 沈牧 | 企业管理员 | 33 | 企业、组织、授权、项目治理、成本与审计；**无创作权限** |
| 韩清 | 部门管理员 | 24 | 本部门项目、成员、成本、分析、通知 |
| 林知远 | 项目负责人 | 49 | 全流程业务 + 剧本/成片审核 + 交付 |
| 赵一宁 / 陈可心 | 普通员工 | 41 | 创作、生产、后期、任务、资产；**无审核与交付权限** |
| 许衡 | 审计与经营管理 | 24 | 只读汇总、审计、报告、成本导出与数据导出 |

权限三层：身份 → 数据范围 → 路由（越界整页 403）→ 按钮（无权限不渲染）；动作层 `App.guard` 兜底，绕过界面也会被拒绝。平台级身份（系统运维管理员）对平台域权限码自动放行，业务域仍按角色授予范围判定，不默认读取业务内容（业务方案 §4.6.1）。

### 数据范围（v9.1 起为强制层）

- 企业管理员 / 审计：企业全量（审计只读）。
- 部门管理员：本部门项目、本部门成员、本部门预算与成本。
- 项目负责人 / 普通员工：本人负责或被授权的项目，成员、成本、预算、风险、质量都随项目范围收窄。
- 系统运维：无业务数据权限（返回空态而不是报错）。
- 页面顶部的「可见范围」标注、页脚范围说明、成员/成本页的计数都由 `Derived` 计算，不再有“全量列表 + 固定示例值”。

### 派生数据（唯一计算口）

`assets/js/derived.js`（导出为 `DB.derived`）提供 `visibleProjects / canViewProject / visibleMembers / visibleCosts / visibleBudgets / scopeLabel / projectsOf / myProjects / budgetOfProject / progressOf / taskStats / deliveryStats / duties / home / qualityOf / reviewsOf / deliveriesOf / risksOf / projectSummary / workflow`。规则：

- 页面不得再用 `Math.round(p.done * 0.75)` 这类系数、`p.id === "SP-260xx"` 这类对象 ID 分支生成事实。
- 「我的项目」= 本人负责或被授权，不等于「可见项目」；管理员可见全量但个人视图为空是正确结果。
- 跨页同一指标必须来自同一个函数，避免首页、列表、详情三处口径打架。

#### 五个强制单一口（v9.6.1 起，`tools/_audit_kpi.mjs` 守护）

| 指标 | 唯一入口 | 禁止的做法 |
| --- | --- | --- |
| 预算金额与百分比 | `budgetOfProject(p)`（读 `DB.budgets` 项目账本） | 直接算 `p.actual / p.budget`；再写第二份 85% 阈值 |
| 集进度 | `progressOf(p)`（以项目台账 `done / episodes` 为准） | 用抽样分集条数当分母或通过数 |
| 任务数 | `taskStats(me)`（排队 + 执行 + 待人工 + 失败四类） | 页面各自 `D.tasks.filter(...).length` |
| 待我处理 | `duties(me)`（通知表唯一事实源，owner 兼容两种写法） | 首页待办卡、指标卡、明细表各过滤一遍 |
| 首页与多项目汇总 | `home(me)`（`scope: "mine"`，成本与预算来自单项目账本之和） | 把「我负责」的合计标成「可见范围」 |

单价、抽检比例、预警阈值集中在 `DB.pricing`（`subtitlePerLine / voicePerSecond / videoPerShot / qcSampleRate / qcMinSample / qcItemsPerShot / budgetWarnRate`），页面不得写魔法数字。预算状态判定只允许走 `DB.state` 内的 `budgetStateFor(used, total, frozen)`。

## 单一立项入口（v9.1 起）

`projects/new` 页表单是立项的唯一入口：页面字段即提交数据，`App.collect` 读取、`App.validateFields` 校验（必填/集数范围/金额格式），`DB.ops.createProject` 负责名称唯一、集数 4–60、部门与企业预算余额校验；失败保留输入并把错误回填到对应字段，成功进入新建项目的详情页。旧的「页表单 + 弹窗二次填写」双轨已删除，`projects.create` 与 `projects.saveDraft` 各只有一个注册实现。

## 动作三态（v9.1 起）

按钮按「权限 + 对象状态 + 前置条件」渲染：不满足的动作不显示，而不是点了再报错。例如项目详情页：

- 已交付 / 已归档项目不显示「暂停项目」与「进入交付」。
- 「移交」只在具备 `grant.manage` 时显示；项目负责人看到的是「按授权只读」。
- 成本明细跳转成本台账并带入项目筛选；越界项目返回明确提示，不渲染他人成本。

## 真实流程覆盖（不再有“演示式”动作）

- **项目流水线（v9.3）**：`projects/workflow` 把锁定剧本 → 拆解 → 资产确认 → 计划固化 → 连续生产 → 字幕合成 → 整集质检 → 终审 → 交付 → 归档串成一条链。8 段阶段、当前动作、门禁清单、24 集生产板、最近执行与质检全部由 `DB.derived.workflow` 从项目事实计算，不写死进度。
- **连续生产**：按集逐镜执行「提交 → 执行 → 下载落库 → 逐镜质检」，复用排队任务；单镜失败、预算不足、待人工镜头都会在集边界停止并给出阻断原因，不伪造 PASS。
- **后期与质检拆分**：`finishPost` 只做字幕、混音、时间线，逐集检查镜头全 PASS、字幕通过、无标脏才进入质量检测；`qcAll` 再逐集跑质检并把集标记为 PASS；交付门禁独立校验全部镜头、时间线、24 集、授权与预算。
- **授权阻断处理**：交付前若存在 `阻断交付` 素材，当前动作变为「先解除交付阻断」，可替换为平台已授权素材或补签授权，处理完自动重跑门禁。
- **创意**：brief 提交（来源校验、禁止词）→ 方案生成 → 勾选确认 → 剧本生成 → 审核通过/驳回 → 锁定 → 局部改写 → 重新拆解。
- **导演**：门禁清单 → 固化方案 → 资产确认（参考图数量校验）→ 镜头提交/批量提交（逐条拦截原因）→ 重生成 → 版本升版 → 抽检。
- **视频**：执行任务（依赖/模型/状态前置）→ 镜头质检 → 失败五分支持 → 批量批次（逐镜头）→ 队列暂停/恢复 → 采用候选。
- **音频**：对白重生成 → ASR 回听 → 口型标脏 → 音色授权续期/替换 → BGM 授权阻断 → 字幕版本与口型对齐。
- **后期**：时间线输出三重前置 → 集级质检 → 终审门禁与清单 → 返工定位（`E17 / S02 / SH-05`）→ 整剧/分批交付 → 校验和比对 → 冻结 → 归档。
- **质量**：报告详情 → 接受（理由必填）/返工/驳回 → 合规类禁止自动重跑 → 返工台账。
- **任务**：执行、批量重试、人工决策三分支、取消、队列暂停、并发设置。
- **治理**：项目生命周期（暂停/恢复/批量/终止）、员工停用与离职移交、项目移交、授权授予/撤销、平台参数变更、恢复演练、扩容申请。
- **通知**：处理抽屉 → 关闭（结论必填）/转待办/升级异常 → 异常台账。
- **指令助手**：解析 → 按意图真实分发（15 类目标，覆盖业务方案 §20.4 的十类示例指令）→ 权限按真实权限码判定 → 目标不唯一时追问 → 六类高风险动作二次确认（预算超限 / 剧本重大变更 / 删除已确认资产 / 批量返工 / 项目终止 / 交付执行）。
- **剧本变更影响分析**（业务方案 §6.4）：八维度汇总 + 镜头级受影响清单，确认后仅把受影响镜头标记待复核，不自动重做。
- **任务四状态分离**（业务方案 §8.2）：供应商任务 / 文件下载 / 资产持久化 / 质量检测各自独立成列，任一环节失败停留在本环节。
- **终审四结论**（业务方案 §16.3）：通过交付 / 指定镜头片段返工 / 退回后期 / 终止交付，审核记录锁定被审版本。

## 交付前回归

```
cd prototype\v9
Get-ChildItem -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
node tools/regress.mjs
node tools/flow.mjs
node tools/_journey.mjs
node tools/_audit_actions.mjs
node tools/_audit_perms.mjs
node tools/_audit_kpi.mjs        # 口径单一口（预算/进度/任务/待办/首页汇总）
node tools/_audit_ia2.mjs        # 命名、卡片、指标、取数口、权限码的静态盘点
node tools/_audit_ia3.mjs        # 按钮文案 → 动作 → 落点路由
node tools/_audit_links.mjs      # 失效内链（含 LEGACY 旧地址转发）
node tools/_audit_dups.mjs       # 动作重复
node tools/_audit_naming.mjs     # 页眉/标题/章节唯一性，面包屑必须由 DB.menu 派生
node tools/_audit_buttons.mjs    # 按钮密度（同页同动作 ≤1、页面级动作 ≤6）与 ≥12KB 体量
node tools/_audit_rules.mjs      # 规则/口径卡分布：全站 ≤17 张且单页 ≤1（改规则卡后必跑）
node tools/_audit_density.mjs    # 页面密度：<1400 字符、或 卡≤1 无表且 <3000 字符 视为过薄（R-17 折叠后遗症复核）
node tools/_audit_labels.mjs     # 同一动作只允许 1 个文案（白名单 3 条各写明理由），R-19 门禁
node tools/_audit_overlap.mjs    # 重复功能复核：同名卡片 / 同名指标 / 真双入口写动作 / 页面相似度（可写 --write 存 _ia_overlap.txt）
node tools/_audit_layout.mjs     # 布局简洁度：列 ≥9、卡 ≥6、提示 ≥2、单卡 ≥40%、容器 ≥3 种（改表格/卡片后必跑，--write 存 _ia_layout.txt）
node tools/_audit_project_guard.mjs  # 项目页阻断
node tools/_probe_tab.mjs video/preview versions   # 单 tab 渲染探针（合并页必跑）
```

浏览器侧（4190 服务在线）：

- `http://localhost:4190/_smoke.html`：56 路由渲染 + 9 条合并页 tab 断言 + 3 个身份权限拦截 + 全局 JS 错误巡检。
- `http://localhost:4190/_e2e.html`：真实点击链路 37 条断言（新建项目校验与创建、前置依赖拦截、终审门禁、交付说明与分批交付、质量理由校验与裁决写回、通知闭环、项目暂停、预算低于已用、供应商连通性失败、合规类返工禁止重跑、重复邮箱占用、三页 tab 状态持久化）。

## 与《通用静态原型开发规范》的符合性说明

本轮按规范逐条复核并整改，要点如下：

| 规范条款 | 整改结果 |
| --- | --- |
| §三 全局只暴露 DB / UI / App 三个核心对象 | 状态层并入数据层命名空间 `DB.ops`、派生层为 `DB.derived`；`store.js` / `derived.js` 不再反向调用 `App` |
| §四 分层与职责边界、依赖方向单向 | `DB.ops`（状态机 + 副作用）、`DB.derived`（唯一计算口）、`UI`（纯渲染）、`App`（路由 / 权限 / 反馈）、`modules/*`（业务页面）单向依赖；运行时上下文由 `App.start()` 注入 |
| §五 路由与模块注册 | 17 域 / 56 条路由全部由 `AppModule.register` 登记，前缀与目录名一致；404 与 403 文案与返回入口分开，回归脚本增加边界断言 |
| §六 页面渲染规范 | 表格列定义与行数据分离；图表显式传序列 / 标签 / 配色并支持双轴；事件全部挂全局动作对象，无内联多层引号 |
| §七 Mock 数据规范 | 字典集中于 `data.js`；补齐供应商供给模式 `mode`、资产 `origin` / `creator` / `executor` / `storage` 字段，字段口径全项目一致 |
| §八 样式规范 | 令牌集中在 `base.css`，组件只引用变量；三档断点保持不变 |
| §九 角色与权限演示 | 身份层 / 路由层 / 按钮层三层判定；无权限按钮不渲染（不再置灰可点）；平台级身份自动放行平台域权限码 |
| §十 交互反馈规范 | Toast / 弹窗 / 二次确认 / 空态 / 加载 / 错误态统一；指令助手六类高风险动作二次确认 |
| §十一 版本与回归 | 资源版本号升至 `?v=9.6.0`；回归脚本覆盖路由一致性、渲染、占位文本与 404/403/空态边界 |

### 有意偏离项（唯一一处，需评审确认）

- **规范 §十三-10「不在原型内补本地存储持久化」**：本原型保留 `localStorage`（键 `shortplay.workbench.v937`），刷新后继续上次业务现场，顶栏「恢复初始数据」清库回初始态。偏离理由：静态原型需要可重复演示「创建 → 创意 → 剧本 → 审核 → 拆解 → 生产 → 后期 → 质检 → 终审 → 交付 → 归档」的全链路状态联动，纯内存态会在刷新后丢失现场，无法连续走查。该偏离仅影响演示态持久化，不改变任何业务规则、状态机与门禁逻辑。

## 与《项目业务方案（V3.0）》的符合性说明

本轮逐章复核的落地项与依据见 `docs/AUDIT-V9.6.0.md`（含每条调整对应的业务方案章节号与规范条款号）。核心补齐：

- 剧本审核三结论（通过 / 退回修改 / 终止项目）与退回位置定位（§6.3）；剧本变更影响分析八维度 + 镜头级清单（§6.4）。
- 视频生产四状态分离、失败类型分类与差异化重试策略（§8.2 / §12.5）。
- 任务十一种状态、生产衔接门禁四条逐条可见（§12.2 / §12.7）。
- 门禁结论 PASS / 需人工判断 / 未通过；高危与合规项禁止人工接受现状；存在返工项时报告保持未通过（§11.3 / §11.5）。
- 终审四结论与被审版本锁定（§16.3 / §16.4）。
- 集数完整性核对（计划 / 已生产 / 已通过 / 已交付 + 缺集 / 重复集 / 错序拦截）（§10.5）。
- 预算五态（未设置 / 正常 / 接近阈值 / 已超限 / 已冻结），冻结时禁止派发新任务、已发生费用仍入账；费用调整保留原值、调整人、原因与凭据（§15.3 / §15.5）。
- 资产详情全字段、版本历史与使用位置、真实引用反向检索、逻辑删除与归档分离（§14.2 / §14.3 / §14.4 / §14.5）。
- 项目移交八步（含移交预览、暂停未完成任务、不得使用原负责人个人配置、接手人重做预算与资源预检、保留历史负责人）与离职移交变更负责人（§5.7 / §4.8）。
- 个人资源配置七步与凭据生命周期（更新 / 启用停用 / 删除）、未配置可用能力与他人凭据的明确报错（§13.5 / §13.7）。
- 工作台九模块入口、十项信息展示与指令式助手十类示例指令全覆盖（§20.2 / §20.3 / §20.4）。
- 企业经营五组指标与员工十二项指标，未取得可靠数据的一律显示「待补充」（§19.3 / §19.4 / §19.7）。
- 平台系统日志、适配器登记、审计检索维度与导出留痕（§16.8 / §21.2 / §21.3）。

## 原型边界（重要）

- 不做真实鉴权、不落库、不调模型、不产生真实账单；业务规则与状态机是真实的，数据是虚构的。
- 视频/音频/字幕文件不随包提供，预览以占位与参数呈现，页面标注为静态展示态。
- 刷新继续当前现场（localStorage）；「恢复初始数据」清空并回到示例初始态；身份可随时切换，用于评审不同角色的可见差异。
- 页面 ↔ 业务方案对应关系见 `docs/TRACEABILITY.md`，交互细则见 `docs/INTERACTION-SPEC.md`。
