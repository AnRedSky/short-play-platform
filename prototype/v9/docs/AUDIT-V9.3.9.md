# V9.3.9 审查记录：逐菜单业务逻辑与页面跳转

审查对象：`prototype/v9` 全站 17 个模块、65 条路由。默认身份 `i-owner`（林知远，项目负责人），按真实短剧生产顺序「项目 → 创意/剧本 → 导演 → 视频 → 音频 → 后期 → 质量 → 审核交付 → 任务/资产/成本 → 通知/经营/合规」逐页检查入口、数据归属、动作落点与回退路径。

## 本轮发现并修复

| 问题 | 影响 | 修复 |
| --- | --- | --- |
| owner 缺少 `models.own`，视频生产「去资源配置」无法进入可操作页 | 单人主线在生成前无法管理自己的 AI 资源，入口实际断路 | owner 增加 `models.own`；资源配置页按当前 `userId` 展示本人资源；路由策略仍仅 `models.manage` 可见 |
| `models/config` 资源、额度、异常数量写死 | 切换身份仍显示林知远资源与 62% | 个人自持、企业分配、平均额度、异常资源均由 `D.providers` 实算 |
| `models/providers`、`models/routing` 写死「7 家 / 6 个 / 2 项不兼容」 | 数据增减后页面不跟随 | 数量、兼容不满足项及警示文案由数组派生 |
| `ops/overview` 写死 1,284 任务、6,218 秒、¥462,180 | 平台总览与真实台账矛盾 | 改为任务数/成功/在途、镜头时长、已确认/待核实成本、服务健康实算 |
| `ops/overview` 顶部两个 `common.noop` 按钮 | 点击只弹提示，无业务去向 | 改为 `ops.queueLink` / `ops.toConfig`，后者按 `platform.config` 拦截 |
| `ops/queue` 饱和提示写死 38% | 与队列数据无关 | 由 `concurrency` 饱和项与降级服务实时拼接 |
| 存储环图与容量条写死 1200/360/220 GB | 与 `D.ops.storage` 的 1.8/3 TB 不一致 | 从 `formal/temp/audit/used` 解析，备份按差额计算 |
| `orgs/member` 无效 id 回落 `D.users[0]` | 打开错误链接会显示第一名员工 | 明确「员工不存在」阻断，不再回退 |
| `projects.wfProject` 兜底可落到全局第一个项目 | 极端情况下操作不在可见范围的项目 | 兜底链补 `Derived.visibleProjects()[0]` |
| `assets/library` 引用表写「全库 / 当前项目没有」 | 与可见项目过滤口径不一致 | 统一为「当前范围 / 可见项目」 |
| `post/works` 无 id 时只认当前项目 | 从作品库菜单进入看不到其他可见项目作品 | 无 id 聚合 `Derived.visibleProjects()`；有 id 严格单项目并阻断不可见 id |

前一轮已完成、本轮复验仍有效的修复：脚本审核通过跳转、导演计划表缺 `return`、质量报告入口错传报告 id、项目详情兜底串项目、通知/异常可见范围、成本与合规动作项目校验、经营分析静态对比条、组织移交预览实算等。

## 菜单与跳转结论

- owner 可见 16 个分组、47 条链接；新增「模型与资源」仅 1 条「资源配置」，符合单人主线，不引入企业管理入口。
- 生产链路顺序为：项目 → 创意与剧本 → 导演规划 → 视频生产 → 音频与字幕 → 后期与剪辑 → 质量与返工 → 审核与交付；`post/versions` 留在后期，`post/review`、`post/delivery`、`post/works` 归「审核与交付」。
- `creation/review`、`director/plan`、`video/production`、`audio/*`、`post/*`、`quality/*` 均以 `?id=` 或当前项目为准；无 id 时使用 `App.currentProject`，有效 id 不会回落到别的项目。
- 全局页（任务、资产、成本、通知、合规、作品库）只聚合并列可见项目；全局页跳业务页时才按页面类型携带项目 id，不对 `models/providers` 等平台页强塞项目上下文。
- 作品库默认是全局视图：当前显示 4 个可见项目、SP-26019《长街旧梦》12/12、24 分钟、交付 V1 冻结、DP-26019-01 与审核 RV-26015-B1。
- 无效项目 id：`projects/detail`、`workflow`、`quality/reports`、`post/delivery`、`cost/budget`、`compliance/rights`、`video/production` 均显示阻断页，且不泄露不可见项目名称。

## 验证

- `node --check`：`app.js`、`derived.js` 与本轮修改的 `models`、`ops`、`orgs`、`projects`、`assets`、`post` 页面。
- `node tools/regress.mjs`：17 模块 / 65 路由；owner 可见 49 条（含无菜单上下文页）；无前缀、权限码、渲染、占位文本异常。
- `node tools/_audit_actions.mjs`：306 注册 / 254 引用 / 0 未注册。
- `node tools/_audit_perms.mjs`：34 权限定义 / 22 守卫码 / missing none；owner 15/21。
- `node tools/flow.mjs`：18 项通过、0 失败。
- 浏览器 `_smoke.html`：65 路由无 JS 错误、无 `undefined/NaN/[object Object]`，角色切换 403 均有提示。
- 浏览器人工验证：owner 资源配置 3 项个人自持 / 1 项企业分配 / 39% 平均额度 / 0 异常；视频生产「去资源配置」落到 `#/models/config`；ops 平台总览 10 条任务、3472 秒、¥67 已确认、5/6 服务健康；ops 队列饱和与降级提示来自队列数据。
- 截图：`docs/models-config-939.png`（owner 资源配置与 16 组 / 47 链接侧栏）、`docs/post-works-939.png`（作品库聚合 4 个可见项目与《长街旧梦》交付摘要）。

## 仍待决策

- 模型、任务、资产全局页是否全部默认按当前项目过滤，还是保留「全局聚合 + 单项目视图」双态。
- `video/preview`、`quality/reports`、`post/versions` 是否继续作为一级菜单，或仅从上下文页进入。
- 真实预览媒体、分集时长契约与 Git 提交策略。
