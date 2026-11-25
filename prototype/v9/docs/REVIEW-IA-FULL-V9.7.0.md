# 全站信息架构深度核查与整体调整方案

- 核查对象：`prototype/v9`（v9.6.0，66 条路由 / 17 个模块 / 6 个一级菜单 / 17 个二级菜单）
- 核查范围：全部 66 条路由、菜单树、模块注册表、派生层、动作层、权限表、壳层渲染
- 核查方法：`tools/_audit_ia2.mjs`（路由 × 菜单 × 页眉 × 卡片 × 指标 × 取数函数 × 权限码）、`tools/_audit_ia3.mjs`（按钮文案 → 动作 → 落点路由）两脚本静态解析 + 人工复核 40 余页源码
- 结论：上一轮发现的"工作台首页 ↔ 项目列表"不是孤例，而是**四类系统性问题**在全站的表现。以下每个结论都可被两个脚本复现。

---

## 一、结论摘要

| 类别 | 全站量化 | 典型表现 |
| --- | --- | --- |
| 命名体系分裂 | 4 套名称并行；**7 个域存在两个不同域名**；24 条路由的页眉章节名与所在二级菜单不同；1 个域被拆成 2 个页眉章节 | 同一屏同时出现「创作工作台 / 工作台首页」「我的工作台 / 工作台首页」「工作台 / 今日制作台」 |
| 实体多页承载 | 12 个实体被 ≥3 个页面同时承载；1 个通用导出动作承接 20 个"导出 X"入口 | 项目 6 页、镜头 6 页、成本 12+ 页、质量 8 页、交付 6 页、异常 4 页 |
| 口径多套 | 5 组核心指标各有 2–3 个算法；预算存在**两套账本**；1 处派生值从未被渲染 | "可见项目成本"实为"我负责项目合计"；两处"预算已用 %"永远不等 |
| 动作与文案 | 42 组"同一动作多个文案"；13 例同页重复按钮；7 例文案与落点不符 | 「查看生成结果」落到"视频生产队列"；同页 3 个按钮都叫"尝试" |
| 页面骨架膨胀 | 47 张"规则 / 口径 / 原则 / 说明"卡片；8 页指标卡与明细卡 1:1 重复 | `ops/overview` 与 `ops/queue` 各自渲染同一张"任务队列"卡 |

一句话：**这不是"个别页面冗余"，是缺少三条全站约束——名称只有一个来源、指标只有一个取数口、每个实体只有一个归属页。**方案的核心就是补上这三条。

---

## 二、问题与证据

### 2.1 命名体系：四套名称，一个页面显示三次

同一页面同时存在三处层级标签，且用词不同：

| 位置 | 实现 | workspace/home 实际显示 | projects/delivery 实际显示 |
| --- | --- | --- | --- |
| 顶栏面包屑 | `app.js:149,171`（模块注册 `label` + 路由 `title`） | 我的工作台 / 工作台首页 | 后期与剪辑 / 交付包 |
| 子菜单条 | `menu.js:189-191`（`DB.menu` 一级 + 二级） | 创作工作台 / 工作台 | 短剧制作 / 后期与交付 |
| 页眉章节 | `U.page()` 首参（各页手写） | 工作台 / 今日制作台 | 审核与交付 / 交付包 |

根源是**名称有两个权威源**：`AppModule.register({label})`（17 个模块名）与 `DB.menu`（6 个一级 + 17 个二级）。两者对同一位于有 7 处不一致：

| 域 | 模块 label（顶栏用） | 菜单二级（侧栏用） | 页眉章节（页内用） | 建议统一为 |
| --- | --- | --- | --- | --- |
| workspace | 我的工作台 | 工作台 | 工作台 / 今日制作台 | 我的工作台 / 工作台 |
| projects | 项目中心 | 立项与项目 | 项目中心 | 短剧制作 / 项目 |
| director | 导演规划 | 导演与视觉 | 导演规划 | 短剧制作 / 导演与视觉 |
| post | 后期与剪辑 | 后期与交付 | **后期与剪辑 + 审核与交付**（一域两章节） | 短剧制作 / 后期与交付 |
| models | 模型与资源 | 模型资源 | 模型与资源 | 资源与治理 / 模型资源 |
| tasks | 任务与队列 | 生产任务 | 任务与队列 | 资源与治理 / 生产任务 |
| assets | 资产库 | 数字资产 | 资产 | 资源与治理 / 数字资产 |

