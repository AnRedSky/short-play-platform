# 信息架构整改清单与施工计划（v9.6.1 → v9.7.0）

本文是《全站信息架构深度核查与整体调整方案》（`docs/REVIEW-IA-FULL-V9.7.0.md`）的执行版：**已做的记为事实，待做的记为可勾选条目**。每条都带落点文件与可测验收，不写"建议优化"这类无法验收的条目。

当前基线（v9.7.0）：**56 条路由 / 17 个域 / 6 个一级菜单 / 324 个已注册动作 / 6 个身份**。审计快照随时可重跑：

```
node tools/_audit_ia2.mjs > tools/_ia_report.txt
node tools/_audit_ia3.mjs > tools/_ia_btn.txt
node tools/_audit_kpi.mjs
node tools/_probe_tab.mjs <route> <tab> [projectId] [stateKey] [keyword]
```

| 审计维度（判定口径见脚本段号） | v9.6.2 基线 | v9.7.0 现状 | 目标（B3–B6 后） |
| --- | --- | --- | --- |
| 路由数 | 65 | **56 ✅** | 56 |
| 页眉首参 ≠ 二级菜单名（§3b） | 63/65 | 53/56 | 0 |
| 一个二级菜单出现多个章节名（§3c） | 16 组 | 14 组 | 0 |
| 同动作多套文案（`_ia3` C 段） | 39 组 | 19 组 | ≤10 组 |
| 跨页重复卡片标题（§4） | 11 组 | 8 组 | ≤3 组 |
| 同页 metric ↔ 明细卡 1:1 重复（§6） | 7 页 | **8 页（微增，见 R-33）** | 0 |
| 同页同文案不同动作（§3d） | 19 组 | 17 组 | ≤6 组（真同义） |
| 口径多套（`_audit_kpi` 覆盖） | 3 组 | **0 ✅** | 0 |
| 系数造假 / 硬编码项目 ID（§9） | 0（B1 已清） | 0 | 0（脚本守护） |
| 权限码错配（§10 + `_audit_perms`） | 4 处 | 4 处（未动，B5 处理） | 0 |
| 导出共用固定文件名 | 0（B1 已清） | 0 | 0（脚本守护） |

> §6 从 7 → 8 是合并的副作用：tab 块自带一组指标，宿主页头部又有一组同名 KPI，两个 tab 同时命中。属"合并后要补的一刀"，已列入 R-33。

---

## 一、已完成（B1 口径收口 v9.6.1 / B2 实体归并 v9.6.2 → v9.7.0）

| # | 事项 | 落点 | 验收证据 |
| --- | --- | --- | --- |
| B1-01 | 项目预算收敛为单一账本 | `derived.budgetOfProject(p)` 读 `DB.budgets`；`store.ensureProjectBudget()` 缺失补建、存在回写项目字段 | `_audit_kpi` 断言 7 个项目 `source=ledger`、字段与账本同值 |
| B1-02 | 账本补齐与历史漂移修复 | `data.js` 项目账本 6 → 10 条；SP-26015 已用 7420→14420、SP-26007 23890→26000 且状态改「已冻结」 | 首页 hero「预算已用 51%」= 账本计算值 |
| B1-03 | 阈值判定只留一处 | `store.budgetStateFor(used,total,frozen)`，85% 取 `DB.pricing.budgetWarnRate` | `_audit_kpi` §7 五态用例 + 静态扫描 0 命中 |
| B1-04 | 集进度单一口 | `derived.progressOf(p)` 以 `done/episodes` 为准；`normalizeActiveProjects()` 只在分集完整覆盖时回写 `p.done` | `_audit_kpi` §2；修复前会把 16 集改写成 1 集 |
| B1-05 | 任务/交付/待办单一口 | `taskStats / deliveryStats / duties`；`duties` 以通知表为唯一源 | `_audit_kpi` §3–4：六身份分类之和 = 总数 |
| B1-06 | 首页口径统一 | hero 预算、mini-kpi、指标「待我处理」、明细卡「待处理事项」全部同源；删除死派生 `home().decisions` | `_audit_kpi` §5 |
| B1-07 | 系数造假清零 | 字幕单价、每镜均价、抽检比例移入 `DB.pricing` | `_audit_ia2` §9：0 |
| B1-08 | 导出带对象名 | `app.exportFileName()` = 页面标题 + 项目号 + 日期 | 20 处导出不再产出 `prototype-export.csv` |
| B1-09 | 模块侧口径补迁移 | `orgs / analytics / workspace / creation / post / projects` 全部改走派生口 | `_audit_kpi` §8 静态扫描 0 命中 |
| B1-10 | 回归守护 | 新增 `_audit_kpi`（112 断言）与 `_audit_ia2/_ia3` | 全套审计全绿 |
| B1-11 | 版本串同步 | `?v=9.6.1` 全站、侧栏版号、README 章节 | 缓存不回放旧 JS |

B2 九条（统一手法：重复页主体抽成 `xxxBlock(p)` 纯函数 → 宿主页加 `U.card("", U.tabs(...))` → 新增 `X.tab` 动作 → 删被并路由与菜单项 → `app.js` `LEGACY` 转发旧 hash）：

| # | 原路由 → 宿主 | 形态 | 落地版 | 验证（字符 / 卡片 / 指标） |
| --- | --- | --- | --- | --- |
| B2-01 | `workspace/projects` → `projects/list` | 「关系筛选」全部 / 我负责 / 我参与 / 待我审核 + 卡片「我的角色」 | 9.6.2 | `_peek_list` 四关系计数自洽（owner：可见 4 / 负责 2 / 参与 2 / 待审 1） |
| B2-02 | `quality/gates` → `quality/reports` | 「门禁」tab（四级 × 十维矩阵、三态结论、阻断与豁免） | 9.6.3 | 10043 字符 / 12 卡 / 16 指标 |
| B2-03 | `post/works` → `post/delivery` | 「作品」tab（作品清单 / 状态口径 / 交付摘要 / 新版本链） | 9.6.4 | 3703 字符 / 7 卡 |
| B2-04 | `video/results` → `video/preview` | 「版本列表」tab（多版本并存、设为采用） | 9.7.0 | 3238 字符 |
| B2-05 | `director/storyboard` → `director/shots` | 「分镜视图」（`director.view` = table / board） | 9.7.0 | 4335 字符 |
| B2-06 | `assets/usage` → `assets/library` | 「引用」tab（引用表、删除阻断、引用统计） | 9.7.0 | 4225 字符 |
| B2-07 | `cost/usage` → `cost/ledger` | 「用量」tab（计量差异、按能力用量、计费口径） | 9.7.0 | 3851 字符 |
| B2-08 | `notify/incidents` → `compliance/risks` | 「处置」tab（异常台账、处置原则、高频处置口径） | 9.7.0 | 4084 字符 |
| B2-09 | `analytics/departments` + `analytics/employees` → `analytics/enterprise` | 「部门对比」「员工对比」两 tab；删「对比入口」卡 | 9.7.0 | 6068 / 8011 / 14936 字符 |

收官验证：`regress` 56 路由全渲染、`_audit_links` 失效内链 0、`_audit_actions` 324 注册 / 0 未注册 / 0 重复、`_audit_perms` 0 missing、`flow` 18/18、`_journey` 22/22、`_audit_kpi` 112 项通过、`_audit_project_guard` 项目页阻断 23/23。

---

## 二、三个决策：已定（原"开工前必须先定"）

