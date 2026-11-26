# 运维接口（B-12）

运维总览的队列、服务、存储、提供方、事件全部来自数据库、Provider Registry、Redis 与文件系统，不再有静态演示值。

## 1. 接口

| Method | Path | Permission | 说明 |
|---|---|---|---|
| GET | `/api/v1/ops/health` | `platform.read` | API、PostgreSQL、Redis、任务调度器、存储五组件健康快照 |
| GET | `/api/v1/ops/overview` | `platform.read` | 运维页 5 个数据块聚合：队列、存储、服务、提供方、事件 |
| GET | `/api/v1/ops/queues` | `platform.read` | 按 capability 聚合队列深度、P95、失败与暂停 |
| GET | `/api/v1/ops/logs` | `platform.read` | 排障日志查询，支持 `level`、`source`、`q`、`limit` |
| GET | `/api/v1/ops/backups` | `platform.read` | 备份执行记录与结果 |
| POST | `/api/v1/ops/backups` | `platform.config` | 触发备份；`target` 为 `database` / `media` / `config` |

## 2. 数据来源

### 2.1 `/ops/overview`

| 数据块 | 真实来源 |
|---|---|
| `queues` | `generation_tasks` 按 `capability + status` 计数；P95 取 `task_attempts.duration_ms` 的 `percentile_cont(0.95)` |
| `storage` | 本组织 `media_assets` 数量与字节、`pg_database_size()`（数据库实例级）、Redis `used_memory_human`、`STORAGE_ROOT` 所在磁盘水位 |
| `services` | 实时探测 PostgreSQL `SELECT 1`、Redis `PING`、本组织任务运行/等待数量、存储根目录可访问性 |
| `providers` | `ProviderRegistry.health()` |
| `incidents` | 本组织失败任务、失败备份、降级服务聚合成未关闭事件 |

队列状态：

- 有失败任务：`告警`
- 有暂停任务且无失败：`降级`
- 其余：`正常`

`totals` 同时返回 `queue_waiting`、`failed_tasks`、`service_errors`、`open_incidents`，页面不需要在客户端重复汇总。

### 2.2 `/ops/queues`

每个 capability 返回 `running / waiting / retry / paused / failed / total / p95 / concurrency / status / note`。没有任务记录时不凭空造队列，返回当前真实集合。

### 2.3 `/ops/logs`

日志是排障视图，聚合三类持久事实：

- 失败生成任务：`ERROR` / `任务调度`
- 备份执行：成功 `INFO`、失败 `ERROR` / `备份任务`
- 审计事件：`INFO` 或 `WARN` / `审计`

查询在聚合后按时间倒序，支持精确 `level/source` 与消息包含式 `q`。日志不用于业务状态判断，业务事实仍以各域快照接口为准。

### 2.4 组织隔离边界

- 队列深度、P95、失败任务、任务状态计数、媒体对象数量与字节、日志、事件、备份历史，全部按 `Project.organization_id` 或 `backup_runs.organization_id` 过滤，不返回其他组织的数据。
- `pg_database_size()`、Redis 内存、磁盘水位、Provider 健康属于数据库实例/平台级指标，无法按组织拆分；它们只描述基础设施，不包含其他组织的业务内容。
- 无组织上下文的平台账号访问队列/总览/健康时直接拒绝，不做跨组织汇总。

## 3. 健康检查

`/ops/health` 返回 `status`（`ok` 或 `degraded`）、`checked_at` 和组件列表。每个组件包含 `name / status / latency_ms / note`；`worker` 无网络延迟，`latency_ms=null`，以运行与等待任务数说明状态。

已有公开探针 `/health`、`/health/ready` 不变；`/ops/health` 是需要登录的详细视图。

## 4. 备份

### 4.1 触发与结果

`POST /ops/backups` 同步执行一次备份并落 `backup_runs`，返回：

- `status`：`succeeded` / `failed`
- `size_bytes` / `size`
- `checksum`：文件 SHA-256
- `location`：输出文件路径
- `mode`：`metadata_snapshot` 或 `command`
- `error_code` / `error_message`：失败原因
- `verify` / `keep`：页面展示的校验与保留策略

`GET /ops/backups` 按创建时间倒序返回历史，页面可追溯每次触发的结果。

### 4.2 执行模式

1. **默认：逻辑元数据快照**。将数据库大小、核心表行数、媒体对象数量写入 `STORAGE_ROOT/backups/<UTC>-<target>-<run>.json`，计算 SHA-256。它可用于核对规模与完整性，但**不是可直接恢复的物理备份**。
2. **配置 `OPS_BACKUP_COMMAND` 后：执行真实备份命令**。命令中可用 `{output}` 占位输出文件，例如 `pg_dump -Fc -f {output} postgresql://...`；进程退出码非 0 或未生成文件即记为失败。

生产环境必须配置恢复型备份命令，并单独验证恢复演练；元数据快照不能替代恢复测试。

## 5. 迁移与权限

- 迁移 `0018_ops_backups`：新建 `backup_runs` 及组织/状态/时间索引。
- `platform.read` 可查看本组织运维数据；只有 `platform.config` 能触发备份。
- 备份记录按组织隔离；跨组织不可见。

## 6. 前端对接现状

- `web/src/views/ops/index.vue` 已调用 `/ops/overview`，字段与页面 5 个数据块、4 个统计卡对齐。
- `web/src/views/specs.ts` 的 `/ops/logs` 规格页仍指向 `/audit-logs`，显示的是审计事件而不是失败任务/备份聚合；后端 `/ops/logs` 已就绪，切前端属于后续任务。
- `/ops/config` 仍由前端调用，但后端尚未实现，配置页最近备份数据不会真实返回。

## 7. 验收

`tests/domains/ops/test_ops_console.py`：

- 健康快照包含五组件与延迟字段。
- 失败任务真实进入队列深度、事件、日志查询与总览统计。
- 另一组织的失败任务不会进入本组织的总览、队列或日志。
- 备份触发返回成功、文件大小、SHA-256 与可查询历史。
