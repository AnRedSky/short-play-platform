# 页面目录约定

- 业务页按域建目录，文件用 PascalCase：`projects/Workflow.vue`、`post/Delivery.vue`。
- 一页一文件，页面内不再拆 `components/`；通用组件统一放 `components/ui` 与 `components/shell`。
- 二级页面优先由 `SpecPage.vue` + `specs.ts` 的规格驱动；只有承载核心闭环（项目、剧本、镜头、生产、后期、质检、资产）的页面才写独立组件。
- 路由集中在 `router/index.ts`，与 `mock/routes.json` 的 56 条路径一一对应。
