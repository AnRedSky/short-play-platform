# 测试策略与质量门禁

## 测试层级
- 单元：领域规则、状态机、权限、版本、连续性规则。
- 集成：PostgreSQL、Redis、Celery、Storage、FFmpeg、Alembic。
- Provider 契约：请求/响应、错误归一、同步/异步状态和 Mock/真实适配一致性。
- API：认证、RBAC、项目隔离、分页、幂等、错误码。
- Workflow：依赖推进、重复消息、重试、取消、恢复、孤儿任务、Webhook 幂等。
- 媒体：上传验证、ffprobe、时间线渲染、字幕/音轨、原子发布。
- E2E：项目创建至 MP4 下载。
- 安全：越权、IDOR、SSRF、上传绕过、路径穿越、密钥泄露。
- 迁移：空库 upgrade、必要的 downgrade 和升级兼容。

## 工具
pytest、pytest-asyncio、Ruff、MyPy；Vitest、ESLint、TypeScript typecheck；CI 执行格式、静态检查、测试、迁移和构建。版本由 lockfile 锁定。

## 测试原则
默认使用 Mock Provider，不在普通 CI 调用真实模型或产生费用。真实 Provider 契约测试在明确启用凭据的受控环境执行。测试数据隔离，使用工厂/fixture，不依赖人工准备或生产数据。

## PR 门禁
lint/format/typecheck 通过；相关测试通过；Alembic 空库迁移成功；新 API 有权限和异常路径测试；新任务按适用范围覆盖幂等/超时/重试/取消；安全变更专项审查；文档同步。不得通过跳过测试或吞异常制造绿色 CI。
