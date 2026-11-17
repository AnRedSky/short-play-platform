# 系统总体架构

## 1. 架构决策

采用**模块化单体 + 领域分层 + 外部 AI Provider 适配 + 持久化工作流**。API、Worker 可作为独立进程部署，但共享领域代码和数据库；在真实容量或团队边界形成前不拆微服务。

## 2. 逻辑分层

```text
Vue 3 Web 工作台
       |
       | HTTPS / REST / SSE
       v
FastAPI API 接入层
  ├─ 身份认证、RBAC、项目授权
  ├─ 请求校验、API Router、DTO
  └─ 应用服务 / 命令查询
       |
       v
领域模块（模块化单体）
  ├─ identity / organization / project
  ├─ drama / script / character / scene / storyboard
  ├─ asset / generation / workflow / composition
  ├─ model_management / plugin_management / audit
       |
       +-------------------------+
       |                         |
       v                         v
AI Provider 层              基础设施层
  ├─ Contracts                ├─ PostgreSQL
  ├─ Registry / Router        ├─ Redis / Celery
  ├─ Mock Provider            ├─ StorageBackend
  └─ External API Providers   ├─ FFmpeg
                              └─ 日志 / 监控
```

## 3. 后端模块边界

| 模块 | 职责 | 不负责 |
|---|---|---|
| identity | 登录、会话、用户身份 | 项目业务数据 |
| organization | 组织、部门、成员关系 | SaaS 租户计费 |
| access_control | 角色、权限、项目授权 | 前端页面展示 |
| project | 项目、成员、项目设置 | 剧本生成 |
| drama/script | 故事设定、剧集、剧本、版本 | 模型厂商 SDK |
| character/scene/prop | 角色、场景、道具资产描述 | 文件存储实现 |
| storyboard | 分镜、镜头、镜头版本 | 视频编码 |
| asset | 媒体资产元数据和引用 | 将二进制文件存入数据库 |
| generation | 生成请求、任务、结果、尝试记录 | 工作流全局编排 |
| workflow | 流程定义、运行、节点、检查点 | 直接调用厂商 SDK |
| composition | 时间线、合成计划、导出 | AI 视频模型调用 |
| model_management | Provider 配置、模型能力、凭据、用量 | 业务内容编排 |
| plugin_management | 内部插件元数据、启停、配置 | 不受控动态执行代码 |
| audit | 安全及关键业务操作审计 | 替代业务事件表 |

## 4. 模块内部结构

推荐结构（简单模块允许合并文件，不为形式创建空目录）：

```text
modules/<module>/
  domain/
    entities.py
    value_objects.py
    events.py
    repositories.py
  application/
    commands/
    queries/
    services.py
  infrastructure/
    persistence/
    repositories.py
  interfaces/
    api/
      router.py
      schemas.py
```

依赖方向：interfaces → application → domain；infrastructure 实现 domain/application 定义的端口。领域层不得依赖 FastAPI、Celery、SQLAlchemy Session 或厂商 SDK。

## 5. AI 接入架构

```text
业务应用服务
  -> Generation Application Service
  -> Capability Contract
  -> Model Router / Policy
  -> Provider Registry
  -> Mock Provider | External Provider Adapter
  -> 第三方模型 API
```

Provider 只处理协议适配、请求/响应转换、供应商任务状态映射和错误归一化；不得直接写业务表。业务应用服务负责持久化任务、结果、资产和审计。不同厂商的同步/异步差异通过统一任务状态模型吸收。

## 6. 异步生产链

API 接收命令并在事务中创建业务任务与 Outbox 事件；Outbox Dispatcher 投递 Celery；Worker 领取任务、调用 Provider 或 FFmpeg、保存 Attempt/Checkpoint/Artifact，最后更新节点与流程状态。长耗时流程由多个可恢复节点组成。

## 7. 关键数据流

1. 用户提交创作命令 → 认证与项目权限校验 → 应用服务。
2. 应用服务写入业务记录、GenerationTask/WorkflowRun 和 Outbox。
3. Worker 执行任务 → 调用外部 API/内部 FFmpeg → 结果写入私有存储。
4. Asset 模块登记元数据与关联关系。
5. 前端通过任务查询或 SSE 获取状态，人工审核后继续下一节点。
6. 所有关键变更写审计日志。

## 8. 部署拓扑

初期使用 Docker Compose：Nginx、Web 静态资源、API、Celery Worker、Celery Beat（确有周期任务时启用）、PostgreSQL、Redis。媒体文件目录挂载持久卷。API 与 Worker 分进程，避免 Web 请求线程承担长耗时任务。

## 9. 架构演进门槛

只有当独立扩缩容、故障隔离、团队自治或资源隔离有明确收益时，才考虑拆分服务。插件初期仅支持受控注册和配置；不可信扩展必须进程/容器隔离，禁止任意代码直接加载到 API 主进程。