其余 10 个域（creation / video / audio / quality / cost / analytics / orgs / compliance / notify / ops）只有"子页简称与三级菜单名缩写不一"的轻量问题，例如 `ops/capabilities` 菜单叫「能力字典与适配器」、页眉写「能力字典」、标题写「能力字典与适配器」。

**影响**：用户无法把"我在哪"映射回菜单；评审者以为是三套导航；任何改名都要改 ≥3 处，这正是 9.4.0「统一页眉章节」只维持一个版本就再次漂移的原因。

### 2.2 实体归属：12 个实体被 3+ 页同时承载

| 实体 | 承载页面 | 重复点 | 应唯一的页 |
| --- | --- | --- | --- |
| 项目 | `workspace/home` `workspace/projects` `projects/list` `projects/workflow` `projects/detail` `projects/lifecycle` | 状态 / 进度 / 预算 / 下一步四处各算一遍 | `projects/list`（清单）+ `projects/workflow`（现场） |
| 剧本与版本 | `creation/brief`（版本记录）`creation/plan` `creation/script`（版本台账）`creation/review` `creation/breakdown` `post/versions` | "版本"在 4 页出现，`creation/brief` 与 `post/versions` 各有一张"版本记录"卡 | `creation/script` |
| 镜头 | `director/plan` `director/shots` `director/storyboard` `video/results` `video/preview` `post/versions` | 6 页都有镜头清单；`director/storyboard` 自带上「切换列表」按钮，说明与 `director/shots` 本是同一实体的两视图 | `director/shots` |
| 任务 | `tasks/list` `tasks/queue` `tasks/attempt` `video/production` `ops/queue` `ops/overview` `models/routing` | `video/production` 实质是第二个任务列表；`ops/overview` 与 `ops/queue` 重复渲染"任务队列" | `tasks/list` + `tasks/queue` |
| 成本与预算 | `cost/ledger` `cost/budget` `cost/usage` `workspace/home`（4 处）`projects/workflow` `projects/detail` `audio/dialogue` `audio/voice` `tasks/attempt` `video/production` `models/config` | 同一"预算已用"在 6 页各算一遍 | `cost/ledger` |
| 质量 | `quality/gates` `quality/reports` `quality/rework` `post/episodes` `post/review` `projects/workflow` `workspace/home` `video/preview` | "已通过"3 种口径 | `quality/reports` |
| 交付 | `post/delivery` `post/works` `post/versions` `post/episodes` `post/review` `workspace/home` | 交付包 / 作品 / 版本链三页讲同一交付物 | `post/delivery` |
| 授权 | `compliance/rights` `audio/voice` `audio/bgm` `audio/subtitle` `assets/library` `post/delivery` `compliance/audit` | 4 页有"授权台账"入口，2 个不同动作 | `compliance/rights` |
| 异常与风险 | `notify/incidents` `compliance/risks` `compliance/audit` `notify/inbox` `projects/lifecycle` `workspace/home` | 两页都是"未闭环 / 升级 / 处置"台账 | `compliance/risks` |
| 组织成员 | `orgs/members` `orgs/member` `orgs/roles` `orgs/grants` `orgs/handover` `analytics/employees` `analytics/me` | 成员产出在 3 页各算一遍 | `orgs/members` |
| 模型与资源 | `models/config` `models/providers` `models/routing` `video/production` `workspace/home` | "能力清单"在 `providers` 与 `routing` 各一份 | `models/config`（个人）/ `models/providers`（企业） |
| 数字资产 | `assets/library` `assets/usage` `audio/bgm` `compliance/rights` `director/cast` `director/world` | "素材台账 / 资产库 / 数字资产 / 素材中心"四种叫法 | `assets/library` |

