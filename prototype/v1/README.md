# 系统原型设计 · 短剧智能生产平台

这是一套**可点击的高保真界面原型**，用于评审信息架构、页面职责与交互契约，不连接后端、不写入任何数据。

- 入口：用浏览器直接打开 `index.html`（无需构建、无需服务器）。
- **推荐从 `pages/flow.html` 开始看**：一集短剧拆成 7 步，每步确认输入后点一次生成，模型产出后自动解锁下一步；只有质检后的审核需要人工点通过。
- 基准尺寸：1440×900；≤1024 自动收窄为单列。
- 演示数据：项目「长夜将明」（NYJM-26）等静态样例，页面顶部持续显示「原型演示数据 · 未接后端」。

---

## 1. 原型覆盖的产品主线

```text
创意 → 故事圣经 → 剧集/剧本 → 场次/对白 → 角色/场景/道具
     → 分镜/Shot Contract → Mork 生成 → QA/人工审核
     → 时间线（整数 PTS） → FFmpeg → MP4 交付
```

原型严格沿用仓库现有设计与实施基线中的强制决策：

| 决策 | 在原型中的体现 |
|---|---|
| Project 是授权与数据隔离边界 | 侧栏不提供跨项目入口；资产详情只展示同项目引用；403 状态不等于空列表 |
| 资产版本不可变，引用固定版本 | 资产卡显示 `v2 / v3`；Shot 引用行标 `locked v2`；上游更新只标 `stale_candidate` |
| 审核绑定对象版本、项目级统一权限 | 审核页显示 `subject_version_id`，不出现多级会签、不出现 WAIVED |
| QA 仅 PASS / REVIEW_REQUIRED / FAIL | 审核台的检查结果三级；规则服务故障不得判 PASS |
| 默认 Mork，未配置失败关闭 | 任务页可切换 `PROVIDER_NOT_CONFIGURED` 演示态，不回退 Mock |
| 时间权威值为整数 PTS + 有理数 time_base | 时间线片段属性展示 `{ pts }` 与 `{ num, den }`，不出现浮点秒字段 |
| 导出绑定不可变快照 | 导出页显示「快照已冻结」，失败不提供半成品下载 |

明确不做（原型中也不出现入口）：第三方系统/Webhook/爬虫接入、版权管理、跨项目资产共享、多级会签、质量豁免、专业 NLE、实时多人协同、SaaS 计费。

## 2. 目录结构

```text
prototype/
├── index.html                 # 原型总览：信息架构 + 页面索引 + 设计令牌
├── README.md                  # 本文件：怎么用、覆盖了什么、怎么扩展
├── DESIGN_SPEC.md             # 设计说明：页面职责、交互契约、状态规则、API 映射
├── assets/
│   ├── prototype.css          # 设计令牌 + 公共组件（唯一视觉来源）
│   ├── prototype.js           # 外壳渲染（侧栏/顶栏/项目页签）+ 展示原语
│   └── interactions.js        # 交互层：状态变更、抽屉回填、表单总线、sessionStorage
└── pages/
    ├── login.html             # 01 登录与会话
    ├── dashboard.html         # 02 企业工作台（含快捷入口）
    ├── projects.html          # 03 项目空间
    ├── users.html             # 04 成员
    ├── roles.html             # 05 角色与权限
    ├── organizations.html     # 06 部门与组织
    ├── flow.html              # 00 制作流程（7 步模型生成向导 · 推荐入口）
    ├── project-overview.html  # 07 生产概览（项目上下文起点）
    ├── stories.html           # 08 故事圣经
    ├── episodes.html          # 09 剧集与剧本
    ├── assets.html            # 10 资产库
    ├── storyboards.html       # 11 分镜与镜头
    ├── tasks.html             # 12 AI 任务
    ├── reviews.html           # 13 质量与审核
    ├── editor.html            # 14 时间线
    ├── exports.html           # 15 成片导出
    ├── ideas.html             # 16 创意与立项
    ├── workflows.html         # 17 生产流水线
    ├── providers.html         # 18 能力与 Provider
    ├── usage.html             # 19 用量与成本
    ├── audit.html             # 20 审计日志
    ├── settings.html          # 21 项目设置
    └── states.html            # ★ 交互状态规范（含页面×状态矩阵）
```

