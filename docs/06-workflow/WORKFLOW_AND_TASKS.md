# 工作流与异步任务设计

## 1. 概念边界

- Workflow：一条可持久化的业务生产流程定义。
- WorkflowRun：某次流程运行实例。
- WorkflowNode：流程步骤定义。
- WorkflowNodeRun：节点运行实例及状态。
- GenerationTask：一次 AI 能力调用请求。
- TaskExecution/Attempt：一次实际执行尝试。
- Checkpoint：安全恢复所需的持久化上下文。
- Artifact/MediaAsset：节点产生的结构化结果或文件资产。
- OutboxEvent：事务内记录、事务外可靠投递的事件。

Workflow 管业务编排；Celery 只负责分发可重试的执行单元；Provider 只负责模型调用。

## 2. 运行流程

1. API 在数据库事务中创建 WorkflowRun/GenerationTask 与 OutboxEvent。
2. Outbox Dispatcher 扫描未投递事件并发送 Celery 消息。
3. Worker 以幂等方式领取执行权，校验任务状态与并发限制。
4. 执行节点，必要时调用 Provider 或 FFmpeg。
5. 保存 Attempt、Checkpoint、Artifact 和节点状态。
6. 满足依赖时推进下一个节点；需人工审核则进入 waiting_review。
7. 完成/失败/取消后更新运行状态并发布状态事件。

## 3. 可靠性要求

- 幂等：同一业务命令的重复请求不能产生重复结果；数据库唯一约束是最终防线。
- Outbox：业务写入和待投递事件同事务提交；投递可重复，消费端必须幂等。
- 重试：每次重试创建新的 Attempt；使用指数退避和随机抖动；限制最大次数。
- 超时：区分连接超时、执行超时和业务超时；超时后按能力决定取消或标记未知结果。
- 取消：先写 cancel_requested，再由 Worker/轮询器执行协作式取消；供应商不支持取消时记录实际结果。
- 恢复：Worker 崩溃后通过租约超时/心跳识别孤儿任务；从最后一个安全 Checkpoint 恢复。
- 并发：按用户、项目、Provider、模型和 Worker 队列实施限制。
- 结果：文件先写临时路径，校验完成后原子移动并登记 Asset，避免半成品暴露。

## 4. 状态机

Task：pending → queued → running → succeeded/failed；可进入 retry_wait、cancel_requested、cancelled。WorkflowRun：created → running ↔ paused → succeeded/failed/cancelled。所有状态迁移必须经过应用/领域服务并记录原因。

## 5. 失败分类

- 可重试：网络瞬断、上游 429/5xx、暂时性资源不可用。
- 不可重试：参数错误、权限失败、策略禁止、模型不支持能力。
- 需人工处理：内容审核拒绝、预算阻断、供应商结果不确定或连续失败。
- 不允许无条件重试产生费用的非幂等外部调用；需先查询供应商任务状态或使用供应商幂等键。

## 6. 监控指标

队列长度、等待时间、执行耗时、成功率、重试率、失败原因、孤儿任务数、Provider 延迟/错误率、每任务模型用量、合成耗时和磁盘空间。