| 决策 | 结论 | 理由 |
| --- | --- | --- |
| D1 合并范围 | **只做 M1–M9，65 → 56**；M10–M13 不做 | M10–M13 是**下钻层级**不是重复实体：`projects/detail` 承载单项目上下文（集数、成员、账本），`tasks/attempt` 是单次执行轨迹，`models/routing` 是单模型策略，`orgs/member` 是单员工档案。四页均需上游带参进入，合并后无处承载上下文；且它们的 body 与"父页"重叠度 < 30%，不是同一实体的第二份渲染 |
| D2 命名主线 | **保留现名**（创作工作台 / 立项与项目），只做"章节由菜单派生" | 问题不在名字，在**四条名称链并存**（`DB.menu`、模块 `label`、页面 `title`、页眉手写章节）导致同一页三种叫法。改名要动 README 路由表 + 6 份身份说明 + 全部评审批注，收益为零。B3 只把后三条链收归 `DB.menu` |
| D3 首页定位 | **「今日制作台」**（今日待办 + 当前项目 + 风险升级 + 下一步，链路只留一行摘要跳流水线） | 首页是每日入口不是总览看板。现状 13 区块里 8 个是"概览"，真正的下一步动作要滚过两屏；管理员/审计身份进来看到的是自己无权操作的项目细节。链路明细只应存在于 `projects/workflow` |

---

## 三、待整改清单（B3–B6，24 条）

### B3 命名派生（5 条，消除四条名称链）

| ID | 优先级 | 问题 | 动作 | 落点 | 验收 |
| --- | --- | --- | --- | --- | --- |
| R-10 | P1 | 合并后旧动作仍在：`projects.listLink` / `director.toProjects` 两种"返回项目列表" | 统一为 `nav.projects`，删 `director.toProjects` | `app.js` 动作表、各模块 | `_audit_actions` 未注册 0；同目标动作只剩 1 个 |
| R-11 | P1 | 页眉章节各页手写（`U.page("组织与权限 / 企业主体", ...)`），53/56 与二级菜单不符 | `UI.page(title, sub, actions, body, note)` 取消手写章节，章节由壳层从菜单状态注入 | `assets/js/ui.js` + 56 处调用 | 页眉章节 = 二级菜单名 100%（新增 `_audit_naming.mjs`） |
| R-12 | P1 | 面包屑用 `route.title` 拼，与菜单、页眉三处口径不同 | 面包屑改三级：一级 / 二级 / 三级，全部来自菜单状态 | `assets/js/app.js` 壳层头部 | 面包屑尾段 = 当前页 title，中间段 = 二级菜单 |
| R-13 | P1 | 模块 `label`（「我的工作台 / 项目中心 / 任务与队列 / 模型与资源」）仍在展示层出现 | `AppModule.register` 的 `label` 只作内部 key；展示一律取 `DB.menu` | `assets/js/menu.js`、各 `pages.js` | 全站 grep 不到第二套域名词 |
| R-14 | P1 | 「后期与交付」一域两章节（后期与剪辑 / 审核与交付），`post` 6 页分裂 | 章节统一「后期与交付」，页内用 tab 区分后期 / 审核 / 交付 | `modules/post/pages.js` | §3c 14 → 0 |

> D3 已定后新增：`workspace/home` 的 title「工作台首页」与页眉「今日制作台」需一并统一（当前在 §3b 命中列表内），随 R-11 一次收口。

### B4 骨架瘦身（9 条）

| ID | 优先级 | 问题 | 动作 | 落点 | 验收 |
| --- | --- | --- | --- | --- | --- |
| R-15 | P2 | 菜单 label 与页面 title 不一致 1 例：`projects/workflow`「制作流水线」vs「项目制作流水线」 | 菜单名即 title | `data.js` / `projects/pages.js` | §2 不一致 0 |
| R-16 | P1 | 8 页 metric 与其下明细卡 1:1 重复（首页、授权台账、风险、成本、路由、通知、返工…） | 保留带下钻的 KPI，删同名明细卡 | 8 个 `pages.js` | §6 8 → 0 |
| R-17 | P1 | 47 张规则/口径卡分布各页，占屏比最高 | 每域留 1 张「口径与规则」，其余改为页头 `?` 抽屉或 `INTERACTION-SPEC` 章节 | 全部模块 | 规则卡 47 → ≤17；每页 ≤1 || R-18 | P1 | 同页重复按钮（`creation/brief` 11 个、`creation/script` 16 个、`video/preview` 11 个） | 同页同动作只留 1 个，其余进「更多」；每页 ≤6 | 对应模块 | 同页同动作 ≤1、按钮 ≤6（`_audit_buttons`） |
| R-19 | P1 | 19 组同一动作多套文案（`projects.wfOpen` 6 种、`common.export` 20 种） | 动作 → 唯一文案表；导出按对象命名 | `app.js` 动作表 | 19 → ≤10；同动作文案唯一 |
| R-20 | P2 | 3 例文案与落点不符：`查看拆解结果`→拆解页、`处理交付阻断`→授权台账、`打开分镜板`→镜头契约 | 文案改成落点页 title | 3 个模块 | `_ia3` B 段 0 条 |
| R-21 | P1 | 首页 13 区块（hero + 8 阶段链路 + 分集卡 + 下一步 + 4 KPI + 明细） | 按 D3：hero（预算+进度）/ 待办表 / 当前项目 / 1 张风险 / 1 条下一步；链路只留一行摘要 + 跳流水线 | `modules/workspace/pages.js` | 首页区块 ≤8；链路明细只在 `projects/workflow` |
| R-22 | P2 | `ops/overview` 与 `ops/queue` 页级重复（「任务队列」两页各一份） | overview 只留总览与异常，队列明细归 `ops/queue` | `modules/ops/pages.js` | §4 8 → ≤3 |
| R-23 | P2 | 合并后**单页体量**反而变大：`orgs/handover` 23483、`analytics/enterprise` 14936、`workspace/home` 13700 字符 | 单页 >12KB 的页只留"摘要 ≤3 条 + 跳主清单"；tab 块内规则卡移交 `INTERACTION-SPEC` | 相应模块 | 渲染 ≥12KB 的页数 0 |

### B5 权限与视图对齐（4 条）

| ID | 优先级 | 问题 | 动作 | 落点 | 验收 |
| --- | --- | --- | --- | --- | --- |
| R-24 | P0 | `workspace/home` 用 `analytics.own` 门禁，管理员/审计/部门负责人看不到首页 | 路由门禁改 `project.read`（或新增 `workspace.read`），写按钮按 `can()` 隐藏 | `data.js`、`modules/workspace/pages.js` | 6 身份首页可达；管理员/审计只读 |
| R-25 | P0 | `post/delivery`（含作品 tab）用 `delivery.execute`，审计看不到交付记录 | 读 `delivery.read`（新增），执行动作单挂 `delivery.execute` | `data.js`、`modules/post/pages.js` | 审计可读不可执行 |
| R-26 | P1 | `tasks/*` 权限 `[task.operate, audit.read]`，写读混在路由上 | 路由 `task.read`，写动作挂 `task.operate` | `data.js`、`modules/tasks/pages.js` | `_audit_perms` 0 missing |
| R-27 | P1 | `models/config` 只有 `models.own`，管理员无企业分配与额度视图 | 改 any-of `models.own | models.manage`，管理员加"企业分配/额度"段 | `data.js`、`modules/models/pages.js` | 管理员可见分配，不越权改他人凭据 |

### B6 文档、版本与脚本（6 条）

