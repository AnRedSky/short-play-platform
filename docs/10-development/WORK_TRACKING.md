# 任务跟踪与协作规范

## 唯一事实来源
GitHub Issues 是任务状态、负责人、依赖、验收和风险的唯一事实来源；正式交付 PR 必须关联 Issue。GitHub Projects 仅作为视图。即时通讯不替代 Issue 记录。

## 分类与优先级
Epic、Feature、Bug、Task、Spike。P0 阻断主链路/安全/数据正确性；P1 MVP 必需；P2 增强；P3 后续。Issue 需标注 area、type、priority。

## Issue 必填
背景目标、范围/非范围、依赖、实施拆分、可验证验收标准、测试、文档/迁移/配置影响、风险回滚、负责人和目标日期。一个 Issue 尽量 0.5–3 工作日；更大任务拆分。

## 状态流
Backlog → Ready → In Progress → In Review → Done；阻塞转 Blocked 并记录原因、影响、责任人、下一步和预计解除时间。没有负责人、依赖未满足或验收不清晰不得进入 Ready。

## 协作
所有常规开发统一集成到长期 `develop`，不为单个功能需求创建独立远程临时分支。授权开发成员在本地检查和必要的同行评审后推送到 develop，并由 push CI 验证。正式交付通过 `develop` → `main` PR 完成；PR 必须提供测试证据和回滚说明，至少一名非作者批准，自动化仅在审批和 CI 均通过后启用合并。紧急修复例外遵循 BRANCHING_STRATEGY.md。

## 进度口径
未开始、进行中、阻塞、待发布、已完成。进入 develop 仅表示集成完成，不等同正式交付；只有进入 main 且完成约定验收才算正式交付。不得把设计、代码提交或 PR 合并自动等同业务验收。
