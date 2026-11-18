# 前端页面与模块映射（实现基线）

产品范围严格以 `docs/02-requirements/PRODUCT_SCOPE_AND_MVP.md` 及领域规范为准。当前仓库未发现已批准的视觉稿、页面级交互规格或设计 Token；实现采用可运行的 UI 原型，视觉细节待正式设计稿验收。

## 已实现页面
- 企业工作台：项目概览、用户/组织/权限快捷入口。
- 企业管理：用户、角色、部门。
- 项目：项目列表与创建。
- 创作生产：故事圣经、剧集与剧本、角色/场景/道具资产、分镜与 Shot、AI 生成任务、审核质量、轻量时间线、MP4 导出配置。
- 开发预览：Vite DEV 自动进入演示会话；页面演示数据仅在浏览器内存中，页面明确标记，不写入后端。

## MVP 业务闭环映射
| 产品阶段 | 页面 | 关键交互/对象 | 当前状态 |
|---|---|---|---|
| 创意与故事圣经 | `/projects/:id/stories` | 世界观、人物关系、故事版本 | UI 原型 + demo |
| 分集与剧本 | `/projects/:id/episodes` | 分集、剧本版本、场次、对白 | UI 原型 + demo |
| 资产管理 | `/projects/:id/assets` | 角色/场景/道具、参考与版本 | UI 原型 + demo |
| 分镜/Shot Contract | `/projects/:id/storyboards` | 镜头编号、景别、机位、动作、时长、资产引用、连续性约束 | UI 原型 + demo |
| AI 生成 | `/projects/:id/tasks` | Text/Image/Video/TTS、Provider、Attempt、产物 | UI 原型 + demo |
| QA/人工审核 | `/projects/:id/reviews` | 技术/内容/连续性/合规、PASS/REVIEW_REQUIRED/FAIL/WAIVED | UI 原型 + demo |
| 时间线 | `/projects/:id/editor` | Video/Audio/Subtitle 多轨、毫秒时间基准、版本 | UI 原型 + demo |
| 成片导出 | `/projects/:id/exports` | MP4、画幅、帧率、字幕、ExportJob | UI 原型 + demo；不执行真实渲染 |

## 预览模式安全边界
- 自动跳过登录只在 `import.meta.env.DEV` 生效；生产 build 不允许该模式。
- 预览用户和数据为固定演示数据，不授予服务端权限、不调用真实写接口。
- 演示页面上的新增、排布和导出操作仅修改当前组件内存状态；页面持续展示“演示数据”标记。
- 正式环境仍由后端 Bearer Token、组织/项目授权和 RBAC 执行访问控制。

## UI/交互验收原则
加载/空/错误/无权限状态；异步操作防重复提交；字段校验；破坏性操作确认；项目范围资源引用版本；质量门禁和人工审核留痕；任务取消/重试不覆盖历史；时间线非破坏性版本；导出使用固定快照。