### 2.3 口径多套（可直接当缺陷单）

| # | 指标 | 算法 A | 算法 B | 算法 C | 证据 |
| --- | --- | --- | --- | --- | --- |
| C1 | 项目预算 | 项目字段 `p.actual / p.budget` | 预算账本 `budgetOf(p.id).used / total` | 多项目汇总 `home().cost / budget` | `store.js:105-122` 双写两处；`derived.js:170-171` 用账本；`workspace/home:74,111` 两种并存 |
| C2 | 质量"已通过" | 报告数 `qualityOf().pass` | 集数 `eps.qc==="PASS"` | 项目字段 `p.quality`（静态文案） | `derived.js:95-104`；`post/episodes`；`projects/list:51` |
| C3 | 集进度 | `p.done` | `wf.passEps.length` | 已交付集 `deliveredEpisodes` | `workspace/projects:223` 用 `p.done`；其余用 `passEps` |
| C4 | 待办 / 待决策 | 通知按 owner 姓名匹配 | 通知按 5 类 type | `reviews + qualityReports`（**死代码，从未渲染**） | `workspace/pages.js:21,53`；`derived.js:121-122` |
| C5 | 任务数 | `openTasks`（排队+执行） | `D.tasks` 全量 | `D.ops.queue` 平台队列 | `derived.js:120,132-134`；`ops/overview:53` |
| C6 | 字幕成本 | `lines × 0.3 元` 无价目来源 | — | — | `audio/pages.js:545`（`Math.round(lines*0.3*10)/10`） |
| C7 | 分镜抽检量 | `shots × 0.2` 编造样本数 | — | — | `director/pages.js:500` |

C6/C7 直接违反 README「不得用系数或对象 ID 编造指标」的约定；C1 的双账本最危险：项目若无"项目"范围预算记录，`bgPct` 为 0 而 `p.actual` 非 0，同页两个百分比永远打不平。

### 2.4 动作与按钮：通用动作吞掉语义

| # | 问题 | 证据 | 后果 |
| --- | --- | --- | --- |
| A1 | 20 个"导出 X"共用一个 `common.export`，固定下载 `prototype-export.csv` | `app.js:482`；`cost/ledger`、`orgs/members`、`audit/logs`、`post/works` 等 20 页 | 导出的内容与按钮名无关，等于 20 个假入口 |
| A2 | 同一动作 `projects.listLink` 被 3 种文案使用（返回项目列表 / 返回项目库 / 返回列表），同时 5 个 director 页用另一个动作 `director.toProjects` 做同一件事 | `_audit_ia3` 输出 C 段 | 断图文案不一致，动作层多一套实现 |
| A3 | 42 组"同一动作多文案"：`projects.wfOpen` 6 种、`tasks.toAttempts` 4 种、`projects.detail` 4 种、`quality.judge` 3 种 | 同上 | 同一目标在不同页叫不同名字，用户学不会 |
| A4 | 13 例同页重复按钮：`assets/library` 同时有「引用检查」与「引用与使用关系」指向 `assets.toUsage`；`tasks/list` 三个按钮指向 `tasks.toAttempts`；`creation/plan` 三个「返回创意设定」、两个「查看剧本」；`orgs/member` 三个「返回名录」 | `assets/pages.js:46,48`；`tasks/pages.js:38,47` | 点击歧义 + 维护噪音 |
| A5 | 7 例文案与落点不符 | 「查看生成结果」→ `video/production`（生产队列）「剧本与分镜」→ `director/plan`；「查看角色权限」→ `projects/lifecycle`；「打开分镜板」→ `director/shots`；`post/delivery`「处理交付阻断」→ `compliance/rights` | 用户预期落空，是"内容乱"的直接来源 |

### 2.5 页面骨架膨胀

