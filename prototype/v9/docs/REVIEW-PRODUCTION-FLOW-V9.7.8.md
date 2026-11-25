# 短剧制作全流程深度评估报告（V9.7.8）

评估对象：`prototype/v9` 短剧制作一级菜单下 **26 个菜单节点**（另含隐藏页 `projects/detail` 与链路必经的 `assets/library`），版本 9.7.8。
方法：**静态建图（按真实动作函数体）+ 逐页浏览器实测 + 端到端业务流实测** 三类证据交叉，不靠人工肉眼通读。

---

## 0. 一句话结论

**功能与状态机是完整的，问题集中在"承载位置"和"入口拓扑"**：所有"关口动作"（审核通过 / 退回 / 终审 / 交付）都不在业务页，而集中在一张枢纽页 `projects/workflow`；节点页之间几乎没有前后置衔接，形成"星形"而非"链形"流程；另有 3 个节点是死端。同时本轮查出并修复了一个 P0 级交互缺陷：**所有弹窗的主按钮在鼠标点击时不触发提交**。

| 维度 | 结论 | 判定 |
| --- | --- | --- |
| 1 功能完整性与实现逻辑 | 329 个动作全部已注册（0 未注册）；状态条件动作正确显隐；但 3 页缺本节点决策动作、1 处审核清单"只看不能用" | 合格偏弱 |
| 2 页面间交互流畅度 | 25 页首帧 ≤37ms，仅 `director/shots` 144ms；弹窗/抽屉开关 462 次 0 失败 | 良好 |
| 3 链路连续性与闭环 | 交付闭环成立（交付门禁未过会被拦截），但 17/26 节点从立项可达，3 个死端，9 个只能靠枢纽页进入 | **不合格** |
| 4 弹窗触发与关闭逻辑 | 关闭 4 通道全通、无重复弹出、无误关；但 P0 提交缺陷（已修） | 修复后良好 |
| 5 跳转路径合理性 | 无死循环、LEGACY 10 条无环；3 处同页重复入口 | 合格偏弱 |

---

## 1. 评估范围与方法

### 1.1 页面范围（26 节点）

| 阶段 | 节点 |
| --- | --- |
| 立项与项目 | `projects/new`、`projects/list`、`projects/workflow`、`projects/lifecycle` |
| 创意与剧本 | `creation/brief`、`creation/plan`、`creation/script`、`creation/review`、`creation/breakdown` |
| 导演与视觉 | `director/plan`、`director/cast`、`director/world`、`director/shots` |
| 视频生产 | `video/production`、`video/preview` |
| 音频与字幕 | `audio/dialogue`、`audio/voice`、`audio/bgm`、`audio/subtitle` |
| 后期与交付 | `post/timeline`、`post/episodes`、`post/review`、`post/delivery`、`post/versions` |
| 质量与返工 | `quality/reports`、`quality/rework` |
| 链路必经（菜单外） | `assets/library` |

### 1.2 证据来源

1. **静态建图**：新增 `tools/_audit_chain.mjs`，载入真实模块，按每个动作处理器的函数体抽取 `App.go("…")`（跳转）、`App.modal/confirm/drawer`（弹窗/抽屉）、`App.set`（状态切换），生成页面级有向图与承载分布。
2. **逐页浏览器实测**：1280×800 下逐页渲染，清点按钮/字段/表格，逐一点开"详情/历史/说明"类承载并验证关闭；单页最多 868 个按钮。
3. **端到端业务流实测**：立项提交（空值/填值）、剧本审核通过（弹窗 → job → 状态推进 → 自动跳转）、返工重跑拦截、tab 状态持久化。

---

## 2. 分维评估结论

### 2.1 功能完整性与实现逻辑