| ID | 优先级 | 问题 | 动作 | 落点 | 验收 |
| --- | --- | --- | --- | --- | --- |
| R-28 | P0 | `_smoke` / `_e2e` 按旧路由与旧按钮断言 | 路由表改 56；`_e2e` 补 9 条 tab 断言（M1–M9 各 1） | `_smoke.html`、`_e2e.html` | 56 路由无 JS 错误；断言 28 → 37 |
| R-29 | ✅ 已同步 | 三份文档仍需复核 | README 路由表已同步 56 与 tab（✅ 本轮）；`TRACEABILITY` / `INTERACTION-SPEC` 已改 9 处（✅ 本轮）；补「路由删除对照表」便于评审回查 | `README.md`、`docs/` | 文档内路由数 = 代码 56 |
| R-30 | ✅ 已完成 | 版本串与缓存 | 已升 `?v=9.7.0`、侧栏版号、README 顶部（✅ 本轮）；并已修正 README 中 9.6.4/9.6.3 两节小标题被批量替换误伤的错号 | `index.html`、`_smoke`、`_e2e`、`app.js`、README | 全站无 9.6.x 残留（历史审计文档除外） |
| R-31 | P1 | 「章节 = 二级菜单」「同页同动作 ≤1」只能靠人看 | 新增 `tools/_audit_naming.mjs`、`tools/_audit_buttons.mjs`，并入交付前回归 | `tools/`、README 回归段 | 两脚本 0 失败即达标 |
| R-32 | P2 | 部门/企业预算双源（`D.enterprise.budget` / `D.departments.budget` 与 `DB.budgets` 并存） | 统一到 `DB.budgets`，实体字段降级为投影（同 B1 对项目做法） | `data.js`、`store.js`、`analytics/pages.js`、`orgs/pages.js` | 断言：部门/企业已用 = 账本 used |
| R-33 | P1 | 合并副作用：tab 块指标与宿主页 KPI 同名（§6 7 → 8） | 宿主页头部只保留"跨 tab 汇总"指标；tab 内指标改名/降为表头 | `analytics/enterprise`、`cost/ledger`、`post/delivery`、`quality/reports`、`compliance/risks`、`assets/library` | §6 8 → 0，且 tab 切换不出现"同屏两组同名指标" |
| R-34 | ✅ 已完成 | 旧地址转发只覆盖 hash 解析路径，`LEGACY` 缺测即静默 404 | `_audit_links.mjs` 直接从 `app.js` 解析 `LEGACY` 表，逐条断言"旧地址已不在路由表 + 目标存在 + 宿主页渲染 ≥500 字符" | `tools/_audit_links.mjs` | 已达成：LEGACY 转发 10 条 · 通过 10 · 异常 0（同时把该脚本的 App 桩补齐为带项目上下文，动作覆盖 242 → 1468） |

---

## 四、执行顺序与门禁

```
B1 口径收口 ✅ v9.6.1（65 条，零路由变更）
B2 实体归并 ✅ v9.6.2 → v9.7.0（9 条，65 → 56）
  └─ 决策 D1/D2/D3 ✅ 已定（见第二节）
B3 命名派生（R-10…R-14）            门禁：_audit_naming 0 例外
B4 骨架瘦身（R-15…R-23 + R-33）      门禁：_audit_buttons 0 例外 / 首页 ≤8 区块 / §6 = 0
B5 权限对齐（R-24…R-27）            门禁：_audit_perms 0 missing / 6×56 矩阵快照
B6 文档版本（R-28/R-31/R-32）        门禁：全套回归 + _e2e 37 断言 + 10 条 LEGACY 断言（R-29/R-30/R-34 已完成）
```

硬约束（每批都适用）：

1. 一批之内不改两件性质不同的事（改名与删路由不同批，否则评审无法归因）。
2. 每批结束必须跑 `node --check` 全量 + `regress / _audit_links / _audit_actions / _audit_perms / flow / _journey / _audit_kpi`，并重生成 `tools/_ia_report.txt` 快照。
3. 合并页的 tab 键进状态层（`App.set(scope, "tab")`），刷新后保持，不做临时变量；`director` 的键是 `view` 不是 `tab`。
4. 任何删除路由需同时在 `README` 路由表与「路由删除对照表」留一条，旧地址必须由 `LEGACY` 转发，不返回 404。

## 五、风险与回滚

- **旧地址不可逆风险**：已用 `LEGACY` 十个映射兜底（含 `analytics/departments|employees` 两条指向同一宿主）。R-34 加断言后，转发失效会在回归里暴露，而不是等评审点开才发现。
- **B2 与 B3 顺序**：B2 已完成，B3 的章节派生在 56 页上做一次即可，不会重复改两遍。
- **tab 化丢功能**：每条合并都用 `_probe_tab.mjs` 逐 tab 渲染断言（字符数 / 卡片数 / 指标数 / 是否含 undefined·NaN / 关键词是否出现），防"合并了但 tab 空白"。
- **回滚**：B1 独立成版（9.6.1），B2 分三个版号落地（9.6.2 M1 / 9.6.3 M7 / 9.6.4 M2 / 9.7.0 其余六条），单条回退可 `git checkout` 对应文件。

## 六、执行进展（2026-11-25 · B3–B7）

### 已闭环（有脚本证据）

| 批次 | 条目 | 证据 |
| --- | --- | --- |
| B3 命名派生 | R-10…R-15 | `_audit_naming` 56 路由 0 失败；页眉章节由 `DB.menu` 派生；面包屑改三级；`projects/workflow` title 与菜单一致 |
| B4 骨架瘦身 | R-16 / R-19 / R-20 / R-21 | `_audit_ia2` §6 = 0；`_audit_ia3` C 段 22 组 → 2 组（余下 `common.export` / `quality.judge` 属白名单）；首页 4317 字符 / 页面级动作 6 |
| B4 按钮与体量 | R-18 / R-22 / R-23 | `_audit_buttons` 全站 76 快照：同页重复动作 0、动作 >6 的页 0、≥12KB 的页 0（`analytics/enterprise` 14929 → 10989）；`ops/overview` 队列明细改一行摘要，明细归 `ops/queue` |
| B5 权限对齐 | R-24…R-27 | `_audit_perms` 23 guard codes / 0 missing；`workspace/home` 六身份可达；`delivery.read` / `task.read` 写入权限字典与角色 |
| B6 脚本与账本 | R-31 / R-32 / R-34 | `_audit_naming` + `_audit_buttons` 已建；`_audit_kpi` 112 → **127 项**（新增部门/企业预算 = 账本断言）；`LEGACY` 10 条断言通过 |
| B7 规则收敛 | **R-17 已闭环** | `_audit_rules` 43 张 → **15 张（每域 1 张，超标页 0）**；28 张条文抽进 `docs/RULES-V9.7.0.md`（脚本生成，§R-01…§R-43），页面折叠为一行回指提示 |
| B7 浏览器验收 | **R-28 已闭环** | `_smoke.html`：56 路由 + 9 条 tab 断言 + 3 身份拦截，**Smoke OK**；`_e2e.html`：断言 **28 → 37**（新增 3 页 × 3 条 tab 状态持久化），**E2E OK** |
| B7 密度收尾 | **R-17 收尾已闭环** | 折叠后 5 个过薄页：同页并排的两条折叠提示合并为一条带结论口径行（`ops/logs`、`audio/voice`、`audio/subtitle`、`post/delivery`、`analytics/me`）；`ops/logs` 补「来源分布」（按日志表实时统计）与「队列积压与失败」（按 `DB.ops.queue` 投影）两张真实派生卡；`creation/script` 无正文样本时补「剧本流转与当前位置」卡。判定口径收紧为 <1400 字符，或 卡≤1 无表且 <3000 字符，`orgs/member`（下钻空态）白名单 → **过薄 0 页 / 56 页**，规则卡仍 15 张、单页 ≤1 |
| R-19 文案收口 | **已闭环** | 新增 `tools/_audit_labels.mjs`（按 `U.btn("<文案>","<动作>")` 整对扫描 244 个动作），同动作多文案 **12 组 → 0 组**：`projects.wfOpen`(制作流水线/查看生产流水线/打开制作流水线)、`projects.detail`(项目档案/查看项目档案/进入项目)、`compliance.toAudit`(审计日志/查看审计流水)、`post.newVersion`(新建 V2 版本链/新建 V2/从此版本新建 V2)、`director.check`(一致性抽检/一致性报告)、`director.regenerate`(重新生成/重新生成这一镜)、`director.shotDetail`(查看完整契约/详情)、`video.regenShot`(重新生成/局部重生成)、`creation.toPlan|toScript`(查看方案/先选定创意方案 · 剧本版本/先完成剧本审核) 全部统一；`video/preview` 同一行两个按钮指向同一动作（「采用该版本」与「接受并记录理由」）属重复动作，删「采用该版本」只留带理由的那颗。白名单收敛为 3 条并写明理由（`common.export` 按对象命名、`quality.judge` 判罚选项、`projects.wfDelivery` 交付状态互斥 CTA） |

