# 功能追踪与实现边界

## 1. 基线证据
- 基线：develop commit `51bbbd3f4bcb36bda34f5c0dafc01491f164d00c`。
- 当前路由：工作台、项目列表；企业用户/角色/组织部门；项目故事、剧集、资产、分镜、任务、审核、编辑器、导出。
- API 覆盖快照：运行时 OpenAPI 53 paths；前端 API calls 15/15 matched；后端 57 routes 尚无前端 API Client。该统计是基线文档中的历史 CI 快照，不应当作当前原型能力。
- 当前生产页中故事、剧集、分镜、任务、审核、时间线、导出多为 UI 原型/待真实 API 接入；不得使用演示数据伪装生产记录。

## 2. 核心功能覆盖矩阵
| 功能域 | 一级/二级页面 | 原型 | 现有 API/实现判断 | 后续前端联调依赖 |
|---|---|---|---|---|
| 身份认证 | 登录/续期/退出 | 全局登录态/用户菜单 | 基础实现 | auth/session/me、错误码 |
| 企业身份 | 用户/组织/部门/角色/权限 | 用户、组织树、RBAC | 基础 API | users、organizations、roles、assignments |
| 项目空间 | 列表/概览/成员/设置 | 项目表、成员抽屉、概览 | 项目列表/创建/详情/成员基础 API | project CRUD、member manage、access check |
| 创意策划 | 故事/故事圣经/版本 | 故事列表/编辑抽屉 | Creation API 存在 | story/story bible/version |
| 剧本创作 | 剧集/剧本/场次/对白 | 剧集列表/专项编辑入口 | 部分 Creation API | episode/script/version/scene/dialogue |
| 资产中心 | 角色/场景/道具/媒体/版本 | 资产类型筛选/上传/详情 | Asset API 部分存在 | upload/scan/version/relation/download |
| 分镜制作 | 分镜板/镜头/Shot Contract | 分镜列表/契约详情 | Creation API 部分存在 | storyboard/shot/contract version |
| AI 生产 | Provider/任务/Attempt/Workflow/Artifact | 任务监控/新建任务弹窗 | 任务创建/详情/取消基础；Provider 仅健康列表 | capability catalog、Mork config、task list/retry/events、workflow |
| 质量管理 | QA/审核/返工 | QA 队列/审核详情弹窗 | QA/Review API 待建设 | quality runs/issues/review decisions/rework |
| 剪辑交付 | Timeline/Version/Export | 多轨编辑器/导出队列 | Timeline API 未发现；导出仅基础入口 | timeline versions、export jobs/artifacts |
| 平台治理 | 用量/预算/审计/通知/标签 | 治理菜单和页面占位 | Audit GET；其余待建设 | usage/budgets/notifications/taxonomy |
 
## 3. 业务闭环阻断点
1. 未发现 QA 规则/结果 API，不能将质量状态模拟结果写入生产。
2. 未发现人工审核/返工 API，不能真实通过/拒绝。
3. 未发现 Timeline CRUD/Version API，时间线只作为目标交互设计。
4. ExportJob 列表/详情/取消/下载/验证报告契约未完整，不能宣称成片交付闭环。
5. Provider 配置/凭据/模型能力目录未完整；未配置 Mork 必须 PROVIDER_NOT_CONFIGURED，不能回退 Mock。
6. 用量预算、通知和项目内搜索待建设。
7. 所有项目资源、资产下载和版本引用服务端必须校验 project_id 与成员权限；UI 不构成授权。
8. 不包含第三方业务系统连接、Webhook、爬虫或版权管理功能。

## 4. 前端开发移交建议
1. 先按 AppShell / Sidebar / Topbar / PageHeader / FilterBar / Table / Drawer / Modal / Toast / EmptyState / Skeleton 建组件库。
2. 优先打通企业身份、项目上下文、成员授权和项目访问 fail-closed。
3. 再按故事圣经→剧集/剧本→资产→分镜→生成任务接 API。
4. QA/审核、Timeline、Export 页面须等待对应后端契约/权限/错误码后联调。
5. 所有列表统一分页、稳定排序、空/错/加载状态；编辑保存支持版本 If-Match/409。
6. Playwright 覆盖主链路、项目 A/B 切换、非成员 403、上传隔离、生成失败、审核返工、stale 和导出校验。
