# 部署与运维规范

## 部署目标
企业 Linux + Docker Compose。服务包括 Nginx/Web、FastAPI API、Celery Worker（按队列拆 AI/Media 进程）、PostgreSQL、Redis；确有周期调度时启用 Celery Beat。FFmpeg 位于受控媒体 Worker 镜像。

## 配置
开发/测试/生产分离。配置按 `.env.example`（仓库内置默认）→ `.env` → `.env.{APP_ENV}` → 进程环境变量依次叠加，后层覆盖前层、前层缺失才回落；容器与生产环境只通过环境变量注入。本机开发复用已有 PostgreSQL/Redis 容器（6432/9770），需要独立实例时改到 `docker/docker-compose.infra.yml` 的 5432/6379。`API_PORT` 是端口唯一来源，`start_api.py`、项目 compose 的宿主机映射与 e2e 脚本共用它。环境变量包含 DATABASE_URL、REDIS_URL、CELERY_BROKER_URL、CELERY_RESULT_BACKEND、SECRET_KEY、STORAGE_ROOT、MAX_UPLOAD_SIZE、CORS_ORIGINS、PUBLIC_BASE_URL、LOG_LEVEL。真实密钥不得进入 Git、镜像或普通日志；通过企业密钥管理或受控环境注入。数据库迁移（`alembic upgrade head`）在目标库不存在时会自动创建该库。

## 持久化
PostgreSQL、必要的 Redis 数据、媒体存储、备份目录使用独立持久卷。备份包含数据库、媒体和必要配置；密钥恢复材料单独加密保管。明确 RPO/RTO 由部署方结合业务确定。

## 发布
检查版本/配置/备份 → 固定镜像摘要/代码版本 → Alembic upgrade → 有序重启 API/Worker → health check/冒烟/队列检查 → 观察错误率、队列、磁盘和 Provider → 记录发布。数据库迁移遵循向前兼容；失败时按兼容策略回滚应用，避免盲目降级数据。

## 运行
监控 CPU、内存、磁盘、PostgreSQL 连接、Redis、Celery 队列、API 延迟、任务耗时、Provider 延迟/错误率、FFmpeg 失败和存储增长。日志结构化、脱敏、轮转和保留。配置素材归档和清理策略。API、AI Worker、Media Worker 可独立限流和扩缩容。

## 验收
干净 Linux 主机可按文档部署；API/Worker 可独立重启；数据卷持久化；备份可恢复；密钥不在仓库/镜像；升级、健康检查和回滚步骤经过演练。
