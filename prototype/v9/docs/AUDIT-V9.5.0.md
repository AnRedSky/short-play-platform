# V9.5.0 原型优化说明：全链路落地、菜单链路校验与体验收口

审查对象：`prototype/v9`，17 个模块、65 条路由、309 个注册动作。默认身份 `i-owner`（林知远，项目负责人），默认当前项目 `SP-26031《雾城来信》`（24 集 / 432 镜，生产中）。

本轮不是单页美化，而是按真实短剧生产顺序把「项目 → 创意 → 方案 → 剧本 → 审核 → 拆解 → 资产 → 计划 → 生产 → 字幕 → 质检 → 终审 → 交付 → 归档」做成可连续操作的数据闭环，并把项目上下文、空态、回退、跳转与反馈统一到同一套规则。

## 一、调整点清单

### 1. 项目上下文与空态阻断

- 新增 `UI.projectGuard(kicker, note)`：统一渲染「项目不在可见范围」、返回项目列表按钮与空状态说明；26 个项目域页面复用同一阻断样式，不再各自拼空表。
- 清除 11 处 `App.currentProject(query) || { id: "", ... }` 空项目回退：`creation/brief`、`creation/plan`；`audio/dialogue|voice|bgm|subtitle`；`post/timeline|episodes|review|delivery|versions`。无项目时不再渲染空表、不再借用其他项目数据。
- `projects/workflow` 的项目解析改为只认 `data-pid` 或 `App.currentProject()`，并校验 `Derived.canViewProject`；新增 `wfNeed(el)` 统一阻断。`wfOpen / wfBrief / wfGoReview / wfGenerateScript / wfApprove / wfBreakdown / wfAssets / wfFreeze / wfBatch / wfTimeline / wfSubtitle / wfFinishPost / wfQcAll / wfFinal / wfDelivery / wfRights / wfArchive / wfBudget / wfResume / wfQuality / wfEpDetail` 等动作不再在无项目时访问空对象。
- `projects.pause` 不再从可见项目里任意找「已暂停」项目，必须有 `data-id` 或当前项目，并再次校验可见性。
- 创意动作全部收口：`regenPlan / generateScript / submitReview / approveScript / rejectScript / editScript / partialScript / rerunBreakdown / deriveBrief / choosePlan / openBrief / briefTrace / openScript / lock` 均要求项目或对象存在，并校验所属项目可见；不再跨项目取「第一个待审核剧本」或「第一个锁定版本」。
- 统一「返回项目列表」动作 `common.projects`，阻断页、项目页与失败提示都可回到项目列表。

### 2. 项目切换与回流

- 顶栏项目上下文新增 `切换` 与 `流水线`：`切换` 打开右侧抽屉，按 `Derived.visibleProjects()` 列出项目名、编号、状态、负责人；`流水线` 直接回 `projects/workflow?id=<pid>`，当前页就是流水线时自动隐藏。
- `common.useProject` 保持当前菜单路径，只替换 `id` 查询参数，不再强制回首页；切换后页面重新校验项目与数据。
- 新增 `common.switchProject`、`common.useProject` 与 `.ctx-actions / .ctx-btn / .ctx-link / .ctx-list / .ctx-row` 样式；1280 宽度顶栏不溢出。

### 3. 全链路 1:1 落地

- **新建项目**：正式创建后跳 `projects/workflow`，下一步直接填写创意设定；保存草稿仍进 `projects/detail`，保留草稿查看。避免「创建成功停在一张详情页，不知道怎么继续」。
- **剧本审核通过**：`creation.approveScript` 成功后跳 `projects/workflow`，与流水线内审核动作一致；下一步由流水线给出拆解入口，不再跳详情页。
- **首页生产链路**：8 个阶段由静态 `div` 改为可点击 `a`，映射 `creation/script → creation/breakdown → director/plan → video/production → audio/subtitle → quality/reports → post/review → post/delivery`，均携带当前项目 id。
- **剧本工作台**：默认集从硬编码第 17 集改为「当前项目第一个未通过集」；`SP-26031-V4` 的正文样本用数据标记 `studioSample` 控制，不再写死项目 id；其他项目展示真实版本规模与分集覆盖，不伪造正文。无剧本时按项目状态给出「去选定方案 / 生成候选剧本 / 查看制作流水线」入口。
- **导演规划**：项目尚未到「生产准备中」时，主按钮按阶段改为「先选定创意方案」或「先完成剧本审核」，不再只给一个「返回项目」。
- **剧本版本比对**：从固定「V4 vs V3」文案改为读取当前剧本与同项目上一版本，按场 / 镜 / 行实际差值展示，并引用版本说明。
- **版本链**：`post.newVersion` 增加来源项目可见性校验，只有已交付 / 已归档项目可新建 V2。

