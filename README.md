# 企业级 AI 短剧智能生产平台

> 企业私有化部署的 AI 辅助短剧生产系统。当前仓库处于项目初始化阶段，本文档体系是需求、架构、研发、测试和交付的统一基线。

## 项目定位

面向企业内部创作与制作团队，覆盖创意策划、故事设定、剧本、角色/场景/道具、分镜、图片/视频/音频生成、字幕、FFmpeg 合成、审核与成片导出。

- 部署形态：企业独立部署，Linux + Docker。
- 用户体系：企业内部多用户、组织/部门、RBAC、项目成员授权；不是 SaaS 多租户。
- AI 策略：统一调用外部模型 API；开发初期使用 Mock Provider；平台不部署本地模型推理服务。
- 媒体处理：企业内部执行 FFmpeg；素材存储先采用私有本地存储。
- 架构：模块化单体、领域分层、Provider 适配、持久化工作流；避免过早微服务化。

## 技术栈

| 层次 | 技术 |
|---|---|
| 后端 | Python 3.12+、FastAPI、SQLAlchemy 2.x、Pydantic v2、Alembic |
| 异步任务 | Celery、Redis |
| 数据库 | PostgreSQL |
| 前端 | Vue 3、TypeScript、Vite、Pinia |
| 媒体 | FFmpeg |
| Python 包管理 | uv |
| 部署 | Linux、Docker Compose、Nginx |

## 文档入口

- [项目章程](docs/00-overview/PROJECT_CHARTER.md)
- [产品范围与 MVP](docs/02-requirements/PRODUCT_SCOPE_AND_MVP.md)
- [系统架构](docs/01-architecture/SYSTEM_ARCHITECTURE.md)
- [数据模型规范](docs/03-database/DATA_MODEL_GUIDELINES.md)
- [API 规范](docs/04-api/API_CONVENTIONS.md)
- [AI Provider 规范](docs/05-ai-provider/PROVIDER_SPEC.md)
- [工作流与任务](docs/06-workflow/WORKFLOW_AND_TASKS.md)
- [安全基线](docs/07-security/SECURITY_BASELINE.md)
- [部署方案](docs/08-deployment/DEPLOYMENT.md)
- [测试策略](docs/09-testing/TEST_STRATEGY.md)
- [开发规范](docs/10-development/DEVELOPMENT.md)
- [文档规范](docs/10-development/DOCUMENTATION.md)
- [任务跟踪机制](docs/10-development/WORK_TRACKING.md)
- [实施路线图](docs/10-development/ROADMAP.md)
- [贡献指南](CONTRIBUTING.md)

## 当前状态

当前为工程初始化与规范基线阶段。功能模块尚未实现；任何功能完成状态必须以代码、自动化测试和验收记录为准，不以设计文档代替实现。

## 快速开始（目标开发环境）

1. 安装 Python 3.12+、uv、Node.js LTS、Docker Desktop/Engine。
2. 复制 `.env.example` 为本地环境配置并填写开发凭据。
3. 启动 PostgreSQL、Redis：`docker compose up -d postgres redis`。
4. 后端：`cd backend && uv sync --all-groups`。
5. 前端：`cd frontend && npm install`。
6. 按各目录 README/开发规范启动 API、Worker 和 Web。

> 初始化阶段只提供基础配置骨架；具体启动命令会随可运行应用代码合入而补齐。禁止将真实密钥提交到仓库。