- **动作注册 329 个，0 未注册**（`check.mjs` 复核），页面引用的动作都能落地，没有"点了报未实现"的情况。
- **状态条件显隐正确**：`creation/review` 在 `SP-26028`（待剧本审核）显示 通过 / 退回 / 终止；在 `SP-26031`（生产中）只显示记录类入口。这是设计意图，不是缺陷。
- **但 3 个业务页缺少本节点的决策动作**：
  - `creation/review` 只有 5 个按钮，7 项「审核清单」是**纯展示 checkbox**（无 `data-action`、无 name、无提交）——勾选不落库；
  - `post/review` 只有 3 个按钮，全部指向 `projects.wfOpen/wfFinal`，页面内没有"通过交付 / 指定返工 / 退回后期 / 终止交付"这四种结论的动作；
  - `post/delivery` 只有「交付清单」抽屉，生成/确认交付的按钮不在本页。
- **立项页字段密度**：22 个字段、11 个必填单页平铺；空提交只提示"有 3 项需要修正后再创建"，不指明是哪 3 项（字段有 `aria-invalid`，但无字段名清单）。

### 2.2 页面间交互流畅度

| 指标 | 实测 |
| --- | --- |
| 首帧渲染 | 24 页 13–37ms；`director/shots` **144ms**（432 行 × 868 按钮） |
| 弹窗/抽屉开关 | 462 次开启，关闭失败 **0** |
| 关闭通道 | ✕ / 取消 / ESC / 点背板 四通道全部有效；点弹窗内部空白不会误关 |
| 重复弹出 | 抽屉连点 2 次，`aside.drawer` 仍为 1（不叠加） |
| 执行反馈 | 提交后出现 job 面板（标题、步骤、进度），完成后自动刷新，无需手动重载 |
| 执行中防重 | job 期间底层按钮 **未 disabled**（靠 `.job-mask` 遮挡；键盘/Tab 仍可触达） |

### 2.3 功能链路连续性与闭环

**拓扑判定：星形，不是链形。** `projects/workflow` 一个页面扇出到 `creation/brief`、`creation/review`、`audio/subtitle`、`director/shots`、`video/production`、`quality/reports`、`post/delivery`（`wfBrief`/`wfGoReview`/`wfSubtitle`/`wfToShots`/`wfToProduction`/`wfToQuality`/`wfDelivery`），其余 25 页之间只有零散单向跳转。

- **从立项出发可达 17/26**（样本 `SP-26031` 生产中）；`creation/brief`、`creation/plan`、`director/cast`、`director/world`、`audio/dialogue`、`audio/voice`、`post/timeline`、`post/episodes`、`projects/lifecycle` 只能靠侧栏或枢纽页在对应状态才出现入口。
- **死端 3 个**：`director/world`、`director/shots`、`audio/subtitle` —— 页面内没有任何指向其他页面的出边，用户到页后只能靠侧栏离开。
- **零入边 1 个**：`director/cast` 只能从菜单进入，`director/plan` 的"人物档案"入口不存在（只有 场景道具 / 去视频生产 / 分镜板）。
- **交付闭环成立**：`post/delivery` 距立项 3 跳；交付门禁未通过时 `wfDelivery` 会用 toast 拦下并列出未过项（已实测）。
- **审核闭环成立但位置错**：通过后 `SP-26028` → 「生产准备中」→ 自动跳 `projects/workflow`；用户被带离审核现场，无法在审核页看到下游结果。

### 2.4 弹窗触发时机与关闭逻辑

**P0-01（已修，本轮）**：弹窗的 `.modal-backdrop` 带 `data-action="common.backdrop"`，而点击事件用 `e.target.closest("[data-action]")` 委托 —— 弹窗内**任何没有 data-action 的控件**（提交按钮、勾选框、输入框）都会命中祖先 backdrop，被 `e.preventDefault()` 吞掉：

- 表单 `submit` 永不触发 → 点「通过并锁定」无任何反应、无报错、弹窗不关；
- 勾选框点不动（默认行为被阻止）。