- **47 张**"规则 / 口径 / 原则 / 边界 / 说明"卡片（`_audit_ia2` 统计），平均每页近 1 张；其中 `四状态分离` 在 4 个文件重复、`失败类型/失败分类` 在 3 页重复、`升级规则` 在 3 页重复、85% 阈值文案在 3 处重复、`版本规则` 在 3 页重复。
- **8 页**存在"指标卡 + 同名明细卡"1:1 重复：`workspace/home`（4 对）、`workspace/projects`（3 对）、`compliance/rights`、`compliance/risks`、`cost/ledger`、`models/routing`（4 对）、`notify/inbox`、`quality/rework`。
- **2 页同页同名双卡**：`assets/usage` 有「删除阻断 · X」与「删除阻断」两张；`cost/usage` 有「计量差异 · X」与「计量差异」两张。
- **页级重复**：`ops/overview` 的「任务队列」「存储占用」与 `ops/queue` 的对应卡片同源（`ops/pages.js:47,53` vs `:94`）。

### 2.6 权限码语义错配

| 页面 | 现权限 | 内容 | 问题 |
| --- | --- | --- | --- |
| `workspace/home` | `analytics.own` | 生产控制台 + 待办 + 预算 | "个人产出统计"码守护首屏 → 管理员 / 部门 / 审计 / 运维 4 个身份看不到首页（`data.js:55-59` 均无该码） |
| `post/works` | `delivery.execute` | 只读浏览作品 | 审计、管理员、部门都看不到作品库；只读页用了执行码 |
| `tasks/*` | `[task.operate, audit.read]` | 写操作 + 只读 | 审计可进页，靠页面内 `App.can("task.operate")` 二次过滤（`tasks/pages.js:42`）——三态规范应在路由层就分只读视图 |
| `models/config` | `models.own` | 个人资源 | 管理员（有 `models.manage`）看不到该菜单项，菜单结构随身份变形 |
| `analytics/me` | `[analytics.own, analytics.read]` | 个人数据 | 与 `workspace/home` 用同一权限码表达不同语义 |

### 2.7 其他内容性问题

- `derived.home()` 返回的 `decisions` 从未被任何页面使用（死派生值）。
- "可见项目成本"标签下取的是 `myProjects()` 合计，非可见范围（标签与取数不符）。
- `projects/detail` 的阻断页页眉写成「项目中心 / 无权限」，把错误态当章节名（`projects/pages.js:229`）。
- `workspace/home` 的 feat 选取 `ctxProject → 生产中 → mine[0]` 隐式回退，会与顶栏项目上下文冲突。
- 空态与断图文案三套：`返回项目列表`（18 页）/`返回项目库`（5 页）/`返回列表`（1 页）。

---

## 三、整体调整方案

### 3.1 三条硬约束

1. **名称只有一个来源**：`DB.menu`。页面标题由路由 `title` 派生，章节由二级菜单派生，模块注册不再承担展示名称。
2. **指标只有一个取数口**：任何数字只允许来自 `DB.derived`，页面不得自拼 `D.xxx.filter` 再求和；一页之内同一指标只允许一个 scope。
3. **实体只有一个归属页**：清单类信息只在一个页面出现，其它页面只能"引用 + 跳转"，不得再复制一份列表。

### 3.2 目标 IA（6 一级 / 17 二级 / 56 三级）

