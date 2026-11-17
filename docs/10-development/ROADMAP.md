# 项目实施路线图与任务分解

> 排期为单个小型全栈团队的初始估算，以工作日计；从项目正式启动日 T0 起算。实际日期在团队确认人数、人员投入和模型供应商后由负责人更新。阶段可并行，但必须满足依赖门槛。

## 1. 阶段总览

| 阶段 | 时间窗 | 优先级 | 主要交付 |
|---|---:|---|---|
| M0 工程初始化 | T0–T+5 | P0 | 仓库规范、后端/前端骨架、Compose、CI |
| M1 身份权限 | T+6–T+12 | P0 | 登录、RBAC、组织、项目成员授权 |
| M2 核心创作域 | T+13–T+24 | P0 | 项目、剧集、剧本、角色场景、分镜 |
| M3 AI Provider | T+20–T+29 | P0 | Contracts、Mock、Registry/Router、模型配置 |
| M4 工作流任务 | T+25–T+37 | P0 | Celery、Outbox、状态机、重试/取消/恢复 |
| M5 素材与合成 | T+34–T+46 | P0 | Storage、上传、FFmpeg、MP4 导出 |
| M6 企业部署与验收 | T+47–T+55 | P0 | Linux Docker、备份恢复、安全与端到端验收 |
| M7 增强能力 | T+56+ | P1/P2 | 真实 Provider、用量、插件管理、体验优化 |

## 2. 细分任务与交付节点

### M0 工程初始化（T+1 至 T+5）
- INIT-01（P0，1d）：确定目录、依赖版本和环境变量；交付目录骨架、pyproject、uv.lock。
- INIT-02（P0，1d）：FastAPI 应用入口、配置、日志、异常处理；交付 health API 和启动说明。
- INIT-03（P0，1d）：Vue3/Vite/TS/Pinia 工程骨架；交付可启动页面和 API 客户端。
- INIT-04（P0，1d）：PostgreSQL/Redis Docker Compose、Alembic 初始配置；交付空库迁移成功。
- INIT-05（P0，1d）：Ruff/pytest/ESLint/typecheck/CI；交付 PR 自动质量门禁。

### M1 身份与权限（T+6 至 T+12）
- IAM-01（P0，2d）：用户、密码哈希、登录/刷新/注销；验收 401/会话生命周期。
- IAM-02（P0，2d）：角色、权限、角色分配；验收 403 和最小权限。
- IAM-03（P0，1d）：组织/部门/成员关系；验收成员管理。
- IAM-04（P0，2d）：项目成员和项目级授权依赖；验收越权访问被拒绝并有审计。

### M2 核心创作域（T+13 至 T+24）
- CORE-01（P0，2d）：项目、成员、剧集 CRUD；验收剧集编号唯一。
- CORE-02（P0，3d）：故事设定、剧本、对白和版本；验收版本不可覆盖且可回溯。
- CORE-03（P0，2d）：角色、场景、道具和参考素材关系；验收项目范围内引用正确。
- CORE-04（P0，3d）：分镜、镜头、提示词和镜头版本；验收镜头排序与版本。
- CORE-05（P0，2d）：创作工作台基础页面和 API 联调；验收核心 CRUD 闭环。

### M3 AI Provider（T+20 至 T+29）
- AI-01（P0，2d）：Pydantic Contracts、统一错误与任务状态映射。
- AI-02（P0，2d）：Mock Text/Image/Video/TTS Provider 和契约测试。
- AI-03（P0，2d）：Registry、Router、能力配置和 Policy。
- AI-04（P0，2d）：凭据加密、模型配置、调用日志和用量记录。
- AI-05（P1，1d）：首个真实外部供应商接入 Spike；输出能力、价格、区域、限流和数据政策评估。

### M4 工作流与任务（T+25 至 T+37）
- WF-01（P0，2d）：GenerationTask/Attempt/状态机和幂等约束。
- WF-02（P0，2d）：Celery Worker、队列路由、超时与并发限制。
- WF-03（P0，2d）：Outbox 投递和消费幂等。
- WF-04（P0，3d）：Workflow/Run/Node Executor、依赖推进。
- WF-05（P0，2d）：Checkpoint、失败重试、取消、暂停/恢复和孤儿任务恢复。
- WF-06（P0，1d）：SSE/轮询状态查询与前端任务面板。

### M5 素材与媒体合成（T+34 至 T+46）
- MEDIA-01（P0，2d）：StorageBackend/Local Storage、上传和元数据。
- MEDIA-02（P0，2d）：资产关联、预览、下载鉴权、校验和。
- MEDIA-03（P0，3d）：FFmpeg wrapper、探测、拼接、转码和超时控制。
- MEDIA-04（P0，3d）：音轨、TTS、字幕与合成时间线。
- MEDIA-05（P0，3d）：导出任务、失败处理和 MP4 验收。

### M6 企业部署与验收（T+47 至 T+55）
- OPS-01（P0，2d）：生产 Dockerfile/Compose/Nginx 和非 root 运行。
- OPS-02（P0，1d）：生产环境配置与密钥注入。
- OPS-03（P0，1d）：日志、健康检查、基础监控。
- OPS-04（P0，1d）：数据库/素材备份与恢复演练。
- OPS-05（P0，2d）：权限、安全、外发策略、SSRF、上传专项测试。
- OPS-06（P0，1d）：从项目创建到 MP4 导出的 E2E 验收和部署手册。

## 3. 依赖关系

- M1 依赖 M0；M2 的项目级资源依赖 M1 的身份/授权基础。
- M3 可与 M2 后半段并行，但必须先完成 Contracts 才可让业务模块接入。
- M4 依赖 M3 的统一任务契约与 M0 的 Redis/Worker 环境。
- M5 依赖 M2 的分镜/资产关系、M4 的异步执行和 Storage。
- M6 依赖 M1–M5 的关键主链路；真实 Provider 可在 Mock 闭环验收后逐家接入。

## 4. 里程碑验收门槛

- M0：新开发者按文档在干净环境完成启动、迁移和基础测试。
- M1：未登录 401、无权限 403、项目越权拒绝。
- M2：项目到分镜的数据关系正确，版本可追溯。
- M3：Mock/真实 Provider 可替换，调用可审计，密钥不泄露。
- M4：重复请求不重复产出，失败可重试，Worker 重启可恢复。
- M5：可生成并播放合格 MP4，素材可追溯。
- M6：Linux Docker 部署、备份恢复、端到端流程通过。

## 5. 排期管理

T0 为团队正式启动日期；每个任务进入 GitHub Issue 后填写具体目标日期和负责人。依赖未完成不得提前关闭下游任务。排期每周复核，范围变化通过 Issue/ADR 留痕。
