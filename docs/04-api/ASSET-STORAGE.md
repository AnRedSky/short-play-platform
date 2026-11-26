# 资产与存储（B-09）

资产链路以“登记 → 质检 → 授权 → 正式版”为唯一放行顺序。对象存储只保存文件体，数据库只保存元数据、版本与状态；正式版一经生成，原文件与版本记录保留，后续替换通过新版本完成，不覆盖旧版本。

## 一、直传会话

`POST /projects/{project_id}/asset-uploads` 创建直传会话，返回一次性签名 `upload_url`。服务端只持久化 token 的 sha256，不保存明文 token；客户端直接把原始字节 `PUT` 到该 URL，不经过常规 multipart 上传接口。写入完成后再调用 complete 登记为资产。

当前存储适配器使用本地 `storage` 根目录，`upload_url` 由 `public_base_url + api_v1_prefix + /asset-uploads/{id}/content?token=...` 组成。切换到 S3/OSS 时只需把该适配器替换为预签名 URL，complete 的登记语义不变。

会话字段：`project_id/token_hash/storage_key/filename/mime_type/title/max_bytes/status/checksum/size_bytes/expires_at/completed_at/asset_id/created_by`。状态为 `pending → uploaded → completed`；默认 15 分钟过期，单文件上限取请求 `max_bytes` 与全局 `MAX_UPLOAD_SIZE` 的较小值。

直传约束：

- `PUT` 只认签名 token，不依赖用户 bearer；token 错误返回 `UPLOAD_TOKEN_INVALID`（403）。
- 会话过期返回 `UPLOAD_SESSION_EXPIRED`（409）。
- 空文件 422；超限 `PAYLOAD_TOO_LARGE`（413）。
- 已写入后再 `PUT` 返回 `CONFLICT`（409），complete 之后返回 `UPLOAD_ALREADY_COMPLETED`（409）。
- complete 可带客户端复算的 `checksum`，不一致返回 `UPLOAD_CHECKSUM_MISMATCH`（409）；不带则以服务端写入时计算的 sha256 为准。
- complete 幂等边界：首次成功创建资产；重复 complete 返回 409 并带回原 `asset_id`。

## 二、登记与版本

登记成功后资产默认 `status=registered`、`qc_status=pending`、`authorization_status=pending`、`reference_count=0`，`source=direct_upload`；版本 1 为 `draft`。常规 multipart 上传同样进入登记态，`source=upload`。

`POST /assets/{id}/versions` 新增版本时：

1. 版本号按 `max + 1` 递增，新版本 `status=draft`；
2. 资产 `qc_status` 重置为 `pending`，`qc_at` 清空；`authorization_status` 同时回 `pending` 并清除范围与操作人，`status` 回 `registered`；
3. 旧正式版仍标 `formal` 并保留 `formal_version_id`，直到新版本正式化后才转 `superseded`。

已有数据的 `draft/approved` 继续兼容；渲染导出资产仍写 `approved/source=render`，但补记 `qc_status=passed`、`authorization_status=cleared`。

## 三、质检

`POST /assets/{id}/qc` 请求 `result=通过|拒绝 + note`，检查对象是当前最新版本。结果写入 `asset_qc_checks`，同时记录版本 checksum 与操作人：

- 通过：资产 `qc_status=passed`、`status=qc_passed`；
- 拒绝：资产 `qc_status=failed`、`status=rejected`；
- 资产已是 `formal` 时再次质检返回 `ASSET_ALREADY_FORMAL`（409），正式版不可覆盖；需要重检先上传新版本。

权限使用 `asset.manage`，并要求调用者是项目成员。

## 四、授权标记

`PATCH /assets/{id}/authorization` 请求 `status=pending|cleared|restricted + scope + note`，写入 `authorization_status/authorization_scope/authorization_note/authorized_at/authorized_by`。`cleared` 表示已取得该 `scope` 范围内的使用授权；`restricted` 表示仅限受限范围，二者都视为已人工处理，但只有 `cleared` 允许正式化。

## 五、正式版

`POST /assets/{id}/formalize` 前置校验：

1. `qc_status=passed`，否则 `ASSET_QC_NOT_PASSED`（409）；
2. `authorization_status=cleared`，否则 `ASSET_AUTH_NOT_CLEARED`（409）；
3. 最新版本文件存在，否则 `ASSET_FILE_MISSING`（409）；
4. 文件复算 sha256 必须等于版本 `checksum`，否则 `UPLOAD_CHECKSUM_MISMATCH`（409）。

通过后最新版本标 `formal`，旧正式版标 `superseded`，资产写 `formal_version_id` 并置 `status=formal`。已正式化且无新版本时重复调用为幂等，直接返回当前正式版。

## 六、引用计数

`asset_references` 以 `(asset_id, ref_type, ref_id)` 为唯一键，数据库唯一约束与服务层预查双重保证幂等；新增引用后按实际引用行重算 `reference_count`，删除引用后同样重算，避免 ±1 漂移。迁移会先清理历史重复引用并回填计数。

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/assets/{id}/references` | 引用列表与计数 | `project.read` |
| POST | `/assets/{id}/references` | 登记引用，重复登记不增计数 | `asset.manage` |
| DELETE | `/assets/{id}/references/{reference_id}` | 删除引用并回减 | `asset.manage` |

已接入的两处跨域写入：

- `assets/service.py::export_slideshow()` 生成渲染资产后登记 `export_job` 引用；
- `delivery/service.py::create_output()` 生成分集成片后登记 `episode_output` 引用。

## 七、接口

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| POST | `/projects/{project_id}/asset-uploads` | 创建直传会话 | `creation.write` + 项目成员 |
| PUT | `/asset-uploads/{upload_id}/content?token=...` | 原始字节直传 | 签名 token |
| POST | `/projects/{project_id}/asset-uploads/{upload_id}/complete` | 登记资产 | `creation.write` + 项目成员 |
| POST | `/assets/{id}/qc` | 对最新版本质检 | `asset.manage` + 项目成员 |
| PATCH | `/assets/{id}/authorization` | 更新授权标记 | `asset.manage` + 项目成员 |
| POST | `/assets/{id}/formalize` | 生成正式版 | `asset.manage` + 项目成员 |
| GET/POST/DELETE | `/assets/{id}/references...` | 引用计数 | `project.read` / `asset.manage` |

## 八、验证

`tests/domains/assets/test_storage_flow.py` 7 条：

1. 直传只落 token hash，资产进入 `registered`，版本 1 为 `draft`，checksum 与文件一致；
2. 质检/授权未完成时正式化分别被 `ASSET_QC_NOT_PASSED`、`ASSET_AUTH_NOT_CLEARED` 阻断；通过后闭环到 `formal`；正式版再次质检 409；
3. 新版本上传后 QC 与授权重置，旧正式版保留为 `formal`，新版本正式化后旧版转 `superseded`；
4. 拒绝后资产为 `rejected` 且不能正式化，重检通过后可继续闭环；
5. 引用重复登记不增计数，删除后计数归零，详情同步；
6. token 错误 403，超限 413；
7. complete 校验和不一致 409，重复 complete 409。

迁移：`0015_asset_storage`。
