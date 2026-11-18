# 数据模型与数据库规范

## 基础规则
PostgreSQL；UUID 主键；snake_case；表名复数；UTC + TIMESTAMPTZ；重要实体包含 created_at/updated_at/created_by/updated_by；外键和唯一约束必须在数据库层实现。文件本体不入库，仅保存 storage_key、checksum、mime_type、size、宽高、时长等。JSONB 只用于灵活配置/快照，不替代核心关系字段。不预埋 SaaS tenant_id。

## 核心实体
- 身份组织：users、sessions、organizations、departments、organization_members、roles、permissions、role_permissions、user_roles。
- 项目：projects、project_members、episodes。
- 故事：stories、story_bibles、scripts、script_versions、script_scenes、script_dialogues。
- 影视资产：characters、character_versions、character_states、scenes、scene_versions、props、prop_versions、visual_styles。
- 分镜：storyboards、storyboard_scenes、shots、shot_contract_versions、shot_references、continuity_constraints。
- 媒体：media_assets、asset_versions、asset_references、media_folders。
- AI：model_providers、model_configs、provider_credentials、model_capabilities、model_pricing、generation_tasks、task_attempts、model_call_logs、usage_records。
- 工作流：workflows、workflow_versions、workflow_runs、workflow_nodes、workflow_node_runs、checkpoints、outbox_events。
- 审核：review_records、quality_runs、quality_issues（MVP 不建立 waivers）。
- 剪辑：timelines、timeline_versions、timeline_tracks、timeline_clips、transitions、subtitle_cues、export_profiles、export_jobs。
- 治理：audit_logs、system_settings、plugin_registry。

## 关键关系与约束
- episodes UNIQUE(project_id, episode_number)。
- shot 在 storyboard/scene 范围内有稳定序号；镜头合同有独立版本。
- 资产引用锁定 asset_version_id，不仅引用可变 asset_id。
- generation_tasks 具有作用域唯一的 idempotency_key；task_attempts 的 attempt_number 唯一。
- workflow_node_runs 绑定 workflow_run 和 node；依赖图无环。
- TimelineClip 引用明确的媒体资产版本；同一时间线版本内 clip 顺序/轨道位置确定。
- 审核、生成历史和审计记录不因普通业务删除级联丢失。
- 外键删除策略按生命周期明确，优先软删除/归档。

## 索引
外键、状态、项目 ID、创建时间、常用筛选组合和唯一业务键建立索引。索引依据真实查询计划调整；大型 JSONB 不盲目加 GIN。

## 迁移
所有结构变更通过 Alembic。迁移必须从空库升级到 head；测试 upgrade/downgrade。破坏性变更采用 expand-migrate-contract；删除字段前先完成兼容发布、数据迁移和备份。生产库禁止手工改 schema。

## 2026-11-18 数据约束补充

- Asset 与 AssetVersion 必须携带 project_id；数据库约束和服务层双重保证 AssetRelation 两端 project_id 一致。不得建立跨项目共享、搜索或引用关系。
- ReviewRecord、QualityRun 必须绑定不可变 subject_version_id；新版本重新 QA/审核。MVP 不建 waivers 表或 WAIVED 状态。
- TimelineVersion/Track/Clip 的权威时码使用整数 PTS 和有理数 time_base（numerator/denominator）；视频帧序号和音频采样点保持整数。禁止以 float seconds 持久化或比较。
- 新模型只有在对应阶段 Issue 明确范围、现有模块落点、迁移和回滚后才能加入。所有迁移在现有 migrations/versions 下按 Alembic 管理。
