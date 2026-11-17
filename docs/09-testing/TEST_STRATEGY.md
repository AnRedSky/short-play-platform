# 测试策略与质量门禁

## 1. 测试层级

- 单元测试：领域规则、状态机、权限决策、Provider 映射。
- 集成测试：PostgreSQL、Redis、Celery、Storage、FFmpeg wrapper、Alembic。
- 契约测试：Provider 输入输出、错误归一化、Mock 与真实适配器契约。
- API 测试：认证、RBAC、项目隔离、分页、幂等和错误码。
- 工作流测试：依赖推进、失败重试、取消、暂停恢复、Worker 崩溃恢复。
- E2E：关键生产闭环，至少覆盖项目到 MP4 导出。
- 安全测试：越权、IDOR、上传绕过、SSRF、密钥泄露、路径穿越。

## 2. 工具基线

后端 pytest、pytest-asyncio、Ruff、MyPy（逐步启用严格检查）；前端 Vitest、ESLint、TypeScript typecheck；CI 执行格式检查、静态检查、单测、迁移检查和构建。具体版本在依赖文件锁定。

## 3. 测试数据

使用工厂/fixture 生成独立数据；测试不得依赖生产数据或开发人员手工准备的数据。每个测试清理自身数据；并发测试使用独立数据库连接/Session。真实模型 API 测试默认关闭，使用 Mock Provider；真实 API 契约测试仅在显式配置凭据的受控环境执行。

## 4. 质量门禁

PR 合并前至少满足：
- lint/format/typecheck 通过；
- 相关单元和集成测试通过；
- Alembic 从空库升级成功；
- 新 API 有权限测试和错误路径测试；
- 新任务有幂等、超时、重试或取消测试（按适用项）；
- 安全敏感变更经过专项审查；
- 文档与变更同步。

不得通过跳过测试、降低断言或吞掉异常来制造绿色 CI。跳过测试必须有原因、负责人和移除期限。
