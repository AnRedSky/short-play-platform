# 后端跟进待办（Mock → 真实 API）

当前前端只对接 mock 契约，页面与 `services/<domain>/index.ts` 已收敛。以下任务按依赖顺序推进，完成一项即可替换对应 service 内部实现，页面不改。

## 一、接口与契约

| ID | 任务 | 关键内容 | 验收 |
| --- | --- | --- | --- |
| B-01 | 项目域契约与 DTO（完成，本轮） | 页面 DTO：`record_id + id(=code) + name(=title) + brief + 状态/阶段 + owner + budgetState + 时间/版本`；列表/详情/创建/PATCH/迁移共用 `serialize_project()` | `ProjectRead` 字段齐备；项目与创作域 20 passed，后端全量 143 passed |
| B-02 | 状态机服务端化（完成 `85b095e`） | 15 状态、动作键、权限、原因校验；`POST /projects/{id}/transitions`；`PATCH` 禁止改 status；`Idempotency-Key` 落库 | `tests/domains/projects/test_transitions.py` 7 条通过，重复提交不双写 |
| B-03 | 身份与权限（完成 `85b095e`） | 36 个点号权限码、六身份模板；接口级 + 项目成员双重鉴权 | 6 身份 × 56 路由矩阵 336 项与前端快照一致 |
| B-04 | 剧本与审核（完成 `85b095e`） | 审核记录 + 剧本状态 + 项目状态迁移 + 审计同事务，版本唯一键禁止二次审核 | `tests/domains/creation/test_script_review.py` 3 条通过 |
| B-05 | 生成任务与队列（完成，本轮） | 入队/派发/退避重试/暂停恢复/取消/供应商回调/租约回收；`(task_id, callback_id)` 幂等；迁移 `0011` | 生成域 16 passed；乱序与重复回调不双写；详见 `docs/04-api/GENERATION-QUEUE.md` |
| B-05a | 项目设定持久化（完成，本轮） | PATCH 落库 `genre/audience/episodes/duration/ratio/language/style/constraints/budget`，未知字段 422 | `test_project_dto.py` 校验 PATCH 后重新读取仍保留全部 brief |
| B-06 | 成本与预算（完成，本轮） | `usage_records` 唯一台账：attempt 唯一键、成功/失败/回收均记账；预算 85% 预警 / 100% 拦截；`actual/estimated` 回写项目 DTO；迁移 `0012` | 成本域 5 passed；台账与每次 attempt 逐条对应；详见 `docs/04-api/COST-BUDGET.md` |
| B-07 | 质检（完成，本轮） | 4 层 16 条规则；单集/整剧级报告；FAIL 阻断同事务触发 `failQc` 回退后期；迁移 `0013` | 质检域 6 passed；阻断项必触发退回后期；详见 `docs/04-api/QUALITY-REPORTS.md` |
| B-08 | 后期与交付（完成，本轮） | 时间线版本冻结、分集成片引用冻结版本、终审与项目迁移同事务、确定性 ZIP 交付包与 sha256 校验；迁移 `0014` | 交付域 6 passed；交付后版本不可覆盖；详见 `docs/04-api/POST-DELIVERY.md` |
| B-09 | 资产与存储（完成，已提交 `74133cd`） | 签名直传会话（只存 token hash）、完成登记、版本草稿/正式/替代、质检与授权标记、正式版冻结、引用计数幂等与跨域接入；迁移 `0015` | 资产域 15 passed，后端全量 167 passed；登记→质检→授权→正式版闭环与旧正式版替代均可复现；详见 `docs/04-api/ASSET-STORAGE.md` |
| B-10 | 组织与授权（完成，本轮） | 部门负责人/软停用、成员详情与调部门、项目授权证据与 owner 唯一、角色即时撤销、离职交接与授权回收；停用账号同步回收成员关系/项目授权/角色/会话；迁移 `0016` | 新增组织治理 5 passed；全量 172 passed（测试侧规避本机 WMI/Argon2 内存环境问题，无产品代码改动）；同一 access token 在角色/项目授权撤销后立即 403，离职旧 token 401，无交接不产生部分变更；详见 `docs/04-api/ORG-GOVERNANCE.md` |
| B-11 | 通知与审计 | 通知 link 跳转、已读状态、同对象合并；审计只追加不可改 | 每条通知可定位处理页 |
| B-12 | 运维接口 | 健康检查、队列深度、日志查询、备份触发与结果 | 运维页 5 个数据块全部真实返回 |

## 二、切换与治理

| ID | 任务 | 关键内容 | 验收 |
| --- | --- | --- | --- |
| B-13 | 数据源切换收口（完成，本轮） | `video/contract.ts` 映射中文状态与 `ep/shot/kind → capability/parameters`；`projects/registry.ts` 缓存 `code → record_id`；任务号缓存回 UUID；页面不改 | 前端单测 21 passed；`check`/`test:e2e`/`check:size` 全绿；详见 `docs/04-api/WEB-SWITCH-CONTRACT.md` |
| B-14 | 契约测试 | 对每个 service 函数做请求/响应快照测试，mock 与真实实现共用断言 | CI 中契约测试通过 |
| B-15 | 迁移与种子数据 | 真实库初始化：部门、角色、权限、能力字典、供应商；演示项目可导入 | 空库可一键初始化并跑通闭环 |

## 三、顺序与依赖

`B-01 → B-02 → B-03 → B-04 → B-05 → B-06/B-07 → B-08 → B-09 → B-10 → B-11/B-12 → B-13 → B-14 → B-15`。

B-03 是其余任务的前置；B-13/B-14 可与 B-05 之后并行准备。每项完成需更新本表状态，并在 `docs/WEB-DELIVERY-BACKLOG.md` 记录对应前端联调任务。

