# 长夜影视 · 企业内部多租户 AI 短剧平台 V6 原型

- 原型版本：**V6.0**
- 对应方案：`docs/archive/完整项目业务方案（V1.0）.md`
- 编码规范：`prototype/通用静态原型开发规范.md`
- 定位：单一企业主体统一治理，企业内部多个租户空间隔离运营；非多企业 SaaS。

## 启动
Windows：`cd prototype/v6; .\start.ps1`
macOS/Linux：`cd prototype/v6 && ./start.sh`
默认地址：`http://127.0.0.1:4176/index.html`。也可使用 `python -m http.server 4176 --bind 127.0.0.1`。必须经 HTTP 访问，不支持 file://。

## 目录
```
prototype/v6/
├── index.html / README.md / start.ps1 / start.sh / serve.js
├── assets/css/{base.css,components.css}
├── assets/js/{data.js,ui.js,app.js}
├── assets/img/{still-alley.png,still-bookstore.png,still-room.png}
└── modules/{overview,story,production,review,delivery,system,tenants}/pages.js
```

## 页面路由
| 路由 | 场景 |
|---|---|
| tenants/list | 内部租户列表、创建、切换 |
| tenants/detail?id= | 租户详情、负责人、项目与成员 |
| tenants/members?id= | 租户成员加入/移出 |
| tenants/policy?id= | 租户预算、模型能力白名单 |
| tenants/access | 跨租户授权、用途、期限、撤销 |
| overview/* / story/* / production/* | 工作台、创意、剧本、资产、分镜、配音与生产 |
| review/* / delivery/* | AI 任务、质检、成片审核、时间线与交付 |
| system/* | 企业治理、组织、RBAC、安全、审计、Provider 与用量 |

## 企业内部多租户规则
- 唯一企业主体为长夜影视；租户按事业部、部门、制作中心或业务单元划分，不是独立法人或外部客户。
- 项目通过 `tenantId` 绑定唯一租户；成员通过 `tenantIds` 获得访问范围。
- 顶栏租户切换器只展示当前身份已加入的启用租户；切换后项目可见范围同步收敛。
- 租户间默认隔离；跨租户授权记录对象、范围、权限、用途、有效期与撤销状态。
- 企业 Provider 统一接入；租户仅在企业许可范围内设置模型白名单与预算。
- 停用/归档不删除资产历史；成员移出仅撤销租户关系。

## 演示路径
1. 陈默进入租户列表，创建新空间并检查编码唯一性。
2. 顶栏切换制作中心/创新实验室/品牌内容部，核对项目可见范围。
3. 查看租户详情、管理成员、调整预算和模型白名单。
4. 新增跨租户授权并撤销，检查审计记录。
5. 继续体验创意→剧本审核→AI 生产→质检→最终成片审核→交付链路。
6. 切换不同身份检查租户列表和生产路由权限。

## 规范与边界
纯静态 Hash SPA、ES2019、原生 CSS、零第三方运行时依赖；DB→UI→App→modules 单向分层；Mock 数据集中于 data.js；组件复用 UI 与 components.css；状态仅在内存，刷新即重置；不连接真实 API/数据库/AI Provider，不实现真实持久化或服务端隔离。静态资源版本号统一为 v=6.0.0。

## 版本记录
V6.0：按业务方案 V1.0 建立企业内部多租户演示模型，新增五类租户治理路由、租户上下文切换、租户项目过滤、成员管理、资源预算策略和跨租户授权；保留完整短剧生产链路。
