# V9.3.7 审查记录：创作域项目化与阶段锁定

## 结论

创作域从「固定演示 `SP-26031`」改为按当前项目读取与推进；新项目可从草稿完整走完创意设定 → 方案 → 剧本 → 审核锁定 → 拆解。已进入生产、审核、交付、归档阶段的项目，创意设定不再允许回写。

## 主要修复

### 1. 创作页去硬编码

- `creation/brief` 使用 `pidOf(query)`：`?id=` 优先，其次 `projects.wfCurrent`；台账、当前设定、版本记录均按项目过滤。
- `creation/plan` 按项目过滤 `D.creativePlans`，已选定方案从 `chosen` 读取；对比表列由真实方案动态生成，不再固定「错认来信 / 双线追凶」。
- `creation/script` 仅 `SP-26031` 使用完整稿纸样本；其他项目展示真实版本规模、提交人、说明与分集覆盖，不再显示无关正文或直接死路。
- `creation/breakdown` 完整性预期改为 `p.episodes`，`SP-26019` 实测「12 集预期；实际 12 集 / 72 场 / 216 镜」通过。
- `creation.briefTrace`、评分抽屉、方案跳转均按当前项目或对象读取，不再引用固定版本链。

### 2. 创作阶段门禁

- 创意设定仅「草稿 / 创意策划中」可新建或派生；「生产中 / 待审核 / 已交付 / 已归档」等阶段只读。
- `creation.newBrief`、`creation.deriveBrief`、`creation.choosePlan`、`creation.regenPlan` 同时在页面与动作层校验项目状态。
- 已交付项目隐藏新建、派生、重新生成、重选方案；保留「查看方案」「新建 V2」「导入小说另立项目」。
- `FROZEN_ACTIONS` 增加 `creation.newBrief`、`creation.deriveBrief`，与全局交付冻结一致。
- 已交付项目进入创作页可新建 V2；`post.newVersion` 同时接受 `data-pid` 与 `data-id`。

### 3. 新项目真实链路验证

在浏览器实测创建 `SP-26032`（12 集、90 秒、预算 ¥16,000）：

1. 草稿项目自带 `CB-26032-01` 草稿创意设定。
2. 提交创意意图后项目进入「创意策划中」，生成 `CP-26032-A`。
3. 选定方案进入「剧本创作中」，生成 `SCR-26032-V1`，项目进入「待剧本审核」。
4. 审核通过并记录依据后剧本锁定，项目进入「生产准备中」。
5. 拆解生成 12 集、216 镜、`PP-26032-V1`；完整性自检通过。
6. 测试后 `Store.reset()`，回到 7 项目基线，无 `SP-26032`。

### 4. 历史项目数据补齐

- 为 `SP-26019` 补 `CB-26019-03`、`CP-26019-A`；为 `SP-26015` 补 `CB-26015-02`、`CP-26015-A/B` 与 `SCR-26015-V2`。
- 已交付、异常项目不再出现「有锁定剧本但创意设定为空」的断裂。

### 5. 任务可见范围

- `tasks/list`、`tasks/queue`、`tasks/attempt` 按 `Derived.visibleProjects()` 过滤。
- `tasks.pauseQueue`、`tasks.batchRetry` 只处理当前身份可见项目的任务。
- 任务总量脚注改为「可见任务」，非成员项目任务不可见。

### 6. 其他上下文修复

- `post/episodes` 无 `?id=` 时从 `wfCurrent` 取项目，不再回落 `SP-26031`。
- `post.newTimeline` 的兜底项目改为当前项目。
- 持久化键升级为 `shortplay.workbench.v937`；`index.html`、`_e2e.html`、`_smoke.html` 与 `app.js` 版本串统一 9.3.7。

## 验证

- `node tools/flow.mjs`：18 / 18 通过。
- `node tools/regress.mjs`：17 模块、65 路由通过；owner 48 / admin 32 / dept 24 / staff 41 / auditor 24 / ops 4。
- `node tools/_audit_actions.mjs`：注册 304、引用 256、未注册 0。
- `node tools/_audit_perms.mjs`：34 权限码、21 守卫码、missing none。
- `_e2e.html`：全项 PASS，`E2E OK`。
- `_smoke.html`：65 路由正常，无 JS 错误、无 undefined / NaN，角色切换拦截正常。
- 浏览器抽查：`SP-26019` 创意页只读且显示 `CB-26019-03`；`SP-26019` 方案页显示 `CP-26019-A`；`creation/breakdown?id=SP-26019` 完整性通过；`SP-26032` 全链路通过后已重置。

## 未决

- 新项目候选剧本仍只登记规模与审核状态，未生成真实正文；审核页以版本记录与分集覆盖为准。
- `SP-26015` 处于「异常中」，未套用活动项目分集补全；其 16 集覆盖仍以锁定剧本与真实镜头为准。
- `prototype/v9` 仍为 git untracked，尚未提交。
