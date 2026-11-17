# 分支管理与交付规范

## 1. 目标与原则

本规范定义唯一长期集成分支、主分支保护、Pull Request 门禁、自动合并、Issue 生命周期和分支清理规则。GitHub 是代码协作与任务状态的唯一事实来源。

- `main` 是唯一稳定交付分支，始终保持最新的已验收、可部署版本。
- `develop` 是唯一长期开发集成分支，所有常规开发成果先进入此分支。
- 不为每个 Feature、Bug 或 Task 创建独立的长期远程开发分支；禁止将 `feature/*`、`fix/*`、`task/*` 作为常规团队分支。
- 不允许绕过 PR、必需检查和分支保护直接更新 `main`。
- 自动化负责校验、排队合并和状态联动；代码正确性审查由指定人员完成，自动化不得伪造人工 Approve。
- 任何自动合并都必须以目标分支保护规则为最终门禁。

## 2. 长期分支

| 分支 | 类型 | 用途 | 生命周期 | 写入权限 |
|---|---|---|---|---|
| `main` | 长期受保护 | 稳定、可部署交付基线 | 永久 | 仅 PR 合并；管理员紧急处置需留审计 |
| `develop` | 长期受保护 | 唯一开发集成、日常验收和候选版本集成分支 | 永久 | 仅 PR 合并；集成维护者可管理 |

`develop` 必须持续跟进 `main` 的紧急修复和发布提交。发布 PR 合并到 `main` 后，自动或由发布负责人立即创建/完成 `main` → `develop` 同步 PR，确保两条长期分支不发生长期漂移。

## 3. 分支命名与临时分支例外

常规开发不创建按需求拆分的仓库内临时分支。开发者在本地工作区完成任务后，将变更通过团队认可的集成 PR 流程送入 `develop`；如 GitHub PR 必须使用独立 head ref，则只允许使用受控的短生命周期交付分支，且不得将其保留为长期功能分支。

仅允许以下受控前缀：
- `release/vX.Y.Z`：版本冻结、验收和发布；从 `develop` 创建，发布后删除。
- `hotfix/<issue>-<slug>`：生产紧急修复；从 `main` 创建，必须同步回 `develop`，合并后删除。
- `automation/<purpose>`：仅用于机器人维护且经仓库管理员批准的自动化变更；完成后删除。

禁止：
- `feature/*`、`fix/*`、`task/*` 常规需求分支。
- 以个人、姓名、日期或临时实验命名的长期远程分支。
- 从过期分支继续叠加无关需求。
- 对 `main` 或 `develop` 执行 force push、删除或重命名。

所有分支名使用小写 kebab-case；Issue 编号必须使用十进制数字，slug 简短描述目的。

## 4. PR 目标与合并策略

- 常规集成变更：目标 `develop`。
- 发布候选：目标 `main`，head 为 `develop` 或 `release/vX.Y.Z`。
- 生产紧急修复：目标 `main`，head 为 `hotfix/<issue>-<slug>`；合并后必须另开同步 PR 到 `develop`。
- 不允许普通功能 PR 直接以 `main` 为目标。
- 默认使用 Squash merge，保留 PR 标题和 Issue 关联；发布负责人可按版本策略选择 merge commit。
- PR 标题遵循 Conventional Commits；描述必须包含背景、变更范围、测试证据、风险/回滚和 Issue 关联（`Closes #123` 或 `Refs #123`）。
- 至少一名非作者的人工批准；涉及权限、安全、凭据、外发策略、数据库迁移、工作流可靠性和媒体处理的变更须由相应领域负责人审查。
- 必须解决所有变更请求和阻塞性审查线程；PR 不得为绕过门禁而关闭后重开。

## 5. 自动化评审与合并门禁

GitHub Actions 对 PR 自动执行格式/静态检查、测试、构建和分支策略检查。自动化审查只提供机器检查结果，不等同于人工代码审查。

满足以下条件时，工作流可启用 GitHub Auto-merge：
1. PR 非 Draft，目标分支为 `develop` 或 `main`，来源分支符合上述规则。
2. Issue 关联格式正确，且 PR 描述包含变更与验证说明。
3. 所有必需 CI 检查通过，且没有失败或取消的必需检查。
4. 所需人工批准已完成，批准者不是 PR 作者。
5. 没有未解决的阻塞性 review thread，分支无冲突且已满足最新提交检查。
6. 目标分支保护规则允许合并，且仓库已启用 Allow auto-merge。

不满足任一条件时，PR 保持打开并报告阻塞原因，不自动批准、不强制合并、不绕过保护规则。禁止在 workflow 中使用管理员绕过权限。

## 6. Issue 自动关闭规则

- GitHub Issue 是任务状态唯一事实来源。
- PR 合并到 `develop` 仅表示进入集成，不代表生产任务完成；不得自动关闭 Issue。
- 只有 PR 合并到 `main` 且描述含 `Closes #<issue>` / `Fixes #<issue>` 时，GitHub 才自动关闭关联 Issue。
- 纯同步、重构或不完成任务的 PR 使用 `Refs #<issue>`，不得使用关闭关键字。
- 需要多 PR 完成的任务，最后一个交付到 `main` 的 PR 才使用关闭关键字。
- 合并后仍需部署/业务验收的任务，Issue 使用明确的验收子任务或发布 Issue；不能将代码合并等同生产验收。

## 7. 分支保护与权限

仓库管理员必须在 GitHub Rulesets / Branch protection 中为 `main` 和 `develop` 配置：
- Require a pull request before merging。
- Require 1 个或以上非作者批准；关键领域按 CODEOWNERS 要求审查。
- Dismiss stale approvals when new commits are pushed。
- Require conversation resolution。
- Require status checks to pass；选择本仓库 CI 和分支策略工作流的稳定 check 名称。
- Require branches to be up to date（或启用 merge queue）。
- Block force pushes、branch deletion 和管理员绕过（除经记录的紧急恢复流程）。
- 启用 Allow auto-merge；仅授予最小必要写权限。
- Actions 使用最小权限；自动化 Token 不得拥有管理分支保护的权限。

本仓库自动化文件不能替代仓库级 Ruleset 配置。管理员须在仓库设置中应用上述规则，并验证规则确实生效。

## 8. 生命周期与维护

- `main`、`develop` 永不按任务完成而删除。
- `release/*` 在发布完成、回滚窗口结束后删除；版本通过 Git tag 标识。
- `hotfix/*` 在 main 合并且 develop 同步完成后删除。
- 其他经批准的短期交付分支在 PR 合并或关闭后 7 日内删除。
- 每周检查长期分支是否漂移、开放 PR 是否阻塞、过期分支是否可清理。
- 每次发布创建不可变版本 tag，并记录镜像/构建标识、迁移、配置、已知问题和回滚方案。
- 禁止删除未合并分支，除非负责人确认其变更已废弃并在 Issue 留痕。

## 9. 完成定义

任务只有在代码进入 `main`、必需验证通过、关联 Issue 按规则关闭，并完成约定的部署/业务验收后才可标记 Done。进入 `develop` 只表示集成阶段完成，不代表正式交付。
