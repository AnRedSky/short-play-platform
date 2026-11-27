# 页面与数据层约定

- 按业务域内聚：`views/<domain>/index.vue` 是域主入口，承载该域默认页面（如 `workspace/index.vue` 是工作台，已合并项目列表）。
- 域名内允许放页面私有实现：`views/<domain>/components/`（业务内私有组件）、`views/<domain>/composables/`（业务内私有逻辑）；只有被多个域复用的组件才放 `components/ui`、`components/shell`。
- 多页面域在域目录下挂子页面：`views/<domain>/<page>/index.vue`，如 `projects/workflow/index.vue`、`post/review/index.vue`。
- 数据访问统一走 `src/services/<domain>/index.ts`，页面不直接调用 `api/client`；mock 与真实 API 只替换 service 内部实现。
- 规格驱动的二级页面共用 `views/SpecPage.vue` + `views/specs.ts`；路由集中在 `router/index.ts`，与 `mock/routes.json` 的 53 条路径一一对应；`projects/list`、`notify/inbox`、`projects/new` 旧地址保留重定向。
