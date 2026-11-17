# 贡献指南

1. 阅读 README、项目章程、开发规范、文档规范和任务跟踪机制。
2. 从 GitHub Issue 开始工作；没有 Issue 时先创建并明确验收标准。
3. 从 develop 创建 feature/fix/docs 分支；分支名包含 Issue 编号。
4. 遵循 Conventional Commits；提交前运行相关 lint、typecheck 和测试。
5. 一个 PR 聚焦一个目的，关联 Issue，提供测试结果、截图/日志（脱敏）、迁移和配置影响。
6. 更新受影响的需求、架构、API、数据库、部署或测试文档。
7. 至少一名非作者审查；CI 通过后合并。
8. 未满足 DoD 的任务不得关闭；阻塞必须在 Issue 中说明原因和下一步。

详细规则见 [开发规范](docs/10-development/DEVELOPMENT.md)、[文档规范](docs/10-development/DOCUMENTATION.md) 和 [任务跟踪](docs/10-development/WORK_TRACKING.md)。
