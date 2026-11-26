# 组织与授权治理（B-10）

组织治理以“成员关系实时判定、授权证据可追溯、离职一次收口”为原则。所有授权变更都在当前请求事务内落库；权限码、项目成员关系和组织成员关系每次请求实时读取数据库，不依赖登录时的 token 快照。

## 一、端点与权限

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET/POST | `/organizations/departments` | `org.read` / `org.manage` | 部门列表与创建；支持 `include_inactive` |
| GET/PATCH/DELETE | `/organizations/departments/{department_id}` | `org.read` / `org.manage` | 部门详情、修改、软停用 |
| GET | `/organizations/members` | `org.read` | 成员列表；支持 `department_id`、`include_inactive` |
| GET/PATCH | `/organizations/members/{user_id}` | `org.read` / `org.manage` | 成员详情、调整部门 |
| POST | `/organizations/members/{user_id}/offboard` | `org.manage` | 离职交接与授权回收 |
| GET | `/organizations/offboarding` | `org.read` | 离职记录 |
| PATCH | `/projects/{project_id}/members/{user_id}` | `project.manage` | 调整项目角色 |
| DELETE | `/roles/{role_id}/assignments/{user_id}` | `grant.manage` | 即时撤销组织角色 |

## 二、部门

部门新增 `manager_user_id` 与 `is_active`。负责人必须是本组织的启用成员，不额外要求其属于本部门。

约束如下：

- 父部门必须属于同一组织且处于启用状态；跨组织父级按不存在处理。
- 更新父级时检测自引用与成环，命中返回 `DEPARTMENT_CYCLE`（409）。
- 部门软停用前必须没有启用子部门，否则 `DEPARTMENT_HAS_CHILDREN`（409）。
- 部门软停用前必须没有启用成员，否则 `DEPARTMENT_HAS_MEMBERS`（409）。
- 停用部门不可继续编辑，命中返回 `DEPARTMENT_INACTIVE`（409）。
- 组织内部门名称唯一；停用部门仍占用名称，避免历史记录指向同名新部门。

## 三、成员

`OrganizationMember` 新增 `deactivated_at`。成员详情返回用户邮箱、姓名、账号启用状态、部门名、组织角色码和全部项目授权，便于离职前核对。

成员 `PATCH` 只允许调整 `department_id`，不允许直接改 `is_active`。离职必须走 offboard，保证项目 owner、项目授权、角色、会话与权限授予被同一流程回收。部门必须启用，停用部门返回 `DEPARTMENT_INACTIVE`。

```json
{
  "department_id": "8f0c9d2e-...."
}
```

## 四、项目授权

`ProjectMember` 新增 `granted_by/granted_at/revoked_by/revoked_at`。新增成员写入授权人与时间；重新启用清空撤销字段；移除成员写入撤销人与时间，保留历史行。

项目 owner 与 `Project.owner_user_id` 绑定：

- 非 owner 用户不能被授予 `owner`，命中 `PROJECT_OWNER_IMMUTABLE`（409）。
- owner 不能被降级为其他角色，也不能被移除；需要变更时走离职交接或后续 owner 转移流程。
- 因此同一项目始终只有一个 owner，不会出现多 owner 或无 owner 的中间状态。

项目授权变更立即生效：下一次请求按 `ProjectMember.is_active` 与 `project_role` 重新判定，旧 token 不会保留已撤销的项目权限。

## 五、角色撤销

`DELETE /roles/{role_id}/assignments/{user_id}` 删除组织角色分配并写审计，返回 204。角色不存在或不属于当前组织返回 404；分配不存在返回 404。

每次受保护请求都重新计算权限集合。撤销角色后，同一个 access token 的下一次请求即返回 `PERMISSION_DENIED`（403），无需等待 token 过期。

## 六、离职交接

`POST /organizations/members/{user_id}/offboard` 请求体：

```json
{
  "handover_to_user_id": "b5f5c5e0-....",
  "note": "合同到期"
}
```

流程在一个事务内完成：

