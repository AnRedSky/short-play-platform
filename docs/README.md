# 正式方案文档

本目录是项目当前唯一生效的方案与工程规范入口。文档按领域拆分，具体模块规范不得与总体方案冲突；发生冲突时，以已接受的 ADR 和对应领域规范为准，并同步修订总体方案。

## 产品业务方案（唯一生效入口）

- [项目业务方案（V3.0）](项目业务方案（V3.0）.md)：产品定位与边界、组织与权限、业务对象与归属、制作链路、任务调度、资源与成本、统计口径、实施阶段与验收的唯一业务基准。

V3.0 已合并并替代《完整项目业务方案（V1.0）》与《项目业务方案 v2》。两份历史稿已移至 [archive/](archive/)，只作追溯，不再作为操作入口，也不接受修订；如需变更业务规则，直接修订 V3.0。

## 00 项目总览
- [总体方案](00-overview/MASTER_PROJECT_PLAN.md)：产品边界、生产闭环、架构、数据、工作流、质量、交付、运营和实施总纲。
- [项目章程](00-overview/PROJECT_CHARTER.md)：目标、非目标、用户和成功标准。

## 01–10 工程规范
- [系统架构](01-architecture/SYSTEM_ARCHITECTURE.md)
- [产品范围与 MVP](02-requirements/PRODUCT_SCOPE_AND_MVP.md)
- [数据模型规范](03-database/DATA_MODEL_GUIDELINES.md)
- [API 规范](04-api/API_CONVENTIONS.md)
- [API 实际覆盖矩阵](04-api/API_COVERAGE_MATRIX.md)：当前已注册路由、缺失接口和代码偏差。
- [AI Provider 规范](05-ai-provider/PROVIDER_SPEC.md)
- [工作流与任务](06-workflow/WORKFLOW_AND_TASKS.md)
- [安全基线](07-security/SECURITY_BASELINE.md)
- [部署与运维](08-deployment/DEPLOYMENT.md)
- [测试与质量门禁](09-testing/TEST_STRATEGY.md)
- [开发规范](10-development/DEVELOPMENT.md)
- [分支管理与交付规范](10-development/BRANCHING_STRATEGY.md)
- [文档规范](10-development/DOCUMENTATION.md)
- [任务跟踪](10-development/WORK_TRACKING.md)
- [实施路线图](10-development/ROADMAP.md)

## 11–14 生产域规范
- [镜头合同](11-production/SHOT_CONTRACT.md)
- [视觉连续性](11-production/VISUAL_CONTINUITY.md)
- [质量门禁与返工](11-production/QUALITY_GATES.md)
- [时间线编辑](12-editor/TIMELINE_SPEC.md)
- [媒体导出](12-editor/EXPORT_SPEC.md)
- [模型能力注册](13-ai-governance/MODEL_CAPABILITY_SPEC.md)
- [工作流引擎决策](13-ai-governance/WORKFLOW_ENGINE_DECISION.md)
- [第三方软件与许可证治理](14-compliance/THIRD_PARTY_LICENSES.md)

## 原型与竞品调研
- [V5 高保真静态原型](../prototype/v5/README.md)：28 条路由，私有化内部制作台定位；含独立生成台、分镜画布、配音台、成片预览中心。
- [短剧平台开源竞品分析清单](15-competitor/COMPETITOR_ANALYSIS.md)：GitHub 主流项目三组对照、五维归纳、与基线能力矩阵及 V5 机会点映射。

## 规范性约定
- MUST/必须：交付必须满足的要求；SHOULD/建议：默认采用，例外需记录理由；MAY/可选：按阶段启用。
- 所有设计状态、开发状态、测试状态和发布状态分开记录。
- 本仓库不维护并行“最新版”副本。已被取代的方案统一移入 `archive/` 并在此处标注，不继续作为当前操作入口。

## 统一实施基线（2026-11-18）

- [项目统一实施基线](01-architecture/IMPLEMENTATION_BASELINE.md)：当前唯一实施方案，包含产品范围、技术选型、模块边界、数据/API 约束、当前代码实现矩阵、依赖和阶段 DoD。
- [功能页面与交互流程规范](02-requirements/FEATURE_INTERACTION_SPEC.md)：页面信息架构、页面现状、目标操作流程、通用状态和前端实施顺序。

任何领域文档与以上基线冲突时，先修订冲突文档再开始对应功能开发；目标能力不得标记为已实现，除非有代码和测试证据。
