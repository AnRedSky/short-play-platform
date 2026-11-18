# 工作流与异步任务规范

## 对象边界
Workflow/WorkflowVersion 定义流程；WorkflowRun 是一次运行；WorkflowNode/NodeRun 表示步骤及执行；GenerationTask 表示一次模型调用；TaskAttempt 表示实际调用尝试；Checkpoint 保存恢复上下文；Artifact 表示输出；OutboxEvent 可靠投递事件。业务状态保存在 PostgreSQL；Celery 只负责分发执行单元。

## 执行流程
1. API 事务写业务变更、WorkflowRun/Task 和 Outbox。
2. Dispatcher 投递 Celery 消息，允许重复投递。
3. Worker 以租约/幂等方式领取任务，检查状态、权限策略、预算和并发。
4. 执行短任务或提交外部异步任务；长时间等待通过轮询/Webhook，不占用 Worker。
5. 保存 Attempt、Checkpoint、Artifact 和状态。
6. 节点依赖满足后推进；需审核时进入 waiting_review。
7. 状态通过查询/SSE通知前端。

## 可靠性
- 幂等键按业务作用域唯一，消费端幂等，数据库约束为最终防线。
- 每次重试创建新 Attempt，指数退避 + 随机抖动 + 最大次数。
- 区分连接超时、执行超时、业务超时；外部结果未知时先查询供应商状态，避免重复计费。
- 取消先记录 cancel_requested，再协作执行；供应商不支持取消时记录真实结果。
- Worker 崩溃通过租约/心跳识别孤儿任务，从安全 Checkpoint 恢复。
- 结果文件先临时写入、校验、原子发布后登记 Asset。
- 限制用户、项目、Provider、模型、队列和主机级并发。
- 上游版本变化标记下游 stale；不自动覆盖已审核产物。

## 状态机
Task：pending → queued → running → succeeded/failed；允许 retry_wait、cancel_requested、cancelled。WorkflowRun：created → running ↔ paused → succeeded/failed/cancelled。NodeRun：pending/ready/running/waiting_review/succeeded/failed/skipped/cancelled。迁移必须经领域服务并记录原因。

## 失败分类
可重试：网络瞬断、上游 429/5xx、临时资源故障。不可重试：参数、权限、策略或能力不匹配。需人工：审核拒绝、预算阻断、供应商状态不确定、超过最大重试。非幂等调用不得盲目重试。

## Temporal 决策
MVP 使用 PostgreSQL 状态 + Celery + Outbox。Temporal 仅在长时间人工等待、复杂补偿、跨系统持久化执行需求显著且团队具备运维能力时评估；如采用，由 ADR 明确迁移边界并替代流程编排层，不能与自研引擎双写双跑。

## 2026-11-18 工作流实施边界

继续复用现有 domains/workflow、Outbox、Checkpoint、租约和 Celery Worker。PostgreSQL 是任务/工作流业务状态事实来源；Redis/Celery 只负责分发/协调。GenerationTask 表示模型调用，TaskAttempt 表示一次真实调用尝试，Artifact 必须校验后登记到项目内 AssetVersion。

本期不建设第三方业务 Webhook 集成；外部 Provider 的异步任务通过 Adapter 支持的查询/轮询机制获取状态。不得将供应商 Webhook 作为业务工作流正确性的唯一来源。任务取消、重试、恢复和未知供应商状态必须记录实际结果，不能盲目重复调用。

Mork 是默认 Provider；缺少配置时返回 PROVIDER_NOT_CONFIGURED，不能回退 Mock。完整模块现状和任务边界见统一实施基线。