### 4. 数据一致性与状态隔离

- 创意设定「输入方式」状态按项目隔离为 `briefMode:<pid>`，切换项目不再把上一个项目的「当前方式」带过来；方式说明抽屉同步读取当前项目状态。
- 声音档案补齐 `project` 字段；`audio` 的音色档案、对白重生成、替换音色、新建档案全部按项目过滤，不再按角色名跨项目匹配。
- 预算调整 / 追加预算去掉缺省 `SP-26031`，必须由预算行上下文提供 `name`，否则阻断。
- 离职与移交预览不再固定取 `SP-26015`，改为取候选列表首项。
- 首页「当前项目」优先取当前上下文项目，其次生产中项目，最后可见项目；不再固定回退 `SP-26031`。
- 持久化加载增加静态字段迁移：版本升级时只补 `studioSample`、`project` 等缺失静态字段，不覆盖用户已产生的业务状态；`DB.meta.version` 随版本更新，已有业务现场不被重置。

### 5. 布局与交互反馈

- `creation/brief` 的「版本记录」卡片从右栏移入左栏「当前创意设定」之后，左侧不再出现约 250px 的整块空白；左右栏底部高度接近，信息密度更均衡。
- 剧本工作台补「返回流水线」，避免只能靠侧栏回项目；顶栏「切换 / 流水线」对所有项目页生效。
- 无上下文、无权限、无对象、状态不符、预算不足、依赖未完成等场景统一 toast / 阻断页 / 空态文案，不再静默失败。
- 动作按钮保持「可执行才显示、不可执行给原因」：已交付项目冻结生产与重跑；未质检镜头不进入时间线；缺授权素材阻断交付。

## 二、菜单与跳转校验

owner 当前为 **16 个可见分组、47 条可见链接**；`projects/new`、`projects/detail`、`orgs/member` 为上下文页，不进一级菜单。

| 分组 | 入口 | 关键数据与跳转 |
| --- | --- | --- |
| 我的工作台 | 工作台首页 / 我的项目 / 指令式生产助手 | 首页取当前项目，待决策只取本人待处理通知；生产链路 8 阶段可点击并带项目 id |
| 项目中心 | 项目列表 / 制作流水线 / 生命周期与状态机 | 列表 → 流水线 / 项目档案；流水线 8 阶段 → 对应业务页；新建项目 → 流水线 |
| 创意与剧本 | 创意设定 / 创意方案 / 剧本版本 / 剧本审核 / 剧本拆解 | 设定 → 方案 → 剧本 → 审核 → 拆解，全部按 `id` 跳转；无剧本时给阶段 CTA |
| 导演规划 | 镜头计划 / 人物档案 / 场景道具 / 镜头契约 / 分镜板 | 计划从锁定剧本与已确认资产派生；未到阶段给回剧本 / 回方案入口 |
| 视频生产 | 生产队列 / 生成结果 / 预览校验 | 队列按项目任务派生；空队列回分镜板或新建批次；预览不伪装真实媒体 |
| 音频与字幕 | 对白配音 / 声音档案 / 配乐音效 / 字幕口型 | 对白、音色、BGM、字幕均按项目与集次过滤；已交付只读 |
| 后期与剪辑 | 时间线 / 分集成片 / 版本链 | 时间线按集多轨；未质检 / 标脏阻止输出；版本链保留 V1 交付包 |
| 质量与返工 | 质量门禁 / 质量报告 / 返工台账 | 报告按项目派生；接受现状需理由；合规类返工不允许自动重跑 |
| 审核与交付 | 最终成片审核 / 交付包 / 作品库 | 生产中项目不暴露终审 / 交付动作；交付门禁按集数、质检、授权、预算、标脏逐项校验 |
| 任务与队列 | 生产任务 / 资源池 / 尝试记录 | 任务按可见项目聚合；批量重试、暂停队列带项目范围；终态任务不显示取消 |
| 资产库 | 资产库 / 引用与使用关系 | 八类资产按版本登记；删除前查引用；详情按资产所属项目鉴权 |
| 模型与资源 | 资源配置 | 按当前 `userId` 计算个人 / 企业资源；测试写回时间与状态；无权限不能代替归属人更新凭据 |
| 成本与预算 | 成本台账 / 预算阈值 / 用量计量 | 预计、实际、失败成本分列；预算不得低于已用；阈值触发提醒或暂停 |
| 通知与异常 | 待办与通知 / 异常中心 | 通知跳业务页自动补项目 id；非成员项目通知不展示；异常可转待办、升级、闭环 |
| 经营分析 | 我的数据 | 项目、集数、镜头、预算、成本、质检、返工按可见范围实算；只读 |
| 合规与审计 | 权利授权 / 风险异常 / 审计日志 | 授权登记来源、范围、期限；过期阻断交付；审计按项目与操作者过滤 |

