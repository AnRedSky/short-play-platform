# 产品范围与需求基线

## 生产闭环
创意 → 故事圣经 → 剧本/分集 → 场次 → 角色/场景/道具 → 分镜/Shot Contract → 图片/视频/语音生成 → QA/审核 → 时间线 → FFmpeg → MP4 交付。

## 功能优先级
| 域 | MVP | 优先级 |
|---|---|---|
| 企业身份、组织、RBAC、项目授权 | 用户、部门、角色、项目成员和服务端越权拦截 | P0 |
| 项目与剧集 | CRUD、成员、剧集编号约束 | P0 |
| 故事与剧本 | 故事圣经、分集、场次、对白、版本 | P0 |
| 资产 | 角色/场景/道具、参考图、版本和引用 | P0 |
| 分镜/镜头 | Shot、镜头合同、版本、排序、生成状态 | P0 |
| AI | Mock Text/Image/Video/TTS，统一 Provider 契约 | P0 |
| 工作流 | Task/Attempt/Outbox、重试、取消、恢复 | P0 |
| 媒体资产 | 上传、校验、预览、下载鉴权、checksum | P0 |
| 合成导出 | 基础时间线、字幕/音轨、FFmpeg MP4 | P0 |
| 审核 | 剧本/镜头/成片人工审核和审计 | P0 |
| 真实 Provider | 至少接入经评估的 LLM、Image、Video API | P1（Mock 闭环通过后） |
| 成本和运营 | 用量、预算、Provider 健康和队列指标 | P1 |
| 高级编辑/Agent/插件扩展 | 多轨精细编辑、智能导演、内部技能 | P2 |

## MVP 验收场景
1. 管理员创建用户并配置角色；无项目权限用户不能读取项目资源。
2. 创建项目、剧集、故事设定和可追溯剧本版本。
3. 创建角色、场景、道具、场次和镜头；镜头引用具体资产版本。
4. 创建 Shot Contract 并通过 Mock Provider 生成结构化结果/媒体占位资产。
5. 生成任务可查询、重试、取消；重复请求和重复回调不产生重复业务结果。
6. 镜头经过质量检查和人工审核。
7. 镜头进入时间线，配置基础视频、音频和字幕轨。
8. FFmpeg 输出可解码 MP4；ffprobe 校验参数，文件可下载且可追溯。
9. API/Worker 重启后任务和资产元数据仍存在。
10. Docker Compose 可部署；数据库和媒体文件可备份恢复。

## 用户流程
策划创建项目和故事；编剧编辑剧本并审核；系统按场次拆镜头；美术维护角色/场景/道具参考；导演确认 Shot Contract；制作人员提交 AI 生成并审核；剪辑人员组织时间线；制片/审核人员验收成片并归档。

## 状态
业务对象：draft、in_review、approved、rejected、archived。任务：pending、queued、running、retry_wait、succeeded、failed、cancel_requested、cancelled。节点：pending、ready、running、waiting_review、succeeded、failed、skipped、cancelled。状态只能经领域服务迁移；重新执行产生新运行/Attempt。

## 非功能需求
安全、项目授权、幂等、超时、有限重试、恢复、结构化日志、关联 ID、分页、流式文件传输、并发限制、迁移可回滚、备份恢复和容器资源隔离。

## 不承诺
不承诺模型质量、供应商 SLA、API 永久在线、模型结果直接商用、自动生成免审核、专业剪辑软件级体验或任意第三方插件安全执行。

## 2026-11-18 范围与状态修订

本节覆盖旧版需求中与当前决策不一致的内容。MVP 不建设第三方业务系统接入、外部 Webhook 集成、爬虫采集、内容版权管理/采集授权；第三方软件许可证和 Provider 服务条款仍需审查。资产只在项目内共享，禁止跨项目搜索、引用和共享。

审核使用项目级统一 review permission，不做多级会签或按内容类型配置审核角色。QA 仅 PASS、REVIEW_REQUIRED、FAIL；不提供 WAIVED。默认 Mork Provider，缺配置返回 PROVIDER_NOT_CONFIGURED，不伪造生成成功。时间线采用整数 PTS + 有理数 time_base。

当前项目不是空白骨架：身份/项目、creation、assets、generation、workflow 和基础 FFmpeg 图片序列导出已有不同程度实现；生产前端仍有演示页面，QA/审核、持久化时间线、完整多轨导出仍待建设。状态和阶段 DoD 见 [统一实施基线](../01-architecture/IMPLEMENTATION_BASELINE.md)。

## 页面交互规范入口

页面级导航、角色任务、交互状态、关键业务流程及当前原型/真实 API 状态见 [功能页面与交互流程规范](FEATURE_INTERACTION_SPEC.md)。页面路由存在不代表该功能已交付；生产页面必须以真实 API 状态和服务端权限为准。