> 22 个业务页面 + 1 个状态规范页。项目上下文页面（`data-project="1"`）共享 13 项模块页签。

## 3. 页面与仓库路由 / API 域对照

| 原型页面 | 目标路由（保留现有 `web/src/router` 路径） | 主要 API 域 |
|---|---|---|
| login | `/login` | `auth`（login / refresh / logout / me） |
| dashboard | `/dashboard` | `projects`、`generation`、`audit` 只读聚合 |
| projects | `/projects` | `projects`、`project_members` |
| users | `/users` | `users`、`roles` |
| roles | `/roles` | `roles`（`PERMISSION_CATALOG` / `ROLE_TEMPLATES`） |
| organizations | `/organizations` | `organizations`、`departments`、`members` |
| flow | `/projects/:id/flow`（新增） | `workflow-runs` 聚合：按步骤串起 `creation`、`generation`、`quality`、`exports` |
| project-overview | `/projects/:id/overview`（新增） | `projects` + 各域汇总 |
| stories | `/projects/:id/stories` | `creation`（Story / StoryBible） |
| episodes | `/projects/:id/episodes` | `creation`（Episode / Script / Scene / Dialogue） |
| assets | `/projects/:id/assets` | `assets`（Asset / AssetVersion / download） |
| storyboards | `/projects/:id/storyboards` | `creation`（Storyboard / Shot / ShotContract） |
| tasks | `/projects/:id/tasks` | `generation`（Task / Attempt / cancel） |
| reviews | `/projects/:id/reviews` | `quality`、`reviews`、`rework`（目标接口） |
| editor | `/projects/:id/editor` | `timelines`（目标接口） |
| exports | `/projects/:id/exports` | `assets` 现有导出入口 → `exports`（目标接口） |
| ideas | `/projects/:id/ideas`（新增） | `creation`（Idea / Greenlight）目标接口 |
| workflows | `/projects/:id/workflows`（新增） | `workflow-runs`、`workflow-runs/:id/nodes` |
| providers | `/providers`（新增） | `/models/providers`、`/models/capabilities`（目标） |
| usage | `/usage`（新增） | `usage`、`budgets`（目标接口） |
| audit | `/audit-logs` | `audit-logs`（只追加，支持筛选） |
| settings | `/projects/:id/settings`（新增） | `projects`（PATCH）、`project_members`、`export-profiles` |

> `reviews / timelines / exports` 在仓库当前基线中仍是原型或待建设（见 `docs/04-api/API_COVERAGE_MATRIX.md`）。原型中这些页面是**目标契约**，不是已交付能力的证据。

## 4. 交互说明（评审时可直接点）

原型分两层：**能点开**（导航、抽屉、弹窗）与**点了会变**（状态、计数、列表、文件下载）。所有变更只发生在浏览器内存与 `sessionStorage`（键 `sp_proto_v2`），刷新或跨页仍可回放，不写后端。

