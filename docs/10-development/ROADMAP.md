# 实施路线图

排期为小型全栈团队的初始工作日估算，从正式启动日 T0 起算；非日历承诺。具体日期需团队确认人数、投入、供应商和环境后填入 Issue。阶段可并行但依赖门槛不可跳过。

| 阶段 | 时间窗 | 估算 | 主要交付 |
|---|---|---:|---|
| M0 工程基础 | T0–T+5 | 5d | 可运行前后端骨架、Compose、迁移、CI |
| M1 企业身份权限 | T+6–T+12 | 7d | 登录、组织、RBAC、项目授权 |
| M2 核心创作域 | T+13–T+24 | 12d | 项目、剧集、剧本、资产、场次、镜头合同 |
| M3 AI Provider | T+20–T+29 | 9d | Contracts、Mock、Registry/Router/Policy、模型能力 |
| M4 工作流任务 | T+25–T+37 | 13d | Task/Attempt、Outbox、状态机、恢复 |
| M5 媒体与合成 | T+34–T+46 | 13d | Storage、时间线、字幕/音轨、FFmpeg、MP4 |
| M6 部署与验收 | T+47–T+55 | 9d | Linux Docker、安全、备份恢复、E2E |
| M7 生产增强 | T+56 起 | 持续迭代 | 连续性 QA、智能返工、成本分析、高级编辑 |

## 依赖
M1 依赖 M0；M2 依赖 M1 的身份/授权；M3 可与 M2 后半段并行但先完成契约；M4 依赖 M0/M3；M5 依赖 M2/M4/Storage；M6 依赖 M1–M5 核心闭环。M7 不阻塞 MVP。

## 任务拆分
M0：应用入口、配置/日志/异常、前端骨架、PostgreSQL/Redis/迁移、CI。
M1：用户认证、角色权限、组织部门、项目成员与越权测试。
M2：项目剧集、故事圣经/剧本版本、角色场景道具、场次/Shot/Shot Contract、工作台。
M3：Pydantic Contracts、Mock Text/Image/Video/TTS、Registry、Capability Catalog、Router/Policy、凭据加密、首个真实 Provider Spike。
M4：Task/Attempt、Worker 队列、Outbox、Workflow/Node、Checkpoint、幂等、重试、取消、恢复、状态查询。
M5：StorageBackend、资产版本/引用、Timeline/Track/Clip、字幕音轨、FFmpeg wrapper、导出校验。
M6：生产 Compose、密钥注入、监控、备份恢复、安全测试、端到端验收。
M7：连续性自动检查、质量门禁增强、智能返工、预算策略、模板包装、Temporal 评估。

## 里程碑验收
M0 干净环境可启动/迁移/测试；M1 401/403/项目越权正确；M2 数据和版本引用正确；M3 Mock/真实适配器契约一致且密钥安全；M4 重复请求安全、失败可重试、Worker 重启可恢复；M5 输出可播放且可追溯 MP4；M6 部署、恢复、安全和 E2E 通过。M7 以单独 Issue 定义验收。

## 管理
T0 由项目负责人确定；Issue 填负责人和目标日期；每周复核依赖和容量。阶段工作日不可简单相加为自然日总周期。