1. 目标必须是本组织启用成员，且不能是离职人本人；交接人无效返回 404 或 `HANDOVER_INVALID`（409）。
2. 离职人仍拥有项目时必须提供交接人，否则 `HANDOVER_REQUIRED`（409），且不产生任何部分变更。
3. 把其拥有项目的 `owner_user_id` 转给交接人，并确保交接人在对应项目持有启用 `owner` 角色。
4. 撤销其全部启用项目成员关系，写 `revoked_by/revoked_at`。
5. 删除其在本组织的全部角色分配。
6. 若其没有其他组织的启用成员关系，停用账号、撤销全部直接权限授予；若仍有其他组织，保留账号，但撤销全部 refresh session。
7. 停用当前组织成员关系并写 `deactivated_at`。
8. 写 `offboarding_records`：交接对象、项目数、转移项目数、撤销项目授权数、撤销角色数、撤销直接授权数、撤销会话数、明细、完成时间与操作人。

重复调用按 `(organization_id, user_id)` 返回已有记录，不重复转移或重复扣减，保持幂等。

`GET /organizations/offboarding` 按完成时间倒序列出记录。当前不提供删除离职记录的端点，记录只追加。

## 七、账号停用同步回收

`PATCH /users/{user_id}` 传入 `is_active=false` 时，除置账号停用外，同一事务内还会：

- 停用该用户在所有组织的启用成员关系并写 `deactivated_at`；
- 撤销其全部启用项目成员关系并写 `revoked_at`；
- 删除其全部组织角色分配；
- 停用全部直接权限授予；
- 撤销全部 refresh session。

因此停用账号不会留下“账号已停但项目授权仍启用、角色仍保留”的悬挂授权。再次启用账号不会自动恢复旧成员关系、项目授权或角色，必须重新授予。

若账号仍是任一项目的 owner，直接停用会返回 `HANDOVER_REQUIRED`（409）且不产生部分变更；必须先通过对应组织的 offboard 指定交接人，完成 owner 转移后再停用账号。

## 八、鉴权即时生效

`get_current_user` 在 token 含组织标识时，除校验用户启用状态外，还实时校验该组织成员关系仍启用。命中以下任一情况立即返回 `AUTHENTICATION_REQUIRED`（401）：

- 用户已停用；
- 当前组织成员关系已停用；
- token 无效或过期。

项目级权限由 `ProjectMember.is_active` 实时判定；组织级权限由数据库角色分配实时计算。二者都不缓存到 access token。

## 九、错误码

| 错误码 | HTTP | 场景 |
|---|---|---|
| `DEPARTMENT_CYCLE` | 409 | 部门父级成环或自引用 |
| `DEPARTMENT_INACTIVE` | 409 | 操作停用部门或挂到停用父级 |
| `DEPARTMENT_HAS_CHILDREN` | 409 | 停用仍有启用子部门的部门 |
| `DEPARTMENT_HAS_MEMBERS` | 409 | 停用仍有启用成员的部门 |
| `MEMBER_ALREADY_INACTIVE` | 409 | 成员已停用但无离职记录，或修改停用成员 |
| `HANDOVER_REQUIRED` | 409 | 离职人拥有项目但未提供交接人 |
| `HANDOVER_INVALID` | 409 | 交接人为离职人本人 |
| `PROJECT_OWNER_IMMUTABLE` | 409 | 非 owner 被授予 owner，或 owner 被降级/移除 |

## 十、数据与验证

迁移 `0016_org_governance`：

- `departments`：`manager_user_id`、`is_active` 与索引、负责人外键；
- `organization_members`：`deactivated_at`，历史停用成员按 `updated_at` 回填；
- `project_members`：授权/撤销四字段及外键，历史授权按 `created_at` 回填，历史撤销按 `updated_at` 回填；
- `offboarding_records`：离职记录表，唯一键 `(organization_id, user_id)`。

测试覆盖：

- 部门自引用/成环、子部门与成员阻断停用、软停用后不可编辑；
- 项目授权证据、角色调整、owner 不可变、移除后同一 token 立即 403；
- 角色撤销后同一 access token 立即 403；
- 离职无交接阻断且不产生部分变更、交接人无效、owner 转移、项目授权/角色/会话回收、旧 token 401、幂等与历史记录；
- 账号停用同步回收成员关系、项目授权与角色，活跃成员列表不再返回该用户。
