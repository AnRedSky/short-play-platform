# 交互内容与空态逐页清单（P-04）

口径：按钮主次按「一屏一组动作只保留一个主按钮」；不可回退、删除、终止、交付、归档类动作使用危险色并在二次确认中以危险按钮呈现；空态统一复用 `EmptyState`；错误提示分为页面级 toast、区块级 pill、表单级 form-error 三种。

## 统一规则

- 主按钮：`btn primary`。次要动作、跳转、刷新使用 `btn`。
- 危险按钮：`btn danger`，文字与边框使用 `--bad`。危险按钮不得同时标 primary。
- 二次确认：`ui.confirm(title, message, true)` 或 `ui.openDialog({ danger: true })`，确认按钮由 `DialogHost` 统一渲染为 danger。
- 空态：`EmptyState` 提供 `title`，可选 `desc`、`icon`、`compact` 和默认插槽操作区；表格空态与加载态由 `DataTable` 内置。
- 错误提示：页面读取失败用 `pill bad`（规格页）或 toast；表单/弹窗校验用 `form-error text-bad`；不得只输出裸错误文本。

## 独立业务页

| 页面 | 路由 | 主按钮 | 次要按钮 | 危险动作 | 空态 |
| --- | --- | --- | --- | --- | --- |
| 工作台首页 | `/workspace/home` | 新建项目 | 全部项目 | 无 | 运行任务、待处理事项使用 EmptyState；表格空态走 DataTable |
| 指令式生产助手 | `/workspace/assistant` | 执行指令 | 清空、去流水线 | 无 | 尚未执行指令使用 EmptyState |
| 项目列表 | `/projects/list` | 新建项目 | 刷新、筛选 | 无 | 无匹配项目走 DataTable |
| 制作流水线 | `/projects/workflow` | 当前状态主出口 | 项目详情、刷新 | 终止/交付/归档：按钮 danger + 确认 danger | 尚无动作记录、当前无阻塞项使用 EmptyState |
| 新建项目 | `/projects/new` | 下一步 / 创建项目 | 上一步 | 无 | 不适用；错误使用 form-error |
| 项目详情 | `/projects/detail` | 制作流水线 | 项目列表 | 无 | 暂无剧本版本、暂无成本记录使用 EmptyState；表格空态走 DataTable |
| 生命周期与状态机 | `/projects/lifecycle` | 当前状态主出口 | 去流水线执行 | 终止/交付/归档：按钮 danger + 弹窗 danger | 该状态无人工出口使用 EmptyState |
| 创意设定 | `/creation/brief` | 确认创意方案 | 保存设定 | 无（确认前可编辑，确认后有下游基准提示） | 无独立空态；表格空态走 DataTable |
| 剧本版本 | `/creation/script` | 提交剧本审核 | 新建版本、去剧本审核 | 无 | 暂无版本差异使用 EmptyState |
| 剧本审核 | `/creation/review` | 通过并锁定 | 查看剧本版本 | 退回修订：按钮 danger + 确认 danger | 暂无审核记录使用 EmptyState |
| 镜头契约 | `/director/shots` | 批量提交生成 | 筛选、单镜头提交 | 无 | 没有符合条件的镜头使用 EmptyState |
| 视频生产队列 | `/video/production` | 新建生成任务 | 全部任务、推进队列 | 取消任务：确认 danger | 本栏暂无任务、暂无尝试记录使用 EmptyState |
| 后期时间线 | `/post/timeline` | 提交质量检测 | 分集成片 | 无 | 无独立空态；表格空态走 DataTable |
| 分集成片 | `/post/episodes` | 批量输出 | 时间线 | 无 | 无独立空态；表格空态走 DataTable |
| 最终成片审核 | `/post/review` | 终审通过 | 质量报告 | 退回返工：按钮 danger + 确认 danger | 暂无审核记录使用 EmptyState |
| 交付包 | `/post/delivery` | 生成并交付（danger） | 最终审核 | 生成并交付：按钮 danger + 确认 danger | 无独立空态；表格空态走 DataTable |
| 质量报告 | `/quality/reports` | 执行质检 | 返工台账、筛选 | 无 | 本报告无问题项使用 EmptyState |
| 资产库 | `/assets/library` | 登记资产 | 刷新、复制 ID | 无 | 没有匹配的资产使用 EmptyState；表格空态走 DataTable |
| 企业整体数据 / 我的数据 | `/analytics/enterprise`、`/analytics/me` | 无（只读页，视角切换按钮互斥 primary） | 企业视角、个人视角 | 无 | 无独立空态；图表空数据由页面占位 |
| 平台总览 | `/ops/overview` | 无（只读看板） | 队列明细、日志、平台配置 | 无 | 无独立空态；表格空态走 DataTable |
| 平台业务配置 | `/ops/config` | 无（配置读取页） | 返回总览 | 无 | 无独立空态；表格空态走 DataTable |
| 企业主体 | `/orgs/enterprise` | 无（只读页） | 角色与权限、项目授权 | 无 | 无独立空态；表格空态走 DataTable |
| 无权限页 | `/no-access` | 切换可用身份 | 返回工作台 | 无 | 没有其他可切换身份使用 EmptyState |
| 404 | 未匹配路由 | 返回工作台 | 无 | 无 | 不适用 |