- **导航**：侧栏 → 顶栏项目选择器 → 13 项模块页签；项目页签只在带项目上下文的页面出现；`/` 聚焦搜索，`Esc` 关闭浮层，`Ctrl/Cmd+S` 触发 `data-save` 保存按钮。
- **制作流程（新增）**：7 步一条线，每步显示模型、能力、输入与预计费用；点「生成此步」按模型耗时推进 `待生成 → 生成中 → 已生成`，成功后自动解锁下一步；「一键跑完整集」串行执行并在人工审核处停下；质检通过后点「审核通过」才解锁导出，退回则重新质检；画幅改成 `16:9` 生成会返回 `QA_FRAME_RATIO_MISMATCH`，按提示改回 `9:16` 可重跑；点产物行打开调用明细抽屉。流程状态存于 `sessionStorage`（键 `flow_state_v1`），「重置演示」恢复初始 3/7。
- **项目空间**：新建项目校验编码唯一（重复返回 409）；新项目以 `draft` 插行、计数 +1 并持久化。
- **创意与立项**：创意池 master-detail 切换；通过立项 / 退回改状态并更新统计；AI 扩写与新建创意弹窗。
- **剧集与剧本**：场次视图 / 剧本原文可切换；保存剧本生成 v6 及版本历史新条目（旧结论不继承）。
- **资产库**：上传抽屉提交后插卡（`processing` → 2.6s 后 `ready`），类型与总数同步；重复资产返回 409。
- **分镜与镜头**：镜头卡切换 Shot Contract 六个字段；修订合同版本 +1 并清 `stale`；提交生成任务插入 queued Attempt 并改镜头状态。
- **生产流水线**：运行列表切换节点 DAG；暂停 / 恢复 / 取消改变 Run 状态与统计；新建 run 入列。
- **AI 任务**：取消走 `cancel_requested → cancelled`；重试 Attempt +1；新建任务插行；运行中计数同步。
- **质量与审核**：通过 / 拒绝校验结论与原因，FAIL 不可通过；队列项、计数与药丸同步更新；拒绝后可转返工。
- **时间线**：片段点击回填属性面板；`−1 / +1 帧` 改 PTS 与片段位置；保存生成 `tl_v5`。
- **成片导出**：新建导出校验时间线快照（重复 409）；任务走 `queued → rendering → validating → succeeded`；完成后可下载 manifest。
- **能力与 Provider**：点行回填配置表单；保存改变行状态与已配置计数；测试连接按是否缺 `secret_ref` 返回不同结果。
- **用量与成本**：区间切换重算成本与占比；预算保存 / 恢复；CSV 为真实文件下载。
- **审计日志**：关键词 + 操作人 + 结果筛选；点行回填详情抽屉（含 JSON payload）；导出当前筛选结果 CSV。
- **项目设置**：六个分页切换；成员添加、Profile 新建、危险操作需输入项目名确认。

## 5. 设计语言

| 维度 | 取值 |
|---|---|
| 画布 | 暖中性纸面 `#f4f2ee`，卡片纯白，导航近黑 `#14181d` |
| 强调色 | 深青 `#0e6b63`，只用于主操作、当前页签、关键数字 |
| 状态色 | PASS 绿 / REVIEW 琥珀 / FAIL 砖红 / PROCESSING 蓝，仅表状态 |
| 字阶 | display 30 → h2 17 → body 13 → mono 10，数字与时码统一等宽 |
| 圆角 | 容器 3px、控件 7px、状态药丸 999px（三个角色值） |
| 阴影 | 只给抽屉与弹窗，卡片靠 1px 描边分隔 |
| 栅格 | 版心 1360，卡片缝 14px；表格行高 44 左右，密度优先 |

字体使用系统字体栈（Inter → PingFang SC → Microsoft YaHei），不依赖网络字体，离线可评审。

## 6. 如何扩展

1. 新增页面：复制任一 `pages/*.html`，改 `body` 的 `data-page` 与 `data-project`；`assets/prototype.js` 的 `NAV / TABS / CRUMB` 各加一条。
2. 新增组件：只在 `prototype.css` 里加类，页面不写内联样式（仅少数一次性布局例外）。
3. 新增状态：在 `states.html` 增加卡片，并同步更新页面 × 状态矩阵。
4. 新增交互：页面写 `form[data-form="name"]` 与 `[data-act="name"]`，在页内监听 `proto:submit` / `proto:act`；通用回填只需 `[data-open]` + `[data-bind]`。
5. 修改设计令牌：只改 `:root`，页面不需要逐个调。

## 7. 与原型的边界

- 页面上的新建、审核、导出等操作**只改浏览器内演示状态**，不代表后端已存在对应能力；刷新后仍在是因为 `sessionStorage`，关掉标签页即清空。
- 不提供 `file://` 之外的部署方式；纯静态，可整目录拷贝给评审方。
- 与真实前端的关系：原型是界面契约与验收参照，正式实现仍在 `web/src` 内完成，页面路径不因原型而变更。
