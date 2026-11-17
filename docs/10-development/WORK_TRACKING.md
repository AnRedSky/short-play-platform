# 任务跟踪与协作规范

## 唯一事实来源
GitHub Issues 是任务状态、负责人、依赖、验收和风险的唯一事实来源；PR 必须关联 Issue。GitHub Projects 仅作为视图。即时通讯不替代 Issue 记录。

## 分类与优先级
Epic、Feature、Bug、Task、Spike。P0 阻断主链路/安全/数据正确性；P1 MVP 必需；P2 增强；P3 后续。Issue 需标注 area、type、priority。

## Issue 必填
背景目标、范围/非范围、依赖、实施拆分、可验证验收标准、测试、文档/迁移/配置影响、风险回滚、负责人和目标日期。一个 Issue 尽量 0.5–3 工作日；更大任务拆分。

## 状态流
Backlog → Ready → In Progress → In Review → Done；阻塞转 Blocked 并记录原因、影响、责任人、下一步和预计解除时间。没有负责人、依赖未满足或验收不清晰不得进入 Ready。

## 协作
开始工作前更新 Issue；常规开发统一以长期 `develop` 为集成目标，不建立每需求一个的长期远程分支。PR 提供测试证据和回滚说明；审查者检查正确性、安全、测试、维护性和文档；CI、人工批准和验收门禁通过后自动合并。分支和例外流程遵循 BRANCHING_STRATEGY.md。

## 进度口径
未开始、进行中、评审中、阻塞、已完成。百分比仅辅助；阶段完成以所有 P0/P1 验收通过为准。不得把设计、代码提交或进入 develop 自动等同业务验收；只有进入 main 且完成约定验收才算正式交付。
