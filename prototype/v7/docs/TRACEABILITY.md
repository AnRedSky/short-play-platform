# V7.5 业务追溯矩阵

本文件把方案 V1.0 的业务原则映射到 V7.5 原型的路由、业务对象与动作，并标注人工决策节点与不可由静态前端验收的部分。完整逐章差距见 [`docs/V7.5-原型完成度核查与业务方案差距矩阵.md`](../../../docs/V7.5-原型完成度核查与业务方案差距矩阵.md)。

## 工作台环节与业务对应

| 环节 | 路由 | 方案 V1.0 业务要求 | V7.5 可演示内容 |
|---|---|---|---|
| 01 总览 | `overview/home` | 企业生产全局视图 | 授权项目、当前阶段、待决事项、异常、预算、最近交付、个人统计入口 |
| 02 项目创建 | `workspace/projects`、`workspace/detail?id=<项目ID>` | 项目主业务对象、企业项目中心、负责人移交 | 新建/编辑/归档/恢复/暂停/恢复生产/终止/移交/CSV；类型、创建时间、完成/交付集数、质量状态；档案含预算、十维质量、任务、移交历史、生命周期 |
| 03 剧本创作 | `studio/brief`、`studio/script-review?id=<项目ID>` | AI 创意编剧、人工剧本审核、影响分析 | 需求校验、草稿、生成、版本抽屉、下载、退回原因、通过锁定、V3 影响分析与受影响重生产任务 |
| 04 素材与分镜 | `pipeline/shots`、`assets/library?id=<项目ID>` | 导演分镜、人物场景资产、版本与授权 | 镜头生成/重生成；11 类资产上传、详情、版本、下载、移除；来源/授权/商业范围/到期；7 条合规记录，覆盖六类合规事项 |
| 05 拍摄排期 | `pipeline/schedule`、`pipeline/board`、`pipeline/tasks?id=<项目ID>`、`pipeline/exceptions` | 生产计划、任务调度、失败恢复 | 排期增删改启停；任务台账的输入输出、依赖、主备模型、重试、失败成本、质检；重试/切模型/暂停/导出；异常策略 |
| 06 后期制作 | `pipeline/post`、`pipeline/quality?id=<项目ID>` | 配音字幕剪辑合成、质量检测 | 后期环节状态、启动、重试；十维质检、筛选、复检、局部返工、质量报告 |
| 07 审核交付 | `delivery/review?id=<项目ID>`、`delivery/center` | 最终成片审核、交付归档 | 9 项终审清单、集次门槛、结构化审核记录、审核导出；11 类交付清单、四类报告、交付包归档 |
| 08 发布上线 | `delivery/release` | 渠道发布与上线记录 | 新增排期、上线、下线、删除、渠道授权、前置条件 |
| 09 运营分析 | `analytics/enterprise`、`analytics/employee`、`analytics/me` | 企业/员工/个人产出统计 | 周期切换、项目/作品/质量/效率/成本指标、项目成本明细、统计快照、员工与个人导出 |
| 10 企业治理 | `governance/enterprise`、`governance/tenants`、`governance/tenant-detail?id=<租户ID>`、`governance/cross-access` | 单一企业主体、内部多租户、跨租户授权 | 企业资料与策略编辑、成员/租户/项目计数、租户组织单元/管理员/配额、租户增改停恢档、跨租户授权 |
| 11 组织与身份 | `people/members`、`people/roles` | 企业身份、员工、角色、项目授权 | 邀请、详情、租户成员关系、项目授权、改角色、重发、停用/启用、移除阻断、角色权限 |
| 12 平台与审计 | `platform/overview`、`platform/config`、`platform/audit`、`platform/models`、`platform/system` | 平台总览、业务配置、模型资源、审计与运行 | 企业/租户/用户/生产/成本总览；默认预算/集数/重试/并发/提醒/保留/白名单/邀请/审核配置；审计筛选导出；模型主备；备份/缓存/重启/重置 |

## 业务对象与归属

