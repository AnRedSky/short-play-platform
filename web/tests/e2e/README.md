# E2E 测试

- `studio-flow.spec.ts`：两条闭环链路——新建项目从三步表单走完 10 个关卡至交付；存量项目后期→质检→终审→交付。
- `permission-matrix.spec.ts`：6 身份 × 56 路由可达性基线，快照在 `__snapshots__/`，跨平台路径已固定。

运行：`npm run test:e2e`（先构建，由 `scripts/run-e2e.mjs` 启动并在结束后回收 4173 预览服务）。所有用例只依赖 mock 数据，不访问真实后端。