| 一级 | 二级 | 三级（保留 / 合并后） |
| --- | --- | --- |
| 我的工作台 | 工作台 | 工作台首页（改名「今日工作台」）、指令式生产助手 |
| | 通知与异常 | 待办与通知 |
| 短剧制作 | 项目 | 项目列表（含我的项目关系筛选）、新建项目、制作流水线、项目详情(hidden)、生命周期 |
| | 创意与剧本 | 创意设定、创意方案、剧本版本、剧本审核、剧本拆解 |
| | 导演与视觉 | 镜头生产计划、人物视觉档案、场景与道具、镜头契约（含分镜视图） |
| | 视频生产 | 视频生产队列、预览与校验（含生成结果） |
| | 音频与字幕 | 对白配音、声音档案、配乐与音效、字幕与口型 |
| | 后期与交付 | 时间线与剪辑、分集成片、最终成片审核、交付包（含作品）、版本链 |
| | 质量与返工 | 质量报告（含门禁）、返工台账 |
| 资源与治理 | 模型资源 | 资源配置、供应商与模型、能力与路由 |
| | 生产任务 | 生产任务、资源池与队列、尝试与调用记录 |
| | 数字资产 | 资产库（含引用关系） |
| | 成本与预算 | 成本台账（含用量）、预算与阈值 |
| 经营分析 | 企业经营 | 企业整体数据（含部门/员工对比 tab）、我的数据 |
| 企业与合规 | 组织与权限 | 企业主体、部门、员工账号、员工档案(hidden)、角色与权限、项目成员授权、离职与移交 |
| | 合规与审计 | 权利与授权台账、风险与异常（含异常处置）、审计日志 |
| 平台运维 | 平台管理 | 平台总览、能力字典、队列与存储、系统日志、业务配置 |

### 3.3 路由合并台账（66 → 56，内容不丢，只去掉并列入口）

| # | 删除 / 降级路由 | 归入 | 迁移内容 | 类型 |
| --- | --- | --- | --- | --- |
| M1 | `workspace/projects` | `projects/list` | 三 tab（我负责 / 我参与 / 待我审核）变为筛选；卡内加"我的角色" | 必做（上一轮已定） |
| M2 | `post/works` | `post/delivery`「作品」tab | 作品清单、作品状态口径、新版本链规则 | 必做 |
| M3 | `video/results` | `video/preview`「版本列表」态 | 镜头版本清单、结果统计、设为采用 | 必做 |
| M4 | `director/storyboard` | `director/shots`「分镜视图」 | 画面语言检查、重生成入口（该页本已有"切换列表"） | 必做 |
| M5 | `assets/usage` | `assets/library`「引用」tab | 引用关系表、删除前检查、引用统计（合并同页重复两卡） | 必做 |
| M6 | `cost/usage` | `cost/ledger`「用量」tab | 用量明细、计量差异（合并同页重复两卡）、按能力用量 | 必做 |
| M7 | `quality/gates` | `quality/reports`「门禁」tab | 四级 × 十维矩阵、结论与放行、门禁链路 | 必做 |
| M8 | `notify/incidents` | `compliance/risks`「处置」tab | 处置 / 升级 / 记录结论动作、涉及项目 | 必做 |
| M9 | `analytics/departments`、`analytics/employees` | `analytics/enterprise` 两个 tab | 部门对比、人均产出、单位成本；员工十二项指标 | 必做 |
| M10 | `projects/detail` | `projects/workflow`「档案」tab | 项目档案、成员与授权、生命周期记录 | 可选 |
| M11 | `tasks/attempt` | `tasks/list` 行内抽屉 | 尝试记录、四状态分离、成本口径 | 可选 |
| M12 | `models/routing` | `models/providers`「路由」tab | 路由策略、兼容校验、能力清单 | 可选 |
| M13 | `orgs/member` | `orgs/members` 行内抽屉 | 基础信息、负责与参与项目、人员变动 | 可选 |

> 必做 9 项（M1–M9，其中 M9 一次删 2 条）→ 66 − 10 = **56 条**；可选 4 项全做则 **52 条**。
> 三态与权限守卫不变：合并后每个 tab 仍走原路由的 `projectScoped` / `App.currentProject` 校验。

### 3.4 命名机制（一次性消除 4 套名称）