### 部分完成

| 条目 | 现状 | 剩余 |
| --- | --- | --- |
| R-19 | 全站同动作多文案 0 组（`common.export` / `quality.judge` / `video.preview` 三类已白名单化并写明理由） | 无（如需绝对唯一，导出可按对象路由拆动作） |

### 事故与恢复记录（必读）

本轮用 PowerShell 对 `modules/*/pages.js` 做批量 `.Replace` 时，`$map` 被展平成字符串数组，`$p[0]`/`$p[1]` 取到的是首/次字符，结果把 4 个文件里的**所有双引号**替换成了各不相同的中文字符（director→`进`、post→`处`、projects→`打`、video→`去`），`node --check` 全红。

恢复方式（可复现）：按"两侧皆为非 ASCII 则视为正文、否则视为引号"的邻接规则逐字符回写，`post/pages.js` 另有 2 处 `" 处…"` 形态需手工回填（`refs + " 处"`、`" 处下游引用…"`）。恢复后 `node --check` 全站 0 失败，`regress / _audit_links / _audit_actions / _audit_perms / _audit_naming / _audit_kpi / flow / _journey / _audit_dups / _audit_project_guard` 全绿。

**结论：禁止再用 PowerShell 批量替换 JS 源码**。改文案一律走 `Edit` 工具逐处替换，或写 `.mjs` 脚本用 Node 读写（Node 端 UTF-8 无此问题）。

## 七、重复功能复核（2026-11-25 · 工具化，不再靠人眼）

动机：前六章都是「按清单改」，缺一份能反复跑的「是否还有重复」的判据。新增 `tools/_audit_overlap.mjs`，对 56 条路由逐页渲染，按四个维度自动比对，并区分「允许重复」与「真重复」。

复核范围：56 路由 = 菜单内 53 + 下钻 3（`orgs/member`、`projects/detail`、`projects/new`）。

判定维度与结果：

| 维度 | 口径 | 结果 |
| --- | --- | --- |
| ① 同名卡片跨页 | 卡片标题在 ≥2 页出现 = 同一块内容画两次 | **0** |
| ② 同名指标 ≥3 页 | 「已通过」出现在 `audio/dialogue`、`post/episodes`、`post/review` | 三处粒度不同（对白校验 / 分集质检 / 成片审核），保留 |
| ③ 页面级按钮同一动作 ≥2 页 | 只统计「业务动作」，导航 / 本地导出 / 全局创建单列 | **真双入口 0**；允许重复 8 组：`common.export` 12 页（各页导出自己的数据集）、`projects.wfOpen` 7 页 + `creation.toScript` 3 页 + `compliance.toRisks` 2 页 + `models.toProviders` 2 页 + `common.projects` 2 页 + `tasks.toList` 2 页（全部是导航到同一目的地）、`projects.new` 2 页（首页 CTA 与项目列表，全局创建入口） |
| ③b 写操作被 ≥2 个菜单页引用 | 从 handler 体是否含 `App.modal/confirm/job/drawer` 判定写动作，再看它出现在几个菜单页的 HTML 里 | **0**（改前 1：`director.check` 出现在 `director/cast` 与 `director/world`） |
| ④ 页面相似度 ≥0.5 | 卡片标题 + 指标 + 页面级动作的 Jaccard | **0 对**（最高对未达阈值） |

本轮据此修掉的 4 处残留（都是「同一件事两处可做」，不是文案问题）：

1. `projects/workflow` 头部「暂停项目」删除——暂停属生命周期操作，统一在 `projects/detail`（单项目）与 `projects/lifecycle`（批量），生产板不再误触。E2E 本就走 `projects/detail`，断言不受影响。
2. `projects/detail`「发起移交」改为导航到 `orgs/handover`（新增动作 `orgs.toHandover`，带项目预选；`orgs/handover` 读取 `orgs.handoverProject` 决定预览对象）——移交的唯一执行入口收敛到组织域，项目档案只负责跳转。
3. `projects/lifecycle` 的「可见项目状态分布」删除——与 `projects/list` 的「项目状态分布」是同一份计数，属重复呈现；该卡改为「暂停与恢复动作」（只讲动作语义，并注明「状态分布见项目列表」）。标题避开「口径」二字，规则卡审计维持 15 张。
4. `director/cast` 头部与 `director/world` 道具卡上的「一致性抽检」删除——抽检是项目级动作（读全部镜头、写质量报告），入口只留 `director/shots` 镜头清单。
   另：`models/config` 的「新增资源」改为按权限分流——管理员看到「供应商与模型」导航（新增供应商只在 `models/providers`），无管理权限的员工保留「新增资源」（他们进不去 providers，这是必要入口）。

结论：**结构层面的重复页功能已全部处理完成**，剩余跨页重复只允许三类——导航到同一目的地、页面本地导出、全局创建入口（首页新建项目）。这三类不是冗余，而是入口便利；一旦有人把某个「写动作」加进第二个页面，`_audit_overlap` 的 ③b 会直接报出来。

## 八、简洁度与布局方向（2026-11-25）

单开一份短文档：`docs/REVIEW-SIMPLIFY-V9.7.0.md`。核心判断是「还能继续简洁，但空间在骨架与列宽，不在文案」：

- 骨架分布：台账型 28 页 / 详情型 15 / 评审型 9 / 看板型 4 —— 一半页面同构（KPI 行 + 卡 + 表），节奏单一。
- 六个密度指标：列 ≥9 共 26 页、卡 ≥6 共 10 页、提示 ≥2 共 20 页、单卡占页 ≥40% 共 18 页、容器 ≥3 种共 12 页、指标 ≥5 仅 2 页。
- 方向取舍：A 结构性减法（全量做）+ B 骨架归位（仅 10 个重页）优于 C 对象视图重构（会推翻已验收的 B2 归并）。
- 四条基线：B-1 主表 ≤9 列 · B-2 单页 ≤5 卡 · B-3 单页 ≤1 条提示且置页尾 · B-4 单骨架 + 至多一个 aside。
- 首批 S-01 已落地：`cost/ledger` 18→9 列、`compliance/rights` 14→9、`tasks/list` 13→10、`models/providers` 11→9，全部只合并列、低频字段留在既有「详情 / 核验」抽屉里；S-02…S-08 见该文档第五章。

## 九、交互与页面功能方向（2026-11-25）

单开 `docs/REVIEW-UX-V9.7.0.md`，量化脚本 `tools/_audit_ux.mjs`。结论：内容冗余已清零，剩下的是"用起来费力"，且功能层面不需要再合并路由（56 条是这套 IA 的下限）。

