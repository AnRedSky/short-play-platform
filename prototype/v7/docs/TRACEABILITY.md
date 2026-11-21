# V7 业务追溯矩阵

本文件将方案 V1.0 的业务原则映射到 V7 原型页面和交互。V7 从零构建，不复用 V5/V6 页面或组件。

| 方案 V1.0 业务要求 | V7 页面 / 路由 | 可演示内容 |
|---|---|---|
| 单一企业主体、内部多租户 | `governance/tenants`、`governance/tenant-detail`、`governance/cross-access` | 创建内部租户、租户资料、预算、数据边界 |
| 企业身份、员工、角色 | `people/members`、`people/roles` | 成员邀请、角色职责、权限范围 |
| 员工独立制作 | `studio/brief`、`workspace/projects` | 项目创建、创作需求输入、个人制作工作台 |
| AI 创意与编剧 | `studio/brief` | 创意需求、题材、受众、视觉风格、生成流程入口 |
| 人工剧本审核 | `studio/script-review` | 故事大纲、分集、合规预检、通过正式版本 |
| AI 导演与分镜 | `pipeline/shots` | Shot Unit 镜头生产单元 |
| 人物与场景视觉资产 | `assets/library` | 资产类型、版本、来源项目和租户归属 |
| AI 视频、音频与后期 | `pipeline/board` | 阶段状态、生产依赖、任务调度与资源观察 |
| 自动失败恢复、异常决策 | `pipeline/exceptions` | 暂停受影响任务、备用模型恢复交互 |
| AI 质量控制 | `delivery/review` | 质量指标与人工终审检查项 |
| 最终成片审核 | `delivery/review` | 审核清单、人工通过状态 |
| 作品交付与资产归档 | `delivery/center` | 交付包检查、正式归档状态演示 |
| 企业与员工产出统计 | `analytics/enterprise`、`analytics/employee` | 交付作品、集数、质量、效率和成本口径 |
| 模型资源与企业配额 | `platform/models` | 模型能力类型、备用策略、租户白名单治理 |
| 审计与数据追溯 | `platform/audit` | 跨租户授权、生产操作、交付审计事件 |
| 平台运维边界 | `platform/system` | 基础设施运行、运维权限边界 |

## 业务对象链路

企业主体 → 内部租户 → 成员关系 → 创作项目 → 剧本版本 → 生产计划 → Shot Unit → 音视频资产 → 分集成片 → 最终交付。

每个演示项目、资产、成本与交付均包含租户归属字段。员工通过当前租户上下文访问业务数据；跨租户查看不能仅凭登录身份自动获得。

## 人工决策节点

- A / 剧本审核：`studio/script-review`
- B / 最终成片审核：`delivery/review`
- 异常处置：`pipeline/exceptions`

## 明确的原型限制

Mock 数据和状态仅用于演示导航、页面布局和流程关系。模型生成、自动调度、内容检测、媒体处理、持久化、服务端权限和真实交付均未实现。