页面跳转规则：

1. 项目页优先 `?id=`；无 id 用当前可见项目；不可见 id 直接阻断，不回退到 `D.projects[0]`。
2. 全局页（任务、资产、成本、通知、合规、作品库）只聚合可见项目；进入具体业务页才携带项目 id。
3. 平台页（模型供应商、路由策略、组织管理）不带项目上下文，按角色权限独立访问。
4. 动作按钮必须携带 `pid / id / ep / task / report / asset` 等定位参数；动作层再次校验项目与对象归属。
5. 上下文页（`projects/new`、`projects/detail`、`orgs/member`）只能由业务动作进入，不占一级菜单。

## 三、逻辑校验结果

| 检查 | 方法 | 结果 |
| --- | --- | --- |
| 路由渲染 | `node tools/regress.mjs` | 17 模块 / 65 路由通过；owner 49 / 65、staff 41 / 65、admin 32 / 65、dept 24 / 65、auditor 24 / 65、ops 4 / 65 |
| 动作注册 | `node tools/_audit_actions.mjs` | 309 注册 / 254 引用 / 0 未注册 |
| 权限定义 | `node tools/_audit_perms.mjs` | 34 权限定义 / 22 守卫码 / missing none；owner 15 / 21 |
| 重复动作 | `node tools/_audit_dups.mjs` | 309 动作 / 0 重复注册 |
| 内链与动作 | `node tools/_audit_links.mjs` | 65 路由 / 16 内链 / 492 动作引用 / 0 失效内链 / 无「无跳转且无动作」页面 |
| 无项目阻断 | `node tools/_audit_project_guard.mjs` | 26 个项目域页面 26 / 26 阻断，均具备返回项目列表入口 |
| 流程断言 | `node tools/flow.mjs` | 18 / 18 通过 |
| 全链路验收 | `node tools/_journey.mjs` | 22 / 22 通过，最终「已归档」 |
| 浏览器冒烟 | `_smoke.html` | 65 路由无 JS 错误、无 `undefined/NaN/[object Object]`，角色切换权限提示正常 |
| 浏览器端到端 | `_e2e.html` | 28 / 28 PASS（创建后跳转断言已同步为 `projects/workflow`） |

### 26 个项目域阻断覆盖

- `creation/brief`、`creation/plan`、`creation/script`、`creation/review`、`creation/breakdown`
- `director/plan`、`director/cast`、`director/world`、`director/shots`、`director/storyboard`
- `video/production`、`video/results`、`video/preview`
- `audio/dialogue`、`audio/voice`、`audio/bgm`、`audio/subtitle`
- `post/timeline`、`post/episodes`、`post/review`、`post/delivery`、`post/versions`
- `quality/gates`、`quality/reports`、`quality/rework`
- `projects/workflow`

### 全链路 22 项验收（4 集新项目 `SP-26032`）

| 阶段 | 实际结果 |
| --- | --- |
| 创建项目 | 4 集 / 预算 ¥12,000，生成 `SP-26032` |
| 创意设定 | 40+ 字意图提交，生成 `CB-26032-01` 并启动方案 |
| 创意方案 | 生成 `CP-26032-A`，自检分与风险可比较 |
| 选定方案 | 项目进入「剧本创作中」 |
| 生成剧本 | `SCR-26032-V1` 候选，规模随 4 集生成 |
| 审核锁定 | 进入「生产准备中」 |
| 拆解 | `PP-26032-V1`，4 集 / 72 镜 |
| 确认资产 | 3 人物 + 3 场景 + 1 道具全部「已确认」 |
| 固化计划 | 进入「生产中」 |
| 批量生产 | 1–4 集 / 72 镜完成，扣费 ¥2,721.6 |
| 首次后期 | 被字幕未校对阻断，明确提示第 1–4 集 |
| 字幕校对后后期 | 4 集合成完成，进入「质量检测中」 |
| 整集质检 | 4 集通过 |
| 终审 | 通过，进入「已完成」 |
| 生成交付包 | `DP-26032-01`，待确认冻结 |
| 确认交付 | 交付完成，版本冻结 |
| 归档 | 项目「已归档」，资产转只读 |

首次后期拦截证明：门禁不是装饰，字幕未校对时不给出成功结果；第二次通过证明状态回写后可继续，不需要手工改数据。

## 四、体验优化明细