复现（修复前）：`#/creation/review?id=SP-26028` → 点「通过并锁定正式版本」→ 填 退回位置/说明 → 点底部「通过并锁定」→ 无反应；只有按 Enter 或 `form.requestSubmit()` 才能提交。**`_e2e.html` 一直用 `requestSubmit()` 提交，因此 37 条断言全部绕过此缺陷。**

修复：backdrop 仅在"点背板本身"时生效（`if (name === "common.backdrop" && e.target !== el) return;`）。修复后实测：真实 click → job 面板 → 状态 `待剧本审核` → `生产准备中` → 自动跳 `workflow`；勾选框可点；`_e2e` 新增 3 条断言锁死该回归。

**其余判定**：触发时机正确（按状态/权限显隐）、无误触发、无重复弹出、无无法关闭；同名弹窗 1 处（`creation.partialScript` 在 `creation/script` 与 `creation/review` 触发，同一实现、不同场景，建议保留但统一副标题）。

### 2.5 页面跳转路径合理性与体验

- **无死循环**：LEGACY 10 条转发均指向现存页且无环；tab 切换不产生导航。
- **重复入口 3 处**：`post/review` 的 `projects.wfOpen` ×2（"打开制作流水线" + "去流水线"）；`creation/plan` 的 `creation.toScript` ×2；`assets/library` 的 `assets.upload` ×2。
- **返回逻辑**：全部依赖面包屑 + 侧栏 + 浏览器后退；页面级"返回项目列表"只在 guard 态出现，正常态没有显式返回入口（勉强可接受，但跨项目下钻后返回目标不明确）。
- **无意义跳转**：0（没有点了不改变状态也不导航的空动作）。

---

## 3. 问题清单（可直接进迭代）

| 编号 | 等级 | 页面 | 问题 | 复现步骤 | 影响范围 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| P0-01 | P0 | 全部弹窗（31 处） | 主按钮点击被 backdrop 吞掉，表单不提交；勾选框点不动 | 打开任一弹窗 → 鼠标点底部主按钮 → 无反应（Enter 可提交） | 所有写操作弹窗（审核、交付、批次、授权…） | **已修**：backdrop 只对背板生效；e2e +3 断言 |
| P1-01 | P1 | `post/review` | 四种审核结论（通过交付/指定返工/退回后期/终止交付）只在表格里描述，页面无对应动作，全部导向 `workflow` | 进入页面 → 顶部只有"打开制作流水线/审核记录" | 终审环节无法在审核现场闭环 | 页内提供 4 个结论动作（复用 `wfFinal`/`wfQuality` 状态机），枢纽页保留批处理 |
| P1-02 | P1 | `post/delivery` | 无"生成/确认交付"动作，仅交付清单抽屉 | 进入页面 → 只有 版本与修订 / tab / 交付清单 | 交付节点无法从本页闭环 | 增加交付动作（门禁不过时按项列出） |
| P1-03 | P1 | `creation/review` | 7 项审核清单是纯展示 checkbox，勾选不落库，也无"提交清单结论" | 勾选任意清单项 → 刷新 → 勾选状态消失 | 审核口径无法留存 | 清单绑定到审核记录（通过时一并写入）或改为只读清单（去掉可勾选外观） |
| P1-04 | P1 | `director/world`、`director/shots`、`audio/subtitle` | 死端页：无任何页面间出边 | 进入页面 → 找"下一步" → 只有页内动作 | 用户必须回侧栏，流程感断裂 | 分别补 `→ director/shots`、`→ video/production`、`→ post/timeline` 一个"下一步"CTA |
| P1-05 | P1 | 全局拓扑 | 星形流程：9 个节点从立项不可达，`director/cast` 零入边 | 立项 → 创建 → 只能进 workflow，节点间无前后置 | 流程理解成本高、跨页往返多 | 在"上一步/下一步"层面为每个节点补前驱与后继各 1 个入口（枢纽页保留总览） |
| P2-01 | P2 | `director/shots` | 单页 868 个按钮（432 行 × 查看/提交生产）、232873 字符、首帧 144ms | 进入页面 → 统计 `[data-action]` 数量 | 认知与性能双过载 | 默认按集分页/折叠；行内只留 1 个主操作，"查看完整契约"进抽屉 |
| P2-02 | P2 | `post/timeline`、`post/episodes`、`director/plan`、`creation/breakdown` | 单页 9.9k–13.7k 字符，表格 5 张/46 行 | 进入页面 → 字符数与表数 | 首屏信息密度过高 | 主表升全宽、次要表折叠/抽屉 |
| P2-03 | P2 | `post/review`、`creation/plan`、`assets/library` | 同页两个按钮指向同一动作 | 见各页按钮清单 | 用户不知该点哪个 | 合并为一个主 CTA |
| P2-04 | P2 | `projects/new` | 22 字段 / 11 必填单页平铺；校验只给"有 N 项需修正"，不指名字段 | 空提交 → 看提示文本 | 立项转化率 | 分两步（基础信息 / 制作参数）或至少把错误字段名列出来 |
| P2-05 | P2 | `video/production` | job 执行中底层按钮未 disabled（2 个仍可点） | 点「执行」→ job 面板出现 → 底层按钮仍可点 | 键盘/Tab 可重复触发 | job 期间给 `#view` 加 `inert` 或统一 disabled |
| P3-01 | P3 | `audio/subtitle`、`quality/*`、`assets/library` | 行内同名按钮按行重复（17 个"校对"、5 个"详情"），无主次 | 见各页按钮清单 | 扫描成本 | 行内只留主操作，其余收进"更多" |
| P3-02 | P3 | `creation/review` | 同名弹窗在 script / review 两页触发 | 两页分别点「局部修改」 | 轻微重复 | 保留，统一副标题与提交文案 |