```text
企业主体 Enterprise
  └── 租户 Tenant（组织单元 / 管理员 / 配额 / 预算）
       ├── 成员 User（多租户成员关系 / 项目访问授权）
       └── 项目 Project（类型 / 状态 / 负责人 / 预算 / 质量 / 交付集数）
            ├── 剧本版本 ScriptVersion
            ├── 影响分析 ImpactAnalysis
            ├── 生产任务 ProductionTask（依赖 / 模型 / 重试 / 成本 / 质检）
            ├── 质量检测 QualityCheck（十维）
            ├── 审核记录 Review
            ├── 数字资产 Asset（类型 / 来源 / 授权 / 商业范围 / 版本）
            ├── 合规记录 Compliance
            ├── 项目移交 ProjectHandover
            └── 交付 Delivery
企业级统计快照 AnalyticsSnapshot
```

所有业务对象都带 `tenant` 归属；项目、任务、资产、审核、成本与交付均以项目 ID 关联，项目改名不会断链。仍为派生对象、尚未独立建模的有 Episode、Scene、Character、Prop、Dialogue、Timeline 与 Shot Unit 的完整字段。

## 路由与参数约定

- 列表页无参数；详情页统一 `?id=`：`workspace/detail?id=SP-*`、`studio/script-review?id=SP-*`、`pipeline/schedule|post|tasks|quality?id=SP-*`、`delivery/review|release?id=SP-*`、`assets/library?id=SP-*`、`governance/tenant-detail?id=tn-*`。
- `App.renderRoute` 解析 `#/path?query`，把 `URLSearchParams` 传入 `render(params)`；`renderRoute` 与 `App.go(target)` 都通过 `focusContext(id)` 同步项目/租户上下文。
- 缺失 `id` 或当前身份无权访问时落到当前上下文并提示；未匹配路由为 404，无权限为 403，均提供返回可用首页入口。

## 人工决策节点

- A / 剧本审核：`studio/script-review?id=<项目ID>`，通过或退回均需确认；退回原因至少 10 字；通过后锁定正式剧本版本，项目转入生产准备中。
- B / 最终成片审核：`delivery/review?id=<项目ID>`，必须逐项勾选 9 项；集数未完成时不提供终审；通过写 `DB.reviews` 并允许交付，退回转入后期制作中。
- 异常处置：`pipeline/exceptions` 与 `pipeline/tasks`，重试达上限或异常任务可恢复/暂停，操作写审计。
- 交付归档：`delivery/center`，归档不可逆、需二次确认，生成 `DL-*` 交付单并写审计。
- 项目终止：`workspace/detail`，终止会取消未执行/执行中任务但保留记录，进入只读。
- 项目移交：`workspace/detail`，负责人变更写 `DB.projectHandovers`，企业归属与历史记录不变。

## 权限与只读边界

三层判定：模块注册声明 `permission`，`App.allowed()` 依据 `DB.permissions[identity]` 决定路由可见性，模块只渲染当前身份可执行的动作。侧栏条目数始终等于当前身份可访问路由数。

业务状态是第二道边界：归档租户与归档/终止项目隐藏写操作；通过 `?id=` 深链进入制作页时，动作守卫会拦截生产、上传、审核、发布等写操作，只允许查看与导出，并提示“只读项目”及原因。

## 校验与证据

- jsdom：10 业务域 / 30 路由 / 5 身份，失败 0、控制台错误 0、告警 0。
- Playwright：36 项流程检查全部通过，含 9 项终审、项目授权、统计快照与合规台账。
- 页面审计：28 个代表页面无文本占位与横向溢出。
- 截图：12 个 1440 页面 + 1 个 430 页面，脚本错误 0。

## 明确的原型限制

Mock 数据与状态统一收敛在 `assets/js/data.js`。模型生成、自动调度、内容检测、媒体处理、服务端权限、真实渠道发布和真实交付均未实现；业务操作写入浏览器 `localStorage`（键 `framework.v7.state`，版本不一致自动丢弃），刷新保留但不跨设备，可在系统运行配置中重置。CSV 导出为前端 Blob 生成。方案 20.2、20.3、20.5 的真实生产能力与端到端验收不在静态原型范围内。