1. `DB.menu` 成为唯一名称源；`AppModule.register` 的 `label` 不再用于展示（保留仅作内部 key 说明）。
2. `App.shell()` 面包屑改为**三级**：一级 / 二级 / 三级，全部来自 `Menu.getState()`，不再读 `route.title` 拼接（`app.js:149,171`）。
3. `UI.page()` 签名改为 `page(title, sub, actions, body, note)`：章节由壳层注入，模块不再手写章节名 → 删除 66 处手写章节串，24 条不一致与"一域两章节"自动消失。
4. 页眉只显示「二级名 · 页面 title」，顶栏只显示菜单路径，子菜单条保留按钮组但去掉重复的「一级 / 二级」文字 → 层级显示从 3 处收敛到 1 处。

### 3.5 页面模板（去膨胀）

每页最多四段：`页头（标题 + 1 句口径 + 主次动作）` → `≤4 个 KPI（可下钻）` → `1 个主明细（表或卡）` → `1 个侧栏（风险/阻断/下一步）`。

- 规则型内容（47 张口径卡）下沉：每域留 1 张「口径与规则」，其余改为页头"?"抽屉或 `docs/INTERACTION-SPEC.md` 对应章节。
- KPI 与同名明细卡二选一：保留 KPI（带下钻链接），删除重复明细卡。
- 同页同名双卡（`assets/usage`、`cost/usage`）合并为一张。

### 3.6 单一取数口（`derived.js` 扩展）

```js
scopeOf(me)            // 统一可见范围标签，替代 5 处 scopeLabel 拼写
projectsOf(scope)      // scope: "mine" | "visible" | "dept" | "all"，替代 myProjects/visibleProjects 双口
budgetOf(projectId)    // 单一预算账本（见 3.7），返回 {total, used, pct, state}
progressOf(p)          // 集进度：{passEps, total, pct}，替代 p.done / passEps / deliveredEpisodes 三套
qualityOf(p)           // 报告级质量；新增 qualitySummary(scope) 供 KPI 使用
taskStats(scope)       // {open, queued, running, waitingHuman, failed}
duties(me)             // 待我处理：通知 + 审核节点 + 质量待判断，唯一入口
deliveriesOf(scope)    // 交付：{packages, works, episodes}
```

硬规则写进 README：页面内出现 `D.projects.filter` / `D.tasks.filter` / `reduce((s,x)=>s+x.actual)` 的求和即视为缺陷。

### 3.7 预算单一账本

- 保留 `D.budgets` 作为唯一金额源（`total / used / reserve / state`），`projects.actual / budget` 改为**只读派生**（`budgetOf(p.id)` 投影），删除 `store.js:109` 对 `p.actual` 的独立双写，或反向：删除"项目"范围预算记录、以项目字段为唯一源。
- 阈值（85% / 超限 / 冻结）只允许出现在 `store.js` 一处，页面文案改为读取 `state` 枚举。
- 首页/清单/流水线/详情统一用 `budgetOf().pct`，标签按 scope 写清「我负责项目合计」或「当前项目」。

### 3.8 动作与按钮规范

1. **导航动作统一前缀**：`nav.*` 一组（`nav.projects`、`nav.wf`、`nav.quality`），一个目标只有一条动作；删除 `workspace.newProject`、`director.toProjects` 这类同义实现。
2. **按钮文案 = 落点页面 title**（或 title 的动宾化），7 例不符逐条改写；同页同一动作只允许出现一次。
3. **导出必须带对象**：`export.object(kind, scope, id)`，产出 `成本台账-项目-20261125.csv`；同一页不得出现两个同名导出。
4. **同页按钮 ≤6**：超出部分收进"更多"菜单，避免 `creation/brief`（11 个）、`creation/script`（16 个）、`video/preview`（11 个）这类按钮墙。

### 3.9 权限矩阵对齐

| 页面组 | 建议权限 | 只读身份处理 |
| --- | --- | --- |
| 工作台首页 | `project.read`（新增 `workspace.read` 授予全部业务角色） | 审计/管理员进入为只读视图：隐藏"新建项目""处理"等写按钮 |
| 作品库 / 交付包 | `delivery.read`（新增）+ 执行动作单挂 `delivery.execute` | 作品库对审计开放只读 |
| 任务三页 | 路由 `task.read`（新增），写动作挂 `task.operate` | 审计进只读视图，不再靠页内 `can()` 兜底 |
| 资源配置 | `models.own` 或 `models.manage`（any-of） | 管理员可见企业分配与额度 |
| 个人数据 | `analytics.own` | 与工作台解绑 |