## 规格页（33 个路由，共用 `SpecPage`）

规格页的统一行为：页头首动作若标 `tone: primary` 使用主按钮；`PageAction.danger` 与行内 `action.danger` 均渲染危险色，`action.confirm.danger` 透传给确认弹窗；加载失败使用 `pill bad`；表格空态使用 `DataTable` 的 `emptyTitle/emptyHint`。

| 域组 | 路由 |
| --- | --- |
| 待办与通知 | `/notify/inbox` |
| 创意方案与拆解 | `/creation/plan`、`/creation/breakdown` |
| 导演档案 | `/director/plan`、`/director/cast`、`/director/world` |
| 视频校验 | `/video/preview` |
| 音频制作 | `/audio/dialogue`、`/audio/voice`、`/audio/bgm`、`/audio/subtitle` |
| 后期版本 | `/post/versions` |
| 质量返工 | `/quality/rework` |
| 任务中心 | `/tasks/list`、`/tasks/queue`、`/tasks/attempt` |
| 模型与路由 | `/models/config`、`/models/providers`、`/models/routing` |
| 成本 | `/cost/ledger`、`/cost/budget` |
| 合规 | `/compliance/rights`、`/compliance/risks`、`/compliance/audit` |
| 平台运维 | `/ops/capabilities`、`/ops/queue`、`/ops/logs` |
| 组织与权限 | `/orgs/departments`、`/orgs/members`、`/orgs/member`、`/orgs/roles`、`/orgs/grants`、`/orgs/handover` |

## 错误提示现状

| 类型 | 使用位置 | 口径 |
| --- | --- | --- |
| 区块级 pill | `SpecPage` 读取失败 | `加载失败 · {原因}`，固定 `pill bad` |
| 表单级 form-error | 新建项目、`DialogHost` 弹窗 | 必填/校验/提交失败就地展示，红色小字，不弹 toast |
| 动作级 toast | 交付缺项、退回缺意见、复制失败、助手执行失败 | `ui.toast(原因, 'bad')`，一次只报一条 |
| 全局兜底 toast | 页面未捕获的读取/操作失败 | `AppShell` 监听 `unhandledrejection`，统一显示 `操作失败 · {原因}`，页面无需重复 try/catch |

## 本轮统一项

- 新增 `EmptyState.vue`，替换 16 处页面裸空态；`DataTable` 的加载态与空态复用同一组件，`class="empty"` 仅保留在组件内部。
- `DialogConfig` 新增 `danger`，弹窗提交按钮与确认弹窗确认按钮统一使用 `btn danger`。
- 补齐危险色：交付、终止、归档、退回、取消任务；退回/取消类动作的入口按钮同步改为 danger。
- 审核页建立主次层级：通过/终审通过为 primary，退回为 danger。
- 规格页页头动作支持 `danger` 标记，加载失败由裸文本改为 `pill bad`。
