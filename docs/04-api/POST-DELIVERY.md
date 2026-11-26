# 后期与交付（B-08）

后期链路以“已冻结的时间线版本”为唯一合成口径：分集成片只能引用冻结版本；终审通过后才能交付；交付包一旦生成即冻结，包文件校验和可复核且不可覆盖。

## 一、数据与不可变边界

迁移 `0014_post_delivery` 新增四张表：

| 表 | 关键字段 | 不可变规则 |
| --- | --- | --- |
| `timeline_versions` | `project/episode/version/code/status/timebase/duration_ms/track_count/clip_count/stale_clips/tracks/checksum/frozen_at` | 无修改接口；`code`、`(project, ep, version)` 唯一；冻结后只读 |
| `episode_outputs` | `episode/timeline_version_id/asset_id/status/checksum/size_bytes` | 一集一冻结时间线只允许一条输出；只能引用视频资产 |
| `final_reviews` | `decision/note/quality_report_id/actor` | 只追加；通过/退回与项目迁移同事务 |
| `delivery_packages` | `code/version/status/episodes/files/size/checksum/manifest/storage_key/frozen_at` | `project_id` 唯一；包体与清单冻结后不覆盖 |

时间线 `checksum = sha256(规范化 JSON：episode/version/timebase/duration/tracks)`。再次冻结已冻结版本是幂等操作，不会重写 `frozen_at` 或内容；被新版本替代的草稿为“已替代”，冻结版本保留完整历史。

## 二、分集输出

`POST /projects/{project_id}/episodes/{episode_number}/outputs` 请求：

```json
{
  "timeline_version_id": "uuid",
  "asset_id": "uuid",
  "note": "EP01 final"
}
```

校验顺序：项目处于“后期制作中” → 时间线属于该集且已冻结 → 时间线 checksum 复算一致 → 资产属于本项目、`kind=video`、文件存在 → 同一时间线未重复输出。成功后回写项目 `done` 为已输出集数。

## 三、终审与交付前置

终审要求项目处于“待最终审核”，且最近一份质检报告为 `PASS`；否则分别返回：

- `FINAL_REVIEW_PROJECT_NOT_READY`（409）
- `FINAL_REVIEW_QUALITY_NOT_PASSED`（409）

结论“通过”调用状态机 `finalApprove` → 已完成；结论“退回”调用 `finalReject` → 后期制作中，原因与审核记录同事务留痕。

交付清单 9 项，其中 6 项为必需：分集成片齐备、分集视频文件、时间线冻结、质检报告 PASS、终审通过、校验和留存。任一项缺失返回 `DELIVERY_CHECKLIST_INCOMPLETE`，项目未完成返回 `DELIVERY_PROJECT_NOT_COMPLETED`。

## 四、交付包与校验和

`POST /projects/{project_id}/deliveries` 生成确定性 ZIP：

1. 每集取最新输出，按集号排序；
2. 逐集读取视频文件，复算 sha256，必须同时等于 `episode_outputs.checksum` 与资产 checksum；
3. 写入 `EPxx.<ext>` 与 `manifest.json`（含每集时间线版本、时间线 checksum、输出 checksum、文件大小）；
4. 对完整 ZIP 计算 sha256 作为交付包 checksum；
5. ZIP 写入 `deliveries/{project_id}/DP-{project.code}-01.zip`，交付包行冻结；
6. 调用状态机 `deliver` → 已交付，回写 `delivered`。

下载 `GET /deliveries/{id}/download` 每次复算 ZIP sha256，不一致返回 `DELIVERY_CHECKSUM_MISMATCH`（409）。同一项目已有冻结包时再次交付返回 `DELIVERY_ALREADY_FROZEN`。

## 五、接口

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET/POST | `/projects/{project_id}/timelines` | 列表/新建版本 | `project.read` / `post.write` |
| GET | `/timelines/{timeline_id}` | 版本详情与轨道 | `project.read` |
| POST | `/timelines/{timeline_id}/freeze` | 冻结，幂等 | `post.write` |
| GET | `/projects/{project_id}/episode-outputs` | 分集输出 | `project.read` |
| POST | `/projects/{project_id}/episodes/{episode_number}/outputs` | 登记分集成片 | `post.write` |
| GET/POST | `/projects/{project_id}/reviews` | 终审记录/提交结论 | `project.read` / `final.review` |
| GET | `/projects/{project_id}/delivery-checklist` | 交付清单 | `delivery.read` |
| GET/POST | `/projects/{project_id}/deliveries` | 交付记录/生成冻结包 | `delivery.read` / `delivery.execute` |
| GET | `/deliveries/{package_id}` | 交付详情与 manifest | `delivery.read` |
| GET | `/deliveries/{package_id}/download` | 下载前复算校验和 | `delivery.read` |

## 六、验证

`tests/domains/delivery/test_router.py` 6 条：

1. 冻结幂等、V2 新建不覆盖 V1；
2. 未冻结拒绝输出、重复输出拒绝、`done` 回写；
3. 终审缺质检 PASS 拒绝，退回回到后期；
4. 项目未完成/清单缺项拒绝交付；
5. 两集完整流程生成 ZIP，下载 sha256 与交付包一致，项目变“已交付”，二次交付与新建时间线均 409，V1 时间线 checksum 不变；
6. 篡改包文件后下载返回 `DELIVERY_CHECKSUM_MISMATCH`。

本地结果：交付域 6 passed；后端全量 160 passed；`ruff check` 全绿。