---

## 四、分批实施

| 批次 | 内容 | 触及文件 | 回归 |
| --- | --- | --- | --- |
| B1 口径收口（0 路由变更） | 新增 8 个派生函数；删 `h.decisions`；修首页 3 处标签与 2 个预算百分比；删 2 处系数造假；`common.export` 带对象 | `derived.js` `store.js` `app.js` `workspace/pages.js` `audio/pages.js` `director/pages.js` | `_audit_ia2` 前后对比：跨页重复指标 0、系数 0 |
| B2 实体归并 | M1–M9 十个路由合并 + 菜单重排 + tab 状态键 | `data.js` + 9 个模块 + `menu.js` | `regress` 66→56 全绿；`_smoke` 56 路由；`_e2e` 补 tab 断言 |
| B3 命名派生 | `UI.page` 签名改造、面包屑三段式、页眉只留标题、模块 label 停用 | `ui.js` `app.js` `menu.js` + 17 模块 66 处调用 | 新增断言：页面章节 === 二级菜单名（0 例外） |
| B4 骨架瘦身 | 47 张规则卡 → ≤17；8 页指标/明细去重；13 例同页重复按钮；7 例文案不符 | 全部模块 | 按钮表：同页同动作 ≤1、文案与落点一致率 100% |
| B5 权限对齐 | 4 处权限码修正 + 只读视图 | `data.js` `app.js` 各模块 | `_audit_perms` 0 missing；6 身份 × 56 路由矩阵快照 |
| B6 文档同步 | README 路由表、TRACEABILITY、INTERACTION-SPEC、版本串 `?v=9.7.0` | docs | 一致性脚本 |

每批独立可回滚，B1 必须先做（否则 B2 合并后口径仍会漂移）。

---

## 五、验收标准（可测）

1. 全站页面章节名 = 所在二级菜单名，例外 0（脚本断言）。
2. 一个实体只有一个清单页：项目 / 镜头 / 交付 / 授权 / 异常各 1 个；二级页面只允许"跳转 + 摘要 ≤3 条"。
3. 任一指标在任一屏只出现一种算法：预算、质量通过、集进度、待办、任务数各 1 个来源。
4. 跨页指标不得在页面内重新求和：项目数、成本合计、任务数、质量通过、集进度五项只能来自 `derived`；页面内的"当前筛选视图小计"允许，但口径须与对应 `derived` 函数同名同义。
5. 无系数造假：`grep "Math.round(.*\* 0\." modules/` 命中 0。
6. 导出入口 = 导出文件：每个导出按钮产出带对象名的文件，文件名可校验。
7. 同页同动作按钮 ≤1；按钮文案与落点 title 一致率 100%。
8. 每页 KPI ≤4、主明细 ≤2、按钮 ≤6；规则类卡片每域 ≤1。
9. 6 个身份 × 56 路由：无"页面可见但全为只读且无提示"、无"首屏对管理员不可见"。
10. `regress / flow / _journey / _audit_actions / _audit_perms / _audit_dups / _audit_links / _audit_project_guard / _smoke / _e2e` 全绿。

---

## 六、不建议做的事

- **不建议只改文案**：本次 7 例文案不符只是表象，根因是 4 套名称与 20 个共用导出动作。
- **不建议保留"我的项目"与"项目列表"双页**：两份实现必然再次漂移，这正是 C1–C5 的成因。
- **不建议用首页替代生产现场**：首页没有门禁与集板，替代不了流水线，只会变成第三个半成品。
- **不建议把 47 张规则卡原样搬进文档**：规则应按域合并为 17 篇，页内只留"一句话口径 + 抽屉"。
- **不建议在 B2 之前动命名**：合并会改菜单树，先改名等于改两遍。