- 整改前：48 页有表格、只有 1 页能搜；9 页长表无查询区；1 页只读死端（`workspace/assistant`）；1 页行内 5 个动作（`models/config`）；「详情/档案」2 组承载二义。
- 整改后：查询区覆盖 10 页、长表无查询 1 页（字典表白名单）、死端 0、单行动作过载 0（降到 2）、二义 0。另改 `applyFilters` 计数为整页聚合。
- 五条交互规范：I-1 查询优先（表 ≥8 行必有搜索 + 计数）· I-2 行内 ≤2 动作（写与不可逆进抽屉/弹窗）· I-3 查看=抽屉 / 编辑=弹窗 / 跨页=跳转，同语义单承载 · I-4 每页必有下一步 · I-5 反馈只有 `App.job` + `toast` 一套。
- 后续 U-01…U-07 见该文档第六章（补查询区、行内兜底、只读页统一骨架、卡数/单卡与 S-03/S-05 合并、承载收敛、断言的脚本化、1280 宽抽检）。

## 十、承载方式复核（2026-11-25）

单开 `docs/REVIEW-CARRY-V9.7.0.md`，量化脚本 `tools/_audit_carry.mjs`。

- 核心判断：跳页 / 抽屉 / 弹窗不是二选一，是三分 + 页内切换；依据是"上下文要不要被带走"，不是内容多少。
- 现状：325 动作里页面跳转 89、抽屉 46、弹窗 124、页内切换 31、行内写入 35。
- 错配 15 处全部清零，且未新增路由：重弹窗 7→0（6 个 6–12 字段表单加 `wide: true`）、重抽屉 8→0（6 个 >10 字段抽屉成对合并到 ≤10，信息不删）。
- 四条承载基线：C-1 非宽弹窗 ≤5 字段、宽弹窗 ≤12 且两列 · C-2 抽屉 ≤10 字段、动作 ≤5 且状态互斥 · C-3 跳页必带对象 id、查看=抽屉、跨页=`toXxx` · C-4 跳页必须能一键回来源。
- 页面内容剩余的优化序列：孤岛页 13（其中 5 个流程中段该补下钻）→ 宽表 17 → 卡 ≥6 的 10 页 → 单卡 ≥40% 的 18 页 → 提示 ≥2 的 20 页；C-01…C-06 见该文档第五章。

## 十一、C 系列执行结果与后续（2026-11-25）

**已完成（本轮，回归全绿）**

| 编号 | 结果 | 落点 |
| --- | --- | --- |
| C-01 | 5 条流程中段下钻补齐；孤岛页 13 → 8（剩 8 个为域入口 / 首页） | `video.toBgm` ← 视频预览、`post.toDialogue` ← 分集成片、`director.toWorld` ← 人物档案、`post.toVersions` ← 交付包、`ops.toLogs` ← 队列；跳转 89 → 94，跳转过碎 0 |
| C-02 | 真宽表（≥11 列）清零；5 张主表瘦身 | `assets/library` / `quality/reports` / `post/delivery` / `compliance/risks` / `tasks/attempt`；`cost/budget` 再降到 8 列（层级并入名称） |
| C-03 | 卡 ≥8、单卡 ≥80% 归零 | `projects/detail` 卡 8→7（档案与创作基准合一）；`ops/capabilities` 单卡 87%→57%（左右分栏 + 分布 / 登记要点 / 覆盖抽样） |
| C-04 | 提示 ≥3 归零 | `cost/budget` 4→1、`creation/review` 3→2、`projects/detail` 2→1、`orgs/grants` 1→0、`ops/capabilities` 1→0；规则卡稳在 15 张、超标页 0 |
| C-05 | 阈值已进脚本（弹窗 / 抽屉 / 跳转三类断言） | `_audit_carry.mjs`；接 CI 未做 |
| C-06 | 浏览器验收：`_smoke` 45 路由 + 9 tab 全通过、`_e2e` 37 断言全 PASS | 1280 宽像素级抽检未做 |

**口径修正（重要）**：`_audit_layout` 用 `/<th/` 统计列数，把 `<thead>` 也计入，导致所有页面列数系统性 +1（"11 列"实际 10 列）。已改为 `/<th[ >]/` 并重算基线；同时把指标分层为硬阻断（卡 ≥8 / 列 ≥11 / 提示 ≥3 / 单卡 ≥80%）与观察项（卡 6-7 / 列 9-10 / 提示 2 / 单卡 60-79% / 表 ≥3 / 布局 ≥3 种）。分层理由：单一主表页配轻侧栏是正常形态，用统一阈值会把正常页也判成缺陷。

**后续（按优先级）**

| 编号 | 事项 | 依据 | 规模 |
| --- | --- | --- | --- |
| D-01 | 观察项批量收敛：卡 6-7 的 6 页（`creation/brief`、`creation/review`、`models/config`、`models/routing`、`post/timeline`、`audio/bgm`）按 S-03 并 tab | 软指标 | 6 页 |
| D-02 | 提示 2 的页收成 1 条（保留"规则引用 + 状态告警"两类中的一类） | 软指标 | 约 12 页 |
| D-03 | 列 10 的 6 页降到 9（`tasks/list`、`post/timeline`、`audio/bgm`、`audio/subtitle`、`director/cast`、`director/world`） | 软指标 | 6 页 |
| D-04 | 1280 / 1440 两档像素级抽检（宽弹窗两列、9 列表格横滚、抽屉贴边） | C-06 | 6 张快照 |
| D-05 | 17 个审计脚本接 GitHub Actions（先解决 develop 推送策略） | 用户工作流偏好 | CI |
| D-06 | 版本号 9.7.0 → 9.7.1（同步 `index.html`、`_smoke/_e2e` 的 `?v=`、侧栏与 README / PLAN 标题） | 发布口径 | 一次 |

## 十二、D 系列执行结果（2026-11-25 · 9.7.1）

**已完成**

| 编号 | 结果 | 手段 |
| --- | --- | --- |
| D-01 | **卡 6-7 全部清零**：`models/config`、`models/routing`、`post/timeline`、`creation/brief`、`creation/review`、`creation/breakdown`、`director/plan`、`quality/reports`、`audio/bgm`、`projects/detail` 共 10 页 → 全站无卡 ≥6 | 一律"同主题并卡、信息不删"：`models/config` 额度与验证合一 / 归属与异常合一；`models/routing` 剪辑能力并入能力清单、路由原则并入可用性；`post/timeline` 删「标脏片段」卡（与同页标脏提示重复），提示改为"有无标脏"双态；`creation/brief` 版本记录并入台账；`creation/review` 分集覆盖并入待审对象；`creation/breakdown` 引用关系并入拆解结果、待处理与自检合一；`director/plan` 规划口径并入必填字段；`quality/reports` 分布与趋势合一；`audio/bgm` 授权类型与使用建议合一；`projects/detail` 生命周期并入阶段进度、质量审核与风险合一 |
| D-03 | **列 10 清零**：`tasks/list` 11→9、`compliance/risks` 风险表 10→8 与异常台账 10→8、`quality/rework` 10→9 | 失败类型并入尝试；风险等级并入类型、状态并入发现时间；返工时间并入记录 |
| D-06 | **版本号 9.7.1** | `index.html` 标题与全部 `?v=`、`_smoke/_e2e` 的 iframe 与刷新参数、`app.js` 侧栏版本、README 标题 |

**口径再定**（同步进 `_audit_layout`）：每页最多 2 条提示，且两条不得同为规则引用——一条规则引用 + 一条状态告警是允许形态（`workspace/home` 的"链路状态 + 待办"即属此类）。因此 `提示 2` 由缺陷降为观察项，只有 `提示 ≥3` 阻断。规则卡从 15 张降到 **14 张**（并卡后自然收敛，仍单页 ≤1）。

**回归证据**：24 个 js `node --check` 全通过；`regress`、`_audit_links`、`_audit_actions`（330 注册 / 0 未注册）、`_audit_perms`、`_audit_kpi` 127 项、`_audit_dups`、`_audit_project_guard` 23、`_audit_naming` 56、`_audit_buttons`、`_audit_rules`、`_audit_labels`、`_audit_density` 0 过薄、`_audit_overlap`（真双入口 0 / 写操作跨页 0 / 相似度 0）、`_audit_layout` 硬阻断 0、`_audit_ux`、`_audit_carry`（弹窗过重 0 / 抽屉过载 0 / 跳转过碎 0）、`flow` 18、`_journey` 22 全通过；浏览器 `_smoke`（17 域 + 9 tab + 3 身份）与 `_e2e`（37 断言 / FAIL 0）在 9.7.1 上重跑通过。

