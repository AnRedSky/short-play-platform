# 系统架构规范

## 架构决策
模块化单体 + 领域分层 + 外部 AI Provider 适配 + PostgreSQL 持久化业务状态。API、AI Worker、Media Worker 可独立进程部署，但共享领域代码和数据库。未达到明确的扩缩容、隔离或团队自治门槛前不拆微服务。

## 逻辑拓扑
```text
Vue 3 Web
  -> Nginx / HTTPS
  -> FastAPI API
      -> Identity / RBAC / Project Authorization
      -> Application Services
      -> Domain Modules
          -> PostgreSQL
          -> Outbox -> Celery -> AI Worker / Media Worker
          -> Provider Contracts -> External AI APIs
          -> StorageBackend
          -> FFmpeg / ffprobe
  Redis: broker/cache; PostgreSQL: business state source of truth
```

## 模块边界
identity、organization、access_control、projects、episodes、stories/scripts、characters/scenes/props、storyboards/shots、assets、generation、providers/model_management、workflows、continuity/reviews、editing/subtitles/exports、usage、audit、plugin_management。
每个模块拥有自己的业务规则、Schema 和数据访问边界；跨模块通过应用服务或领域事件交互，禁止循环依赖。

## 分层
interfaces：HTTP/SSE/Schema；application：用例编排、事务、权限和策略；domain：实体、值对象、状态机和端口；infrastructure：SQLAlchemy、Celery、Provider SDK、文件系统和 FFmpeg 适配器。领域层不依赖 FastAPI、Celery、SQLAlchemy Session 或供应商 SDK。

## AI 接入
业务服务 -> Generation Application Service -> Capability Contract -> Policy/Router -> Registry -> Mock/External Adapter。Provider 只负责协议适配、错误归一化和供应商任务状态映射，不写业务数据库、不创建业务资产、不做业务授权。

## 异步链路
API 在同一数据库事务写业务任务与 Outbox；Dispatcher 投递 Celery；Worker 领取并执行，保存 Attempt、Checkpoint、Artifact；状态变化通过查询/SSE提供给前端。外部异步任务提交后释放 Worker，通过 Webhook/轮询查询结果。

## 存储
PostgreSQL 保存结构化业务和任务元数据；Redis 用于消息代理和缓存；私有 Storage 保存媒体本体；StorageBackend 隔离本地磁盘和未来对象存储。文件写入临时位置，校验后原子发布。

## 插件
初期仅内部注册、配置和受控启停。不可信第三方代码必须进程/容器隔离，禁止任意 import 到 API 主进程。插件不能绕过权限、Provider Policy、审计和预算策略。

## 演进门槛
只有出现独立扩缩容、故障隔离、资源隔离或团队自治的可量化收益，才拆服务。Temporal 作为工作流编排替代方案需通过 ADR；不得同时运行两套竞争的工作流状态引擎。

## 2026-11-18 实施边界补充

逻辑架构沿用当前目录结构：`src/app/domains`、`infrastructure`、`workers`、`router` 和 `web/src/api|stores|router|views|components|composables`。不执行整体目录搬迁。业务模块边界与当前代码映射见 [统一实施基线](IMPLEMENTATION_BASELINE.md)。

Provider 默认目标为 Mork；Provider Adapter 不持有业务授权/资产创建职责。无有效配置返回 PROVIDER_NOT_CONFIGURED，不允许 Mock 自动兜底。外部供应商长任务优先通过受控轮询查询，不扩展为第三方业务 Webhook 集成。

所有项目资源在服务端校验 project_id 和成员权限；Asset 不可跨项目引用。QA/Review 是版本绑定流程，项目级统一 review permission。媒体时间使用整数 PTS + 有理数 time_base。
