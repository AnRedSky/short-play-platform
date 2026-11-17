# 数据模型与数据库规范

## 1. 基本规范

- PostgreSQL 为主数据库；时间统一 UTC，使用 TIMESTAMPTZ。
- 业务主键优先 UUID；字段使用 snake_case。
- 表名采用复数 snake_case；外键命名为 <entity>_id。
- 重要表包含 created_at、updated_at；需要追责的操作包含 created_by/updated_by。
- JSONB 仅用于灵活配置、供应商原始摘要或版本化结构，不替代可检索的核心关系字段。
- 文件本体不入库，存 storage_key、checksum、mime_type、file_size 等元数据。
- 所有结构变更使用 Alembic；禁止手工修改生产数据库 schema。
- 不为 SaaS 预埋 tenant_id；组织/项目权限与租户隔离不是同一概念。

## 2. 主要领域实体

| 领域 | 核心表（建议） |
|---|---|
| 身份权限 | users、roles、permissions、user_roles、role_permissions |
| 组织 | organizations、departments、organization_members |
| 项目 | projects、project_members、episodes |
| 故事剧本 | stories、story_bibles、scripts、script_versions、script_scenes、script_dialogues |
| 视觉设定 | characters、character_versions、character_references、scenes、scene_references、props |
| 分镜 | storyboards、storyboard_shots、shot_versions、shot_references |
| AI 模型 | model_providers、model_configs、provider_credentials、model_capabilities、model_pricing |
| 生成任务 | generation_tasks、generation_attempts、generation_results、model_call_logs、model_usage_records |
| 工作流 | workflows、workflow_versions、workflow_runs、workflow_nodes、workflow_node_runs、task_checkpoints、outbox_events |
| 素材视频 | media_assets、asset_versions、media_folders、compositions、composition_tracks、exports |
| 系统治理 | plugins、plugin_versions、plugin_settings、audit_logs、system_settings |

## 3. 关键约束

- episodes：UNIQUE(project_id, episode_number)。
- scripts：版本号在所属剧集/脚本范围内唯一；保留历史版本，不覆盖已发布版本。
- storyboard_shots：UNIQUE(storyboard_id, shot_number)。
- generation_tasks：idempotency_key 在定义好的作用域内唯一；记录 task_type、provider/model、parameters、status、retry_count、max_retries、started_at、completed_at、error_code。
- generation_attempts：每次执行单独记录 attempt_number、provider_task_id、请求摘要、响应摘要、错误码、耗时。
- media_assets：记录 asset_type、storage_key、mime_type、file_size、width、height、duration、checksum、metadata。
- workflow_runs：保存输入输出快照、状态、当前节点、开始/完成时间。
- task_checkpoints：关联 workflow_run/task_execution、node、sequence 和 checkpoint_data。
- 外键删除策略需按业务生命周期明确；审计、生成历史、素材引用不应因级联删除意外丢失。

## 4. 索引策略

对外键、常用筛选字段、状态和时间字段建立索引；列表接口组合索引应依据真实查询计划。对大 JSONB 字段避免盲目 GIN。所有唯一约束在数据库层实现，不能只靠应用层先查后写。

## 5. 迁移要求

迁移文件应可从空库完整升级到 head；支持测试环境 upgrade/downgrade 验证。破坏性变更采用 expand-migrate-contract：先加兼容字段/表、迁移数据、切换代码、最后删除旧结构。迁移不得包含不可逆数据清理而没有备份和回滚方案。