**后续（仍未做）**

| 编号 | 事项 | 为什么还没做 |
| --- | --- | --- |
| D-02 | 提示 2 的页继续收成 1 条 | 复核后判定多数属"规则引用 + 状态告警"的合法组合，硬收会丢状态可见性；只对"两条都是规则引用"的页再收（当前扫描为 0 页） |
| D-04 | 1280 / 1440 像素级抽检 | **已完成（9.7.2，见第十三章）** |
| D-05 | 17 个审计脚本接 GitHub Actions | 卡在 develop 推送策略未定（origin 仍停在 `fb36f1e`） |
| D-07 | `tools/_cols.mjs` 写进 README 回归清单 | 单页逐表列数诊断工具已落地，尚未进标准序列 |

## 十三、D-04 像素级抽检执行结果（2026-11-25 · 9.7.2）

**做法**：不做"截图目测"，做可复跑的几何量测。新增 `_pixel.html`，用 iframe 把 `index.html` 依次摆成 1280×800 与 1440×800，逐页导航后读真实 `getBoundingClientRect` / `scrollWidth`：

1. 56 路由 × 2 档：页面级横向溢出、过窄卡片、横向溢出表格的首列/末列是否仍在滚动视口内、被截断单元格。
2. 9 个弹窗（含全部 wide 表单）：宽度是否出视口、内层是否横溢、`.grid-2` 两列是否被压到 150px 以下、字段是否溢出、底部操作是否在视口内。
3. 8 个抽屉：右缘是否贴边、抽屉本体与 `#drawer-body` 是否横溢、内部宽表是否可滚。

**首轮（9.7.1 口径）26 项 FAIL，全部是真问题或口径缺陷：**

| 类别 | 事实 | 结论 |
| --- | --- | --- |
| 宽表操作列 | 11 页在 1280 下横滚时「操作」列被推出视口 89–238px（`post/delivery` 238、`models/config` 228、`tasks/list` 199–200、`assets/library` 130、`audio/bgm` 100、`compliance/rights` 100、`projects/workflow` 89、`creation/review` 114、`creation/breakdown` 23–43、`director/shots` 15、`tasks/queue` 11–51）；1440 下仍有 5 页（`post/delivery` 139、`models/config` 68、`tasks/list` 39、`creation/review` 53、`projects/workflow` 9） | 不是列数问题而是"最后一列被藏起来"，用户要点操作必须先横向滚动 |
| 高表单弹窗 | `creation.importNovel` 12 字段，整窗滚动，底部「解析并生成改编稿」在 y=991（视口 800）；`compliance.newRight` 在 y=816；`director.newShot` 溢出 13px | 弹窗能打开但看不到怎么提交 |
| 抽屉贴边 | 8 个抽屉右缘 1265/1280、1425/1440，差 15px | **口径错误**：`window.innerWidth` 含滚动条，fixed 元素贴的是 `documentElement.clientWidth`，实际已贴边 |
| `_smoke` 覆盖 | 输出 `routes=17` 而非 56 | **口径错误**：就绪判据只等 `App` 存在，而 `App` 在模块注册前就已存在，实际只跑了最先注册的 17 条路由 |

**修复（三项系统级改动，不动页面内容）：**

1. `app.js` 新增 `markWideTables()`：只给 `table.scrollWidth - wrap.clientWidth > 2` 的表格打 `.has-x`，在 `renderView()` / `drawer()` / `resize` 三处调用。非溢出表格不加类，避免小表被无谓粘连。
2. `components.css`：`.table-wrap.has-x` 下首列与末列 `position:sticky` 吸附左右（表头同时保持顶部吸附，z-index 4；表体 3；两侧 10px 渐隐阴影；暗色主题补 `#11151b` / `#171d25` 背景，避免与 `--surface` 色差）。
3. `components.css`：`.modal` 改 flex 纵向 + `overflow:hidden`，`#app-form` 承担滚动，`.modal-foot` 改 `position:sticky;bottom:0`。头部与提交按钮常驻，字段区自身滚动。

**复测**：同脚本两档全绿——页面级横向溢出 0、窄卡 0、宽表首末列 0 出视口；9 个弹窗底部操作全部可见、无内层横溢、两列各 401px 未挤压；8 个抽屉右缘 = 1265/1265 与 1425/1425 贴边、内部无横溢（`orgs.grantNew` 因需 `grant.manage`、owner 无权限而跳过）。快照 `tools/_ia_pixel.txt`，截图 5 张在 `docs/shots/`。

**回归**：24 个 js `node --check` 全过；`regress`、`_audit_links`（56 路由 / LEGACY 10 / 失效 0）、`_audit_actions`（330/264/0）、`_audit_perms`、`_audit_kpi` 127、`_audit_dups` 0、`_audit_project_guard` 23、`_audit_naming` 56、`_audit_buttons` 76、`_audit_rules` 14、`_audit_labels` 252、`_audit_density` 0 过薄、`_audit_overlap`、`_audit_layout` 硬阻断 0、`_audit_ux`、`_audit_carry`、`flow` 18、`_journey` 22 全通过；浏览器 `_smoke`（**56 路由**，首次真正全覆盖）与 `_e2e` 37/37 PASS。

**遗留（D-04 之外的后续）**

| 编号 | 事项 | 状态 |
| --- | --- | --- |
| D-02 | 提示 2 继续收成 1 条 | 扫描 0 页（剩余均为"规则引用 + 状态告警"合法组合），视为收口 |
| D-05 | 审计脚本接 GitHub Actions | 未做，卡推送策略 |
| D-08 | 1280 下仍有 5 页宽表需要横滚（`post/delivery` 239、`models/config` 229、`tasks/list` 200、`assets/library` 131、`compliance/rights` 101），中间列被吸附列遮挡 | 新增后续项：要么再降 1 列，要么把高频中列（状态/时间）提到吸附列旁；需先按真实点击频次排序再定 |
| D-09 | `_pixel.html` 未进 CI，靠手动起服务跑 | 与 D-05 一并处理 |

---

## 十四、D-08 列序调整执行结果（9.7.5）

### 14.1 问题定义与判据

D-04 已把「操作列被推出视口」用吸附列兜住，但宽表本身仍在横滚：1280 内容区 941px，而 `models/config` 自然宽 1170、`tasks/list` 1141、`assets/library` 1072、`compliance/rights` 1042。吸附列只能保住首末列，滚动时中间列仍被两侧吸附列压住，读到的是「半截表」。D-08 的目标是把 1280 下每个表格的 `scrollWidth - wrap.clientWidth` 压到 0。

判据不看列数，而看**真实几何**：`_pixel.html` 逐表量 need，need=0 才算收口。这也是本轮放弃「按列数一刀切」的原因——同样 9 列，窄卡里的表和全宽表需要完全不同。

### 14.2 统一手法：同主题两行堆叠，不删信息

| 手法 | 说明 | 典型用例 |
| --- | --- | --- |
| 副行堆叠 | 同主题两个字段放一个单元格，第二行用 `.faint.small` | 供应商 `PRV-07 · 自持`、状态 pill 下挂「优先级 P1」、交付包「文件数 · 体积」+ 校验前缀 |
| 同轴合并 | 业务上必然一起读的字段并成一列，表头写 `A · B` | `期限 · 商用性`、`状态 · 复核`、`审核人 · 时间`、`人物 · 引用资产`、`结果 · 问题` |
| 缩写标签 | 四状态压成 `供 / 下 / 存 / 质`，`title` 保留全称 | `tasks/list` 四状态列 |
| 去冗余列 | 卡片标题已声明项目时删「项目」列（页内唯一项目） | `audio/bgm`、`post/delivery` |
| 显示降级 | 长串截断 + `title` + 详情抽屉看全量 | 端点去 `https://`、校验和截 14 位 |

