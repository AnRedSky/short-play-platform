# 企业级 AI 短剧智能生产平台

企业私有化部署的 AI 辅助短剧生产与管理平台，面向企业内部创作、制作、审核和交付团队。

## 产品边界
- 企业独立部署：Linux + Docker Compose；企业内部多用户、组织/部门、RBAC 和项目级授权。
- AI 模型统一通过第三方 API 接入；开发期使用 Mock Provider；不建设本地模型推理集群。
- 媒体文件存储在企业内部私有存储；FFmpeg 在企业内部执行媒体处理与成片导出。
- 模块化单体、领域分层、Provider 适配、持久化业务工作流；不为早期规模引入微服务/Kubernetes。
- 非 SaaS 产品，不包含租户自助开通、租户计费或公开插件市场。

## 生产闭环
创意策划 → 故事设定 → 剧本/分集 → 角色/场景/道具 → 场次/分镜/镜头合同 → 图片/视频/音频生成 → 质量检查与人工审核 → 时间线剪辑 → FFmpeg 合成 → MP4 与项目档案交付。

## 技术基线
Python 3.12+、FastAPI、SQLAlchemy 2.x、Pydantic v2、Alembic、Celery、Redis、PostgreSQL、Vue 3、TypeScript、Vite、Pinia、FFmpeg、uv、Docker Compose、Nginx。

## 正式文档
从 [文档总入口](docs/README.md) 进入。项目完整基线见 [总体方案](docs/00-overview/MASTER_PROJECT_PLAN.md)。

## 仓库状态
本仓库文档定义目标、规范和验收要求，不代表功能已经实现。功能状态以代码、自动化测试、部署记录和验收证据为准。禁止将设计完成描述为开发完成。
