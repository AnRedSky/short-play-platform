# 页面目录约定

- 每个业务页是独立目录，主入口统一为 `views/<domain>/<page>/index.vue`，例如 `projects/list/index.vue`、`post/review/index.vue`。
- 目录名用 kebab/lowercase，与路由末段一致；一个页面目录只放该页与其私有资源，不再拆公共组件。
- 通用组件统一放 `components/ui` 与 `components/shell`；规格驱动的二级页面共用 `views/SpecPage.vue` + `views/specs.ts`。
- 路由集中在 `router/index.ts`，与 `mock/routes.json` 的 56 条路径一一对应。