**禁用做法**（会破坏可用性，本轮未用）：删业务字段只留 Tooltip、把表改成一列 KV 堆叠、缩小字号或压 padding。

### 14.3 逐页结果（1280 实测 need）

| 页面 | 列数 | 改前 need | 改后 need |
| --- | --- | --- | --- |
| models/config | 9→7 | 229 | 0 |
| tasks/list | 9→7 | 200 | 0 |
| tasks/queue（资源池 / 等待原因） | 8→7 / 3→2 | 12 / 52 | 0 / 0 |
| assets/library | 9→8 | 131 | 0 |
| compliance/rights | 9→8 | 101 | 0 |
| audio/bgm | 9→6 | 101 | 0 |
| post/delivery | 9→6 | 239 | 0 |
| creation/review | 4→2 | 115 | 0 |
| creation/breakdown | 6→5 / 6→4 / 3→2 | 44 / 28 / 24 | 0 |
| director/shots | 8→7→6 | 16 | 0 |
| projects/workflow | 5→3 | 90 | 0 |

`post/delivery` 额外做了一次结构判断：主表原本放在 `.split` 的左半边（宽 557），即便列数降到 6 仍需 74px 横滚；把「交付包清单」提为全宽主表、「交付内容模板」与「生成前检查」降到下方 split，need 直接归零，信息层级也更符合「主表在上、核验在下」。

### 14.4 过程中修掉的两个测量口径缺陷

1. **`_pixel` 未复位会话**：上一轮 `_e2e` 会切身份（staff / auditor）并写业务状态，残留在 localStorage 里，导致本轮报 4 条「点击后未打开」（`audio.newVoice`、`director.newShot`）与一批「无触发入口」。现象是"时有时无"，若据此去改页面就会改错。修法：开跑前 `localStorage.clear()` + 重载 + 重等 56 条路由。复位后这些条目全部正常，仅 `orgs.grantNew`（需 `grant.manage`）与 `orgs.preview` 因权限无入口，属于预期跳过。
2. **模块 JS 的启发式缓存**：`python -m http.server` 的 `Last-Modified` 会被 Chrome 启发式缓存，改了 `modules/*/pages.js` 但 `?v=` 没变时，浏览器仍渲染旧列——表现为「代码已改、need 不变」。本轮因此出现过一次假阴性（`director/shots` 连改两版都报 8col/need16）。纪律：**每次改模块 JS 必须同步升 `?v=`**，否则量测结论不可信。

### 14.5 复测与回归

- `_pixel`：1280 与 1440 两档，56 路由 + 9 弹窗 + 8 抽屉，**FAILS=0**；所有表格 need=0；弹窗 bottom 操作全部可见；抽屉 right 贴边；`Pixel OK`。
- `_smoke`：`routes=56`，9 组合并页 tab 正常，`Smoke OK`。
- `_e2e`：37 PASS / 0 FAIL，`E2E OK`。
- 脚本侧：`regress` 通过；`_audit_links` 56 / LEGACY 10 / 失效 0；`_audit_actions` 330·264·0；`_audit_perms` 36 / 23；`_audit_kpi` 127；`_audit_dups` 0；`_audit_project_guard` 23；`_audit_naming` 56/0；`_audit_buttons` 76 快照 0 例外；`_audit_rules` 14 张；`_audit_labels` 252/0；`_audit_density` 过薄 0；`_audit_overlap` 真双入口 0；`_audit_layout` 硬阻断 0 · 软观察 **39**（9.7.2 为 41，宽表降列后自然减少）；`_audit_ux`、`_audit_carry`（弹窗过重 0 / 抽屉过载 0 / 跳转过碎 0）；`flow` 18；`_journey` 22。
- 24 个 js `node --check` 全过。

### 14.6 遗留与后续

| 编号 | 事项 | 状态 / 建议 |
| --- | --- | --- |
| D-08 | 1280 宽表横滚 | **已收口**，两档 need=0 |
| D-09 | `_pixel.html` 进 CI | 未做，仍卡推送策略（见第十四章末） |
| D-10 | 420px 抽屉内宽表（`assets.detail`、`workspace.cmdHelp`）仍横滚 1 | 预期行为，不阻断；若要彻底消除，需把抽屉内表改成 KV 列表，建议随下一次抽屉统一评审一起做 |
| D-11 | 版本号纪律 | 已确认：改模块 JS 必须同步升 `?v=`；建议后续把 `?v=` 改为构建期时间戳，从根上消除启发式缓存踩坑 |
| 推送策略 | `origin/develop` 停在 `fb36f1e`，本地已积累 6 个整改提交 | 待用户拍板：直推 develop 或开 PR 到 main；D-05（Actions 接审计）与 D-09 均等此决策 |

---

## 十五、D-10 / D-11 执行结果（9.7.6）

### 15.1 D-10：抽屉内宽表收口

D-08 把页面级表格的 1280 横滚清零后，`_pixel` 只剩抽屉内部两处横溢。抽屉可视内容区只有 324–358px，比页面窄卡还窄，任何两列 `cell-wrap`（min-width 150–180）叠加就会溢出。

| 抽屉 | 改前 | 改后 |
| --- | --- | --- |
| `assets.detail` · 引用位置明细 | 3 列（引用类型 90 / 引用对象 150 / 位置 126），324px 内容区 need=42 | 2 列（引用对象 + 类型副行 / 位置），need=0 |
| `workspace.cmdHelp` · 可用指令 | 3 列（目标 123 / 示例话术 150 / 风险 93），358px 内容区 need=8 | 2 列（目标 + 风险 pill 副行 / 示例话术），need=0 |

`cmdHelp` 的合并还带来一个副产品：风险等级原本在第三列、与指令横向隔开，视线要走两跳；压成副行后「这条命令有多危险」和命令本身在同一格里，扫读成本更低。这不是为了省列而省列。

复测：`_pixel` 两档 8 个抽屉全部不再出现「表横滚 1」。

### 15.2 D-11：本地服务 no-store

根因不是浏览器"太爱缓存"，而是 `python -m http.server` 只给 `Last-Modified`、没有 `Cache-Control`，Chrome 于是按「资源年龄的 10%」做启发式缓存——改完 `modules/*/pages.js` 再刷新，拿到的还是旧文件。D-08 期间两次出现「代码已改、need 不变」的假阴性，都是这个原因。

新增 `tools/serve.mjs`（零依赖，Node 内置模块）：

- 响应头 `Cache-Control: no-store, no-cache, must-revalidate` + `Pragma: no-cache` + `Expires: 0`；
- 仅绑 `127.0.0.1`，默认 4199，端口可传参；
- 带 MIME 表（html/js/mjs/css/json/图片/字体/md/txt）；
- 目录请求回落 `index.html`；路径穿越（`..`）直接 403；
- `/favicon.ico` 返 204，避免审计台里挂一条与页面无关的 404（此前每轮 `_pixel` 都会带 1 条 error）。

实测：`HEAD /index.html` → `Cache-Control: no-store, must-revalidate, no-cache`；`HEAD /modules/tasks/pages.js` → `text/javascript; charset=utf-8`；`/favicon.ico` → 204。

`?v=` 从此只作版本标记，不再承担破缓存职责；人工"改完必须升 ?v"的纪律解除，但发版时仍统一升版本号。

### 15.3 回归

