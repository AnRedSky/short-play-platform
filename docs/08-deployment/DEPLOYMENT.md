# 部署与运维方案

## 1. 目标拓扑

企业 Linux 主机 + Docker Compose。初期服务：nginx/web、api、worker、postgres、redis；有周期调度需求时再启用 celery-beat。FFmpeg 安装在 Worker 镜像中或受控媒体执行镜像中。

## 2. 环境配置

配置分为开发、测试、生产。通过环境变量/受控配置文件注入：
- DATABASE_URL、REDIS_URL
- SECRET_KEY、TOKEN_SIGNING_KEY
- CREDENTIAL_ENCRYPTION_KEY
- STORAGE_ROOT、MAX_UPLOAD_SIZE
- AI_PROVIDER_*（非密钥标识可配置；真实密钥必须走安全注入）
- LOG_LEVEL、CORS_ORIGINS、PUBLIC_BASE_URL

仓库只提交 .env.example，不提交真实密钥、生产配置或用户数据。

## 3. 数据持久化

PostgreSQL 数据卷、Redis 按持久化需求配置、媒体 Storage 卷、备份目录独立管理。生产备份包含数据库、媒体文件、必要配置和密钥恢复材料（密钥材料需单独安全保管）。

## 4. 发布步骤

1. 检查版本、配置和备份。
2. 拉取固定版本镜像/代码并校验摘要。
3. 执行 Alembic upgrade。
4. 滚动/有序重启 API 和 Worker。
5. 执行 health check、关键 API 冒烟和队列检查。
6. 观察错误率、队列积压、磁盘和模型调用。
7. 失败时按版本与数据库迁移兼容策略回滚。

## 5. 运维要求

- 数据库定期备份并定期演练恢复。
- 监控 CPU、内存、磁盘、PostgreSQL 连接、Redis、Celery 队列、API 延迟和错误率。
- 日志结构化、按大小/时间轮转，设置保留期。
- 媒体存储设置容量阈值、清理策略和归档策略。
- 记录部署版本、迁移版本、配置变更和运维操作。

## 6. 交付验收

在干净 Linux 环境按文档可完成部署；API/Worker 可独立重启；数据库和媒体卷持久化；备份可恢复；密钥不在镜像和仓库中；升级失败有明确回滚步骤。
