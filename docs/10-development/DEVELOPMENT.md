# 统一开发规范

## 1. 工程原则

模块化单体、领域边界清晰、显式依赖注入、类型明确、可测试优先。避免循环依赖、过度抽象、全局可变状态和无业务价值的框架封装。先完成可验证 MVP，再依据实际需求演进。

## 2. 命名规范

- Python：模块/函数/变量 snake_case；类 PascalCase；常量 UPPER_SNAKE_CASE。
- Vue 组件：PascalCase 文件名；组合式函数 useXxx；变量 camelCase。
- 数据库：表/列 snake_case，表名复数；枚举值使用稳定小写标识。
- API：资源名复数；JSON snake_case。
- 测试：test_<行为>_<条件>_<预期>；测试文件 test_*.py。
- 环境变量：UPPER_SNAKE_CASE；配置项集中定义和校验。

## 3. Python 规范

- Python 3.12+；使用 uv 管理依赖和锁文件。
- FastAPI 路由只处理协议适配、鉴权依赖和响应转换；业务逻辑放应用服务。
- SQLAlchemy 2.x 使用声明式映射和显式 Session 生命周期；禁止隐式全局 Session。
- Pydantic v2 Schema 区分输入、输出和领域对象；避免 ORM 模型直接作为 API 响应。
- I/O 边界明确 async/sync；同步 SDK/FFmpeg 不得阻塞 async event loop。
- 异常使用明确业务异常和统一映射；禁止裸 except 后静默吞错。
- 公共函数、复杂规则和对外契约添加类型注解；注释解释原因/约束，不复述代码。

## 4. 前端规范

- Vue 3 Composition API + TypeScript；优先 `<script setup lang="ts">`。
- 页面按业务模块组织；API 调用集中封装；Pinia 只存跨组件共享状态。
- 组件负责展示与交互，业务状态/请求逻辑抽到 composables 或模块 service。
- 类型与后端 API 契约同步；禁止无依据使用 any。
- 表单必须有校验、加载、错误和重复提交处理；权限按钮隐藏不替代后端鉴权。

## 5. 格式与静态检查

- Python：Ruff format/lint；MyPy 按模块逐步纳入门禁。
- 前端：ESLint + Prettier（项目配置确定后统一）；TypeScript typecheck。
- UTF-8、LF、文件末尾换行；缩进 Python 4 空格、JSON/YAML/TS 2 空格。
- 禁止提交无用注释、调试输出、临时文件和未使用依赖。

## 6. 注释与文档字符串

为公共 API、复杂算法、状态迁移、权限边界、重试/幂等策略和非显然约束编写说明。优先说明“为什么”和副作用；简单代码不写冗余注释。对外函数 docstring 描述参数、返回值、异常和必要示例。

## 7. 分支管理

- main：稳定、可发布分支；禁止直接开发提交。
- develop：日常集成分支（初始化后建立）。
- feature/<issue-id>-<short-name>：功能开发。
- fix/<issue-id>-<short-name>：缺陷修复。
- hotfix/<issue-id>-<short-name>：生产紧急修复。
- docs/<issue-id>-<short-name>：纯文档。
- release/<version>：发布准备（需要时启用）。

功能分支从 develop 创建，完成后 PR 回 develop；发布 PR 从 develop 到 main。分支短小、及时同步，禁止无评审强推共享分支。初始仓库基线提交属于一次性 bootstrap；之后按上述规则执行。

## 8. 提交信息

采用 Conventional Commits：
`<type>(<scope>): <imperative summary>`
type：feat、fix、docs、refactor、test、build、ci、perf、chore、revert。
示例：`feat(storyboard): add shot versioning`、`fix(workflow): make retry idempotent`、`docs(governance): define review policy`。
一个提交聚焦一个意图；避免混合格式化与业务变更。

## 9. Pull Request 规则

PR 必须关联 Issue，说明背景、方案、影响范围、迁移/配置变更、测试证据、风险和回滚方式。至少一名非作者审查；涉及权限、凭据、外发策略、数据迁移和任务可靠性的变更必须专项审查。CI 通过后方可合并；优先 Squash merge，保留清晰提交说明。

## 10. 完成定义（DoD）

代码完成 ≠ 任务完成。任务只有在代码、测试、文档、审查和验收标准全部满足后才能关闭。无法完成的验收项必须记录阻塞和后续 Issue，不得标记为完成。
