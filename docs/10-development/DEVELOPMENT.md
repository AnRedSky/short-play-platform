# 统一开发规范

## 工程原则
模块化单体、显式依赖、领域边界、可测试优先；避免循环依赖、过度抽象和全局可变状态。接口层不承载业务规则，Provider 不操作业务库。

## 命名
Python snake_case、类 PascalCase、常量 UPPER_SNAKE_CASE；Vue 组件 PascalCase、变量 camelCase、组合式函数 useXxx；DB/API snake_case；环境变量 UPPER_SNAKE_CASE；测试 test_<behavior>_<condition>_<expected>。

## Python
Python 3.12+、uv；FastAPI 路由只做协议适配/鉴权/响应；SQLAlchemy 2.x 显式 Session 生命周期；Pydantic v2 输入/输出 Schema 分离；同步 SDK/FFmpeg 不阻塞 async event loop；明确业务异常，禁止静默吞错；公共接口和复杂规则有类型注解。

## 前端
Vue 3 Composition API + TypeScript + <script setup lang="ts">；API 客户端集中封装；Pinia 只存跨组件状态；业务逻辑抽 composables/services；避免无依据 any；表单具备校验、加载、错误和重复提交处理；后端权限校验不可由按钮隐藏替代。

## 格式与质量
UTF-8、LF、末尾换行；Python 4 空格，JSON/YAML/TS 2 空格；Ruff、MyPy、ESLint、Prettier、TypeScript typecheck。禁止调试输出、未使用依赖、临时文件和真实密钥。

## 分支与提交
分支模型、命名、权限、生命周期和合并触发条件统一遵循 [分支管理与交付规范](BRANCHING_STRATEGY.md)。长期分支仅保留 `main` 与 `develop`；禁止按单个功能需求创建常规远程临时分支。提交遵循 Conventional Commits：type(scope): summary。禁止共享分支无评审强推。

## PR
必须关联 Issue，描述背景、范围、影响、迁移/配置、测试证据、风险和回滚。不要求逐个人工批准：无人值守模式下由 PR 策略门禁、必需 CI 检查和分支策略检查共同决定交付。目标为 main 的 PR 必须使用 Closes/Fixes/Resolves 关闭已交付 Issue；权限、凭据、外发、迁移和任务可靠性变更仍需在 Issue 中记录专项审查结论。

## DoD
代码、测试、文档、审查和验收标准全部满足才算完成。进入 develop 仅代表集成，不等同正式交付；只有进入 main 且约定验收完成才可关闭任务。
