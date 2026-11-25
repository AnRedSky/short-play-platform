# Web 重建 · 任务推进规范与看板

基线：`develop` 最新提交（mock API、56 路由、24 业务页 + SpecPage 13 组）。本文件是后续整改的唯一任务源，新增任务先登记再开工。

## 一、推进规则

1. 一任务一提交，Conventional Commits：`feat|fix|refactor|chore(web): <范围> <结果>`；只提交 `develop`。
2. 目录硬约束：域主入口 `views/<domain>/index.vue`；域内子页 `views/<domain>/<page>/index.vue`；域私有组件/逻辑放 `<domain>/components|composables`，跨域才进 `components/ui|shell`。
3. 分层硬约束：页面不直连 `api/client`、不出现 `http.*`，一律走 `services/<domain>/index.ts`；`npm run check:layering` 必须通过。
4. 完成定义（DoD）：`npm run check` 全绿（typecheck + 路由 56/56 + 规格 33/33 + 分层）→ `npm run test:e2e` 全绿（3 条用例）→ 浏览器冒烟目标页无控制台报错 → 清理临时脚本/空目录/测试产物 → 提交并在本看板更新状态。
5. 不接真实 API；接口差异只改 service 内部，页面与 mock 契约保持稳定。
6. 每轮交付固定两段：**完成任务**（含提交号/验证结果）+ **后续推进**（下一项任务 ID 与验收点）。

## 二、任务看板

| ID | 任务 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| S-01 | 页面按域内聚（index.vue） | 完成 `df57895` | 24 页全部域级入口，路由 56/56 |
| S-02 | 数据访问收敛 services/<domain> | 完成 `df57895` | 页面 0 处 `http.*`，12 域 service |
| S-03 | 清理重构空目录与旧壳残留 | 完成 | `src` 下空目录数 = 0 |
| S-04 | 统一质量门禁 `npm run check` | 完成 | 4 项检查串联通过 |
| P-01 | 跳转/弹窗规范落地：跨页用路由、查看/编辑用抽屉、不可逆用 confirm | 完成（本轮） | 24 页核对完毕；`window.prompt` 清零，终止/交付/归档为危险确认 |
| P-02 | SpecPage 规格页瘦身：同构页按域合并，目标 ≤15 条 | 完成（本轮） | 33 条规格归为 13 个域组，组内标签切换，56 路由覆盖不变 |
| P-03 | 域内 composables 抽取（项目范围、权限、列表筛选） | 完成（本轮） | 3 个共享 composable：useProjectScope / usePermission / useTableQuery，3 个页面已接入 |
| P-04 | 交互文案与空态统一（按钮主次、空态、危险色） | 待开始 | 设计走查清单全通过 |
| F-01 | 全流程 E2E：立项→创意→剧本→镜头→生产→后期→质检→交付 | 完成（本轮） | 新建项目从三步表单走完 10 个关卡至交付；存量项目后期→质检→终审→交付闭环；`npm run test:e2e` 退出码 0 |
| F-02 | 权限矩阵快照测试：各身份可访问路由 | 完成（本轮） | 6 身份 × 56 路由快照生成并可回归；owner 41、staff 35、admin 31、dept 24、auditor 21、ops 6 |
| F-03 | mock 契约字段映射草案（为将来真实 API 预留） | 待开始 | 文档列出字段差异与适配点，不改代码 |
| Q-01 | CI 接入 `npm run check` + 构建 + E2E | 待开始 | PR/推送自动执行并阻断失败 |
| Q-02 | 性能预算：主包 ≤450KB，SpecPage 独立 chunk | 待开始 | 构建报告达标（当前 469.41KB / gzip 99.00KB） |

## 三、推进顺序

`F-01 → F-02 → P-04 → Q-01 → Q-02 → F-03`；后端按 `docs/BACKEND-FOLLOWUP.md` 的 B-01 → B-03 并行启动，前端以 mock 契约先行为准。

## 四、后端跟进

真实 API 待办独立登记在 `docs/BACKEND-FOLLOWUP.md`（B-01 契约 → B-02 状态机 → B-03 权限 → 生成/成本/质检/交付/资产/组织/通知/运维 → 数据源切换）。前端只在 service 内部替换实现，页面不改。

## 五、状态更新约定

- 开工：状态改「进行中」，写清本轮范围与不改动项。
- 阻塞：在看板对应行标注阻塞原因与所需输入，不跨任务硬推。
- 完成：补提交号 + `npm run check` 结果 + 冒烟页面清单，再进入下一 ID。

## 六、测试门禁

- 单元/静态门禁：`cd web && npm run check`。
- 全链路：`cd web && npm run test:e2e`，由 `scripts/run-e2e.mjs` 构建后启动 4173 预览并在结束时回收，不留下常驻进程。
- 权限基线：`tests/e2e/__snapshots__/permission-matrix.spec.ts/permission-matrix.json`；仅权限规则有意变更时执行 `npx playwright test tests/e2e/permission-matrix.spec.ts --update-snapshots`，并在提交说明中解释差异，CI 禁止自动更新。
- E2E 只依赖 mock；新增页面若改权限或主流程，必须同步更新快照或用例断言。