**已判定"不改"**：`projects/new` 创建后跳 `projects/workflow`（设计如此：创建即入产线）；`post/review` 的"去终审"与"打开制作流水线"在不同状态互斥渲染（逻辑正确，只是文案重复）；`video/preview` 的 `video.toResults`（播放器内切版本，与顶部 tab 场景不同）。

---

## 4. 后续整改优先级（建议排期）

1. **P1-01 / P1-02 关口动作下沉**（大，2–3 轮）：把"通过交付 / 指定返工 / 退回后期 / 终止交付 / 生成交付包"落回 `post/review`、`post/delivery`，枢纽页只做门禁总览与批处理。
2. **P1-04 / P1-05 拓扑补链**（中，1–2 轮）：3 个死端补下一步；为 9 个孤儿节点补前驱/后继；`director/plan` 补"人物档案"入口解掉 `director/cast` 零入边。
3. **P1-03 审核清单落库**（小，1 轮）：清单项写入审核记录，或降级为只读。
4. **P2-01 shots 分页/折叠**（中，1 轮）：432 行降到单集 18 行 + 分页。
5. **P2-03 / P2-05**（小，半轮）：去重复入口、job 期间禁用底层交互。
6. **工程化**：把 `_audit_chain.mjs` 的"死端 / 零入边 / 关口动作位置"三条断言并入 `tools/check.mjs`（当前只报告不阻断），防止后续再退化成星形。

---

## 5. 证据与复跑

```bash
cd prototype/v9
node tools/_audit_chain.mjs --write     # 链路建图 → tools/_ia_chain.txt
node tools/check.mjs                    # 17 条脚本门禁（新增本报告结论已复核）
node tools/serve.mjs 4199                # 127.0.0.1:4199/_smoke.html · _e2e.html · _pixel.html
```

- `tools/_ia_chain.txt`：26 节点的跳数、入边出边、承载分布（跳转 41 / 弹窗 31 / 抽屉 24 / 状态 10）。
- 浏览器实测：462 次弹窗/抽屉开关，关闭失败 0；`_e2e` 40 条断言全过（原 37 + 新增 3）。
- 端到端：`creation.approveScript` 真实点击提交 → `SP-26028` 状态推进到「生产准备中」→ 自动跳 `projects/workflow`。
