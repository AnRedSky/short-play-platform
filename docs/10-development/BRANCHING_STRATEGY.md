# 分支管理与交付规范

## 1. 目标与原则

- `main` 是唯一稳定、可部署的正式主分支。
- `develop` 是唯一长期开发集成分支，所有常规功能和修复均直接集成到此分支。
- 禁止为单个 Feature、Bug 或 Task 重复创建独立远程临时开发分支；禁止常规使用 `feature/*`、`fix/*`、`task/*`。
- 常规开发不创建 PR 到 `develop`，避免为每个需求制造临时 head 分支；授权开发成员在完成本地检查和必要的同行评审后，将变更直接推送到 `develop`。
- 从 `develop` 到 `main` 的交付必须通过 PR，完成正式评审、CI 和自动合并门禁。
- 自动化可以执行策略检查、合并排队和 Issue 状态联动，但不得伪造人工批准或绕过保护规则。

## 2. 长期分支与权限

| 分支 | 类型 | 用途 | 生命周期 | 写入权限 |
|---|---|---|---|---|
| `main` | 长期受保护 | 稳定、可部署交付基线 | 永久 | 禁止直接推送；仅接受通过门禁的 PR 合并 |
| `develop` | 长期集成分支 | 唯一日常开发集成和候选验收分支 | 永久 | 仅授权开发成员可推送；必须通过 push CI；禁止 force push/删除 |

`develop` 的直接推送权限必须限制在项目开发团队，不能授予所有仓库写入者。每次推送必须关联 Issue、遵循 Conventional Commits，并通过本地检查；涉及安全、权限、数据库迁移、Provider 凭据、工作流可靠性和媒体导出的变更，推送前必须由领域负责人完成同行评审并在 Issue 留痕。

## 3. 分支命名

常规开发只使用长期 `develop`，不创建按需求拆分的远程分支。

仅允许以下受控例外：
- `release/vX.Y.Z`：版本冻结或需要独立候选验收时，从 `develop` 创建；发布完成后删除。
- `hotfix/<issue>-<slug>`：生产紧急修复，从 `main` 创建；先 PR 合并到 `main`，再 PR 同步到 `develop)，同步完成后删除。
- `automation/<purpose>`：仅限经仓库管理员批准的机器人维护分支；任务完成后删除。

所有分支名使用小写 kebab-case；Issue 编号使用十进制数字，slug 简短描述目的。禁止以个人、日期或临时实验命名长期远程分支。禁止对 `main` 或 `develop` 执行 force push、删除或重命名。

## 4. PR 目标与合并策略

- 常规功能开发：本地开发后直接集成到 `develop)，由 push CI 校验。
- 常规版本交付：PR 从 `develop` 到 `main`。
- 发布后回灌：PR 从 `main` 到 `develop`，用于同步正式发布提交和保持分支历史一致。
- 版本冻结：可使用 `release/vX.Y.Z` 到 `main` 的 PR。
- 生产紧急修复：`hotfix/*` 到 `main` 的 PR；合并后必须另开 `hotfix/*` 到 `develop` 的同步 PR。
- 不允许普通功能变更绕过 `develop` 直接进入 `main`。
- 默认 Squash merge；发布负责人可按版本策略选择 merge commit。
- PR 标题遵循 Conventional Commits；描述必须包含背景、范围、测试证据、风险/回滚和 Issue 关联（`Closes #123`、`Fixes #123` 或 `Refs #123`）。
- 至少一名非作者人工批准；关键领域变更须由相应领域负责人审查。
- 所有阻塞性变更请求和审查线程必须解决；不得通过关闭重开 PR 绕过门禁。

## 5. 自动化评审与合并门禁

GitHub Actions 在 PR 上执行分支策略检查，并在收到人工批准和独立 CI 成功结果后启用 GitHub Auto-merge。自动化检查不是人工代码审查的替代品。

满足以下条件才允许自动合并：
1. PR 非 Draft，目标分支为 `main)，来源仅为 `develop`、`release/*` 或 `hotfix/*)；或来源为 `hotfix/*`、目标为 `develop`（紧急修复同步）。
2. PR 关联 Issue，标题和描述符合规范。
3. 至少一名非作者人工批准。
4. 至少一个独立 CI 检查成功，所有已报告的独立必需检查均成功。
5. 没有未解决的阻塞性审查线程，PR 无冲突且最新提交已通过检查。
6. 目标分支规则允许合并，仓库启用 Allow auto-merge。

不满足任一条件时，PR 保持打开并报告阻塞原因；不得自动批准、强制合并或绕过保护规则。

## 6. Issue 自动关闭

- GitHub Issue 是任务状态唯一事实来源。
- 推送到 `develop` 仅表示进入集成，不代表正式交付，不自动关闭 Issue。
- 只有 PR 合并到 `main) 且描述含 `Closes #<issue>`、`Fixes #<issue>` 或 `Resolves #<issue>` 时，GitHub 才自动关闭关联 Issue。
- 仅做同步、重构或未完成任务的 PR 使用 `Refs #<issue>`。
- 多 PR 任务仅在最后一个进入 `main) 的 PR 使用关闭关键字。
- 需要部署或业务验收的任务，应在 Issue 中明确验收步骤；代码合并不自动等同生产验收。

## 7. 仓库保护与权限配置

仓库管理员须在 GitHub Rulesets / Branch protection 中配置：

**main**
- Require a pull request before merging。
- 至少 1 个非作者批准；关键目录按 CODEOWNERS 要求审查。
- 新提交使旧批准失效；要求审查线程全部解决。
- 必需 CI 检查通过并要求分支最新（或使用 merge queue）。
- 禁止 force push、分支删除和管理员绕过（紧急恢复须审计）。
- 启用 Allow auto-merge。

**develop**
- 仅授权开发团队成员可直接推送；禁止普通成员绕过权限。
- Require status checks to pass，push CI 必须成功。
- 禁止 force push、分支删除和未经授权的规则绕过。
- 不强制每个功能创建 PR；紧急修复同步 PR 例外。

Actions 使用最小权限；自动化 Token 不得拥有修改 Ruleset 的管理权限。自动化文件不能替代仓库级 Ruleset 设置，管理员必须验证规则生效。

## 8. 生命周期与维护

- `main)、`develop) 永不按任务完成而删除。
- `release/*) 在发布完成、回滚窗口结束后删除；版本通过 Git tag 标识。
- `hotfix/*) 在 main 合并且 develop 同步完成后删除。
- `automation/*) 在任务完成或关闭后删除。
- 每周检查 main/develop 漂移、CI 失败、开放 PR 阻塞和过期例外分支。
- 每次发布创建不可变版本 tag，记录构建标识、迁移、配置、已知问题和回滚方式。
- 删除未合并分支前，负责人必须确认变更已废弃并在 Issue 留痕。

## 9. 完成定义

常规开发任务进入 `develop) 并通过 push CI，只表示集成完成。任务正式交付须在对应 PR 合并到 `main)，必需检查通过，关联 Issue 按关闭关键字处理，并完成约定的部署/业务验收。