- `regress` 通过；`_audit_links` 56 / LEGACY 10 / 失效 0；`_audit_actions` 330·264·0；`_audit_perms` 36 / 23 · missing none；`_audit_kpi` 127；`_audit_dups` 0；`_audit_project_guard` 23；`_audit_naming` 56/0；`_audit_buttons` 76 快照 0 例外；`_audit_rules` 14；`_audit_labels` 252/0；`_audit_density` 过薄 0。
- `_audit_layout` 硬阻断 0 · 软观察 **39**；`_audit_overlap` 同名卡片 0 / 真双入口 0 / 写操作跨页 0 / 相似度 ≥0.5 为 0（唯一同名指标「已通过 ×3」属正常 KPI 复用）；`_audit_ux`、`_audit_carry`（弹窗过重 0 / 抽屉过载 0 / 跳转过碎 0）通过。
- `flow` 18/18；`_journey` 22/22。
- 浏览器：`_smoke` routes=56、`Smoke OK`；`_e2e` 37 PASS / 0 FAIL、`E2E OK`；`_pixel` 两档 FAILS=0、`Pixel OK`。
- 全部 js `node --check`（含新增 `tools/serve.mjs`）通过。

### 15.4 后续（E 系列：交互承载收敛）

几何与列序已收口，下一批该动"同一页里承载方式过杂"：`_audit_ux` 目前仍有 4 页在同页混用 4 种承载（弹窗 / 抽屉 / 跳转 / 状态切换）。

| 编号 | 页面 | 现状 | 方向 |
| --- | --- | --- | --- |
| E-01 | tasks/list | 抽屉 1 / 弹窗 3 / 跳转 3 / 状态切换 1 | 「详情」抽屉与「尝试与调用记录」跳转并存，收敛为：行内详情走抽屉，历史走页内 tab，去掉 1 条冗余跳转 |
| E-02 | creation/brief | 抽屉 3 / 弹窗 1 / 跳转 1 / 写入 1 | 三个抽屉里两个只读说明（输入方式 / 生成前校验），改页内展开，抽屉只保留"追溯链路" |
| E-03 | video/preview | 弹窗 2 / 跳转 3 / 状态切换 1 / 写入 1 | 预览与版本混在一页，按"看片 → 定版"拆承载：看片抽屉、定版弹窗、版本管理跳 `post/versions` |
| E-04 | compliance/risks | 抽屉 1 / 弹窗 1 / 跳转 1 / 状态切换 1 | 处置动作与风险详情分离，处置统一走弹窗（写操作单入口），详情降为行内展开 |

同时保留两项待决策：D-09（`_pixel` 进 CI）、D-05（审计脚本接 Actions），均卡在推送策略（`origin/develop` 停在 `fb36f1e`，本地已积 9 个整改提交）。

---

## 十六、E 系列（一）：交互承载与查询能力（9.7.7）

### 16.1 先纠正上一版的口径误判

上一版把 `_audit_ux` 的「承载方式 ≥4 种」当成缺陷清单排了 E-01…E-04，这是错的。一个台账页同时有「看详情（抽屉）/ 做动作（弹窗）/ 去相关页（跳转）/ 切筛选（状态切换）」是正常结构，种类多不等于乱。真正的缺陷判据只有三条：**同一意图两种承载**（同名"详情"时而抽屉时而跳转）、**只读内容必须开抽屉才看得到**、**单行 ≥3 个动作**。本轮按这三条重审，`_audit_ux` 的「同名详情承载不一致」「行内过载」两项均为 0，所以 E 系列收敛为两个真问题。

### 16.2 E-01 `creation/brief`：只读说明从抽屉移到页内

原来在「输入方式（七选一）」卡片底部放「查看该方式说明」，点开是抽屉，内容是该方式的 输入 / 输出 / 落库 / 校验 四项。问题不在抽屉本身，而在**决策点与信息分离**：用户正在七选一，说明却要开抽屉、看完还得关掉才能对比下一种。

改法：把当前方式的输出形态直接写在卡片里（`输出：…；落库与校验口径相同（必填 / 长度 / 合规 / 来源授权），切换方式不必翻说明。`），删掉「查看该方式说明」按钮与 `creation.modeDetail` 处理函数。结果：该页抽屉 3→2、动作注册 330→329，点选方式即刻看到产物形态。

### 16.3 E-02 `workspace/assistant`：给 15 行表补查询区

全站唯一「有表格但无查询区且最长表 ≥10 行」的页面，表是「可识别的目标类型」15 行（目标类型 / 触发词示例 / 落到流程 / 风险等级）。指令助手的使用场景正是"我想做 X，该怎么描述"，逐行扫 15 条很费劲。

补 `.toolbar` + `input.search[data-filter="q"]` + `[data-filter-count]`（沿用全站既有过滤实现，整页聚合计数）。现在有查询区 10→**11 页**，无查询区且有长表 **1→0 页**。

### 16.4 复核后判定"不改"的项

| 项 | 观察 | 结论 |
| --- | --- | --- |
| `video/preview` 的 `video.toResults` | 点了会 `set(tab=versions)` 再 `go(video/preview)`，即同一页内切 tab，与 tab 控件同目标 | **保留**。它在播放器控制条里（`≡`），场景是"看片中想看版本列表"，与顶部 tab 的"浏览时切换"不同；删掉反而让控制条少一个常用入口 |
| 其余 9 页「承载 ≥4 种」 | 无同名承载冲突、无行内过载、无只读死端 | 归为观察项，`_audit_ux` 继续标记但不作阻断，避免为了指标好看去机械合并承载 |

### 16.5 D-05 / D-09 落地：一条命令 + 一个 CI job

**`tools/check.mjs`**（新增）：串 17 条脚本审计（回归、内链、动作、权限、指标口径、动作重复、项目阻断、命名、按钮、规则卡、文案、密度、布局硬指标、重复功能、承载选择、业务流 18、生命周期 22），每条只断言"收口结论"那一行正则，任一不命中即 `exit 1` 并回显该脚本末 12 行；`_audit_ux` 作观察项只报告不阻断。全量 ~3 秒。

**CI**：`.github/workflows/ci.yml` 新增 `prototype-quality` job（Node 22，`working-directory: prototype/v9`，`node tools/check.mjs`），与既有 backend / frontend / compose / e2e 并列。至此 D-05 完成——不再是"记得逐条跑"，而是每次 push/PR 自动跑。D-09（`_smoke`/`_e2e`/`_pixel` 进 CI）仍需 Chromium 与静态服务，暂留本地。

### 16.6 回归

`node tools/check.mjs` 17/17 PASS；浏览器侧 `_smoke` 56 路由、`_e2e` 37/37、`_pixel` 两档 FAILS=0 且无 need>0 无横滚；24+2 个 js `node --check`（新增 `check.mjs`、`serve.mjs`）通过。快照 `tools/_ia_ux.txt` 已刷新（有标记 10→9 条）。

### 16.7 下一步

| 编号 | 事项 | 判断 |
| --- | --- | --- |
| E-03 | `analytics/enterprise` 12 个指标 + 9 列表一屏铺满（单页 11134 字符，全站最重） | 真问题：12 个并列指标没有主次，建议按「交付 → 质量 → 成本」三组分层，把 12 缩到 8 并留 4 个下钻 |
| E-04 | `orgs/grants` 单卡 76%（9215 字符） | 单卡承载过重，建议拆「授权台账」与「授权申请」两张卡 |
| E-05 | 浏览器三项进 CI（D-09） | 需要 Chromium + `serve.mjs` 起服务；可与 D-05 同一 workflow，成本约 +90 秒 |
| 决策 | `origin/develop` 停在 `fb36f1e`，本地已积 11 个整改提交 | 待拍板：直推 develop 或开 PR 到 main（CI 的 prototype-quality 只有在推送后才会真正跑起来） |
