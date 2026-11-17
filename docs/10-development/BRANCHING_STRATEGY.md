# 分支管理与交付规范

## 1. 目标与基本原则

- main 是唯一稳定、可部署的正式主分支。
- develop 是唯一长期开发集成分支，所有常规功能和修复统一进入此分支。
- 禁止为单个 Feature、Bug 或 Task 创建独立的常规远程开发分支；禁止常规使用 feature/*、fix/*、task/*。
- 常规开发由授权成员在本地工作区完成后，直接集成到 develop，并由 Push CI 自动验证。
- main 只接受通过 Pull Request 和自动化质量门禁的变更。
- 不要求用户逐项手动确认或人工点击合并；自动化仅在策略检查和 CI 全部成功后交付。
- 自动化不得绕过失败检查、冲突检测或仓库保护规则。

## 2. 长期分支与权限

| 分支 | 类型 | 用途 | 生命周期 | 写入权限 |
|---|---|---|---|---|
| main | 长期受保护 | 稳定、可部署交付基线 | 永久 | 禁止直接推送；仅通过 PR 合并 |
| develop | 长期集成分支 | 唯一日常开发集成与候选验收分支 | 永久 | 仅授权开发成员可推送；Push CI 必须通过；禁止强制推送和删除 |

develop 的直接推送权限应限制在项目开发团队，不授予所有仓库写入者。每次推送应关联 Issue、遵循 Conventional Commits，并由 Push CI 自动检查。安全、权限、数据库迁移、Provider 凭据、工作流可靠性和媒体导出等高风险变更应在 Issue 中记录领域审查结论。

## 3. 分支命名与例外

常规开发只使用长期 develop，不为单个需求创建远程分支。

仅允许以下短生命周期例外：

- release/vX.Y.Z：从 develop 创建，用于版本冻结、候选验收和发布；发布完成且回滚窗口结束后删除。
- hotfix/<issue>-<slug>：从 main 创建，用于生产紧急修复；合并 main 后必须同步到 develop，再删除。
- docs/<purpose>：仅用于跨文档体系或仓库治理调整，不得承载单个功能需求；合并后删除。
- automation/<purpose>：仅用于经仓库管理员批准的机器人维护；完成后删除。

分支名使用小写 kebab-case；Issue 编号使用十进制数字，slug 简短描述目的。禁止以个人姓名、日期或临时实验命名长期远程分支。

## 4. PR 目标与合并策略

- 常规功能开发：本地完成后直接集成到 develop，由 Push CI 验证。
- 正式版本交付：PR 从 develop 到 main。
- 版本冻结：可使用 release/vX.Y.Z 到 main 的 PR。
- 生产紧急修复：hotfix/* 到 main 的 PR；合并后另行同步到 develop。
- 文档体系或仓库治理变更：docs/* 到 develop 或 main 的 PR。
- 不允许普通功能变更绕过 develop 直接进入 main。
- develop 到 main 的正式发布 PR 使用 merge commit，保留 develop 历史作为 main 的祖先，避免长期分支历史分叉。
- release/*、hotfix/* 和 docs/* 等短生命周期例外 PR 默认使用 Squash merge。
- PR 标题遵循 Conventional Commits；描述必须包含背景、范围、测试证据、风险/回滚和 Issue 关联（Closes #123、Fixes #123 或 Refs #123）。

## 5. 自动化评审与交付门禁

GitHub Actions 自动执行 PR 元数据和分支策略检查，并等待 CI 工作流完成。自动化不要求用户逐项批准或手动点击合并。

允许自动合并的条件：

1. PR 非 Draft，目标分支和来源分支符合本规范。
2. PR 标题符合 Conventional Commits，描述关联至少一个 GitHub Issue。
3. CI 的后端依赖安装、Ruff、测试阶段、前端质量检查和 Docker Compose 校验全部成功。
4. PR 没有合并冲突，且待合并的 head commit 与通过 CI 的 commit 完全一致。
5. GitHub Token 仅具备完成检查和合并所需的最小权限。

任一条件不满足时，PR 保持打开并报告失败原因；不得自动合并、忽略失败或绕过仓库保护。自动交付工作流在 CI 完成后等待 PR policy gate 与其他必需检查全部成功（最长 5 分钟），并对同一 head SHA 校验后合并；CI 阶段已强制执行后端 Ruff/pytest、空库 Alembic 迁移、Celery Worker 启动、前端 typecheck/ESLint/Vitest/生产构建、Docker Compose 全栈冒烟与 API 依赖就绪检查，不存在条件跳过的检查项。

## 6. Issue 自动关闭规则

- GitHub Issue 是任务状态、负责人、依赖和验收的唯一事实来源。
- 推送到 develop 仅表示集成完成，不自动关闭 Issue。
- 只有 PR 合并到 main，且描述含 Closes #<issue>、Fixes #<issue> 或 Resolves #<issue> 时，关联 Issue 才允许关闭。
- 实测结论：由机器人通过 API 完成的合并未触发 GitHub 关键字自动关闭（PR #18 合并后 Issue #1、#9 仍为 open）。因此自动交付工作流在合并 main 后按关键字幂等关闭关联 Issue 并输出日志，避免交付完成但任务长期挂着；该步骤只对目标 main 的 PR 生效。
- 仅同步、重构或未完成任务的 PR 使用 Refs #<issue>，此类 PR 不会触发关闭。
- 需要部署或业务验收的任务，必须在 Issue 中记录验收结果；代码合并不自动等同生产验收。

## 7. 仓库保护与权限配置

仓库管理员应在 GitHub Rulesets / Branch protection 中配置：

**main**
- Require a pull request before merging。
- Require status checks to pass，必需检查为 `backend-quality`、`frontend-quality`、`compose-validation`、`PR policy gate`。
- Require conversation resolution。
- Block force pushes and branch deletion。
- 禁止管理员绕过自动化质量门禁；紧急恢复操作必须审计。
- 不强制每个 PR 进行人工批准，以保持无人值守自动交付。

**develop**
- 仅授权开发团队成员可直接推送：仓库当前只有 1 名管理员协作者，Ruleset 未配置 bypass actors，强制推送与分支删除都会被拒绝。
- Push CI 由 CI 工作流在 `push: develop` 事件上强制执行，失败结果推送后可立即可见并被后续交付门禁继承。GitHub Ruleset 的 required status checks 会在推送到达时校验目标提交已有的检查结果，因此无法约束新提交的直接推送：实测推送被拒绝并返回 `GH013 ... 3 of 3 required status checks are expected`。故 develop 不启用该规则，避免阻断常规集成；正式交付仍必须在 main 上通过全部必需检查。
- Block force pushes and branch deletion。
- 不强制每个功能需求创建 PR。

Actions 使用最小权限；自动化 Token 不得拥有修改 Ruleset 的管理权限。仓库工作流文件不能替代 Ruleset 设置，管理员必须验证规则确实生效。

已配置的 Ruleset（2026-11-17 通过 REST API 创建、回读确认并实测验证，`enforcement: active`）：

| Ruleset | ID | 目标 | 规则 |
|---|---|---|---|
| main-protection | 27461472 | refs/heads/main | deletion, non_fast_forward, pull_request（必需批准数 0、必须解决对话）, required_status_checks（`backend-quality`、`frontend-quality`、`compose-validation`、`PR policy gate`） |
| develop-protection | 27461477 | refs/heads/develop | deletion, non_fast_forward |

## 8. 生命周期与维护

- main、develop 永久保留，不按任务完成而删除。
- 正式发布 PR 使用 merge commit，保持 main 与 develop 的共同祖先关系，不需要每次发布后额外创建 main 到 develop 的回灌 PR。
- hotfix 在 main 合并且 develop 同步完成后删除。
- release/* 在发布完成、回滚窗口结束后删除。
- docs/* 和 automation/* 在对应 PR 合并或任务关闭后删除。
- 每周检查 main/develop 漂移、CI 失败、开放 PR 阻塞和过期例外分支。
- 每次正式发布创建不可变版本 tag，记录构建标识、迁移、配置、已知问题和回滚方式。

## 9. 完成定义

常规开发任务进入 develop 且 Push CI 通过，表示集成完成。正式交付必须进入 main，所有强制检查通过，关联 Issue 按规则关闭，并完成约定的部署和业务验收。
