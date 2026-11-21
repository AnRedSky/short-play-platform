# V6 原型需求追溯矩阵

基准方案：`docs/完整项目业务方案（V1.0）.md`；编码规范：`prototype/通用静态原型开发规范.md`。

| 业务域 | 原型覆盖 |
|---|---|
| 企业统一治理 | system 企业概览、系统设置、全局安全、Provider、用量、审计 |
| 内部租户空间 | tenants/list、tenants/detail、租户创建与切换 |
| 租户成员关系 | tenants/members，加入/移出与成员关系边界 |
| 租户资源策略 | tenants/policy，预算、模型白名单、继承企业 Provider |
| 跨租户授权 | tenants/access，授权对象、权限、用途、有效期、撤销 |
| 企业 RBAC | system/access、members、roles、安全与 403 路由 |
| AI 创意与编剧 | overview、story、production/script 与小说改编 |
| 导演分镜、人物场景、视频音频后期 | production assets/storyboard/canvas/dubbing、review timeline |
| AI 调度和质检 | review/tasks、review/qa |
| 最终审核与交付 | review/preview、delivery/export |
| 企业产出与成本统计 | system/overview、system/usage |

## 规范自检
- 唯一入口 index.html；纯静态 Hash SPA；无第三方运行时依赖。
- DB / UI / App / modules 单向分层；数据集中 data.js；组件复用 ui.js 与 components.css。
- 新增模块目录、路由前缀、分组键统一为 tenants。
- 所有资源版本号为 v=6.0.0；设计令牌和响应式断点沿用 V5 基线。
- 不使用 localStorage/sessionStorage；不调用真实 API、数据库或 AI Provider。
- 租户切换、授权、审核和预算均为内存态演示，刷新后重置。
- 当前远程代码环境无法启动真实浏览器；全路由、全身份与控制台回归未实测，不将其标记为通过。