| 问题 | 优化前 | 优化后 |
| --- | --- | --- |
| 无项目 / 不可见项目 | 页面渲染空表或借用其他项目 | 统一阻断页，说明原因并回项目列表 |
| 项目页无法切换 | 只能回列表再进目标项目 | 顶栏「切换」抽屉，保持当前菜单只换 id |
| 回流水线路径长 | 需从侧栏或列表绕回 | 顶栏「流水线」一键回流，阶段页再带 id |
| 新建项目后断点 | 停在项目详情，无下一步 | 正式创建直接进流水线，下一步填写创意 |
| 剧本审核后断点 | 跳项目详情，需再找拆解 | 跳流水线，直接给拆解与后续阶段 |
| 首页链路不可点 | 8 个阶段是静态展示 | 每个阶段可点击并带项目 id |
| 创意页左侧大块空白 | 右栏版本记录，左栏短 | 版本记录移左栏，左右高度接近 |
| 新项目剧本页无入口 | 只显示「还没有剧本版本」 | 按状态给「去选方案 / 生成剧本 / 回流水线」 |
| 未到规划阶段 | 只给「返回项目」 | 按状态给「先选方案 / 先审剧本」 |
| 剧本比对是假数据 | 固定 V4 vs V3 文案 | 读取同项目上一版本，按实际差值展示 |
| 输入方式跨项目串状态 | 全局 `briefMode` | 按 `briefMode:<pid>` 隔离 |
| 音色跨项目匹配 | 按角色名全局找 | 按项目 + 角色匹配，音色档案有 `project` |
| 首页当前项目随机 | 固定 `SP-26031` 兜底 | 当前上下文 → 生产中 → 可见项目 |
| 旧快照缺新字段 | 升级后正文样本 / 项目归属丢失 | 只补静态字段，不覆盖业务状态 |

## 五、开发对接说明

### 路由与参数约定

- 项目页统一 `#/<module>/<page>?id=<projectId>`；集次用 `&ep=`，任务用 `&task=`，报告用 `&report=`，资产用 `&asset=`。
- 全局页不强制项目 id；从全局页进入业务页时，由动作按对象所属项目补 id。
- 平台页不读项目上下文；`models/providers`、`models/routing`、`orgs/*` 只按角色权限控制。
- 隐藏上下文页：`projects/new`、`projects/detail`、`orgs/member`；新增入口应通过业务动作，不要直接加菜单。

### 数据与状态机

项目状态顺序：`草稿 → 创意策划中 → 剧本创作中 → 待剧本审核 → 生产准备中 → 生产中 → 后期制作中 → 质量检测中 → 待最终审核 → 已完成 → 已交付 → 已归档`。暂停/恢复是项目内独立状态，不改变主流程阶段；交付后版本冻结，只能新建 V2。

关键数据对象：`projects / briefs / creativePlans / scripts / episodes / shots / characters / locations / props / timelines / dialogues / voiceProfiles / subtitles / lipSync / reports / reviews / deliveries / tasks / assets / costs / notifications / rights / audit`。动作通过 `Store.ops` 写状态并记审计，页面只读投影。

### 持久化

- 键继续使用 `shortplay.workbench.v937`，快照版本 `930`，不因 9.5.0 清空本地数据。
- 启动时先恢复快照，再补静态字段（如 `studioSample`、`voiceProfiles[].project`），并同步 `DB.meta.version`；用户已产生的任务、成本、审核与交付状态不被覆盖。
- 恢复初始数据仍走右上角「恢复初始数据」或控制台 `Store.reset(); location.reload()`。

### 仍为静态原型的部分

- 视频预览、音频试听展示关键帧与参数，不接真实媒体流。
- `common.export` 仍导出页面第一个表格；项目台账、作品清单等无表格或跨数据集页面尚未做定制导出。
- 任务中心默认保留「全部可见项目」与项目范围双态；通知「未读」统计全部可见通知，未拆「我的未读」。
- `quality/reports`、`post/versions`、`video/preview` 是否长期保留一级菜单，待产品确认。
- 以上不影响本轮业务链路、权限、门禁与状态机的验收，但开发对接时需按真实后端能力替换。

## 六、截图

- `docs/workflow-950.png`：9.5.0 制作流水线全页，8 阶段、289 / 432 镜、16 / 24 集、交付门禁未通过。
- `docs/brief-950.png`：9.5.0 创意设定全页，版本记录已移左栏，左右栏高度收口。
- `docs/script-950.png`：9.5.0 剧本工作台，第 17 集场次 / 稿纸 / 人物连续性三栏。

## 七、复验命令

```bash
node tools/regress.mjs
node tools/_audit_actions.mjs
node tools/_audit_perms.mjs
node tools/_audit_dups.mjs
node tools/_audit_links.mjs
node tools/_audit_project_guard.mjs
node tools/flow.mjs
node tools/_journey.mjs
```

浏览器：

```text
http://localhost:4190/_smoke.html?cb=<n>
http://localhost:4190/_e2e.html?cb=<n>
```

修改后需带新的 `?cb=` 并硬刷新，避免旧模块缓存。
