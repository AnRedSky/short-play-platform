# API 对接清单补充（前端生产模块）

产品基线：`docs/02-requirements/PRODUCT_SCOPE_AND_MVP.md`。统一前缀 `/api/v1`，Envelope、认证、分页和错误规范见本文件前文与 `docs/04-api/API_CONVENTIONS.md`。本次增加的生产模块仅完成可浏览 UI 原型与本地演示数据；没有正式 OpenAPI schema 的接口不由前端虚构请求。

## M2 故事、剧集与剧本
| 场景 | 方法/路径 | 入参 | 出参 | 状态 |
|---|---|---|---|---|
| 项目剧集列表/创建 | GET/POST `/projects/{project_id}/episodes` | Query page/page_size；Create: episode_number, title, synopsis | EpisodeRead[] / EpisodeRead | 路由已存在；字段/分页须 OpenAPI 核对 |
| 剧集详情 | GET `/episodes/{episode_id}` | UUID Path | EpisodeRead | 路由已存在 |
| 剧集故事列表/创建 | GET/POST `/projects/{project_id}/stories` | Create: title, logline, synopsis | StoryRead[] / StoryRead | 路由已存在 |
| 故事圣经列表/创建版本 | GET/POST `/projects/{project_id}/story-bibles` | content: object | StoryBibleRead[] / StoryBibleRead | 路由已存在 |
| 剧集脚本创建 | POST `/episodes/{episode_id}/scripts` | title | ScriptRead | 路由已存在 |
| 脚本版本列表/创建 | GET/POST `/scripts/{script_id}/versions` | content: object | ScriptVersionRead[] / ScriptVersionRead | 路由已存在 |
| 场次列表/创建 | GET/POST `/script-versions/{version_id}/scenes` | ScriptSceneCreate schema | ScriptSceneRead[] / ScriptSceneRead | schema 核对中 |
| 对白创建 | POST `/script-scenes/{scene_id}/dialogues` | ScriptDialogueCreate schema | ScriptDialogueRead | schema 核对中 |

## M2 资产与分镜
| 场景 | 方法/路径 | 入参 | 出参 | 状态 |
|---|---|---|---|---|
| 角色列表/创建 | GET/POST `/projects/{project_id}/characters` | AssetCreate: name, description | AssetRead[] / AssetRead | 路由已存在 |
| 角色详情/版本 | GET `/characters/{character_id}`；POST `/characters/{character_id}/versions` | UUID Path；AssetVersionCreate | AssetDetailRead / AssetVersionRead | 路由已存在 |
| 场景资产列表/创建 | GET/POST `/projects/{project_id}/scenes` | AssetCreate | AssetRead[] / AssetRead | 路由已存在 |
| 道具列表/创建 | GET/POST `/projects/{project_id}/props` | AssetCreate | AssetRead[] / AssetRead | 路由已存在 |
| 分镜创建 | POST `/episodes/{episode_id}/storyboards` | version_number | StoryboardRead | 路由已存在 |
| 镜头列表/创建 | GET/POST `/storyboards/{storyboard_id}/shots` | ShotCreate schema | ShotRead[] / ShotRead | schema 核对中 |
| 镜头合同列表/创建 | GET/POST `/shots/{shot_id}/contracts` | payload: object | ShotContractRead[] / ShotContractRead | 路由已存在；payload 按 Shot Contract 规范 |

## M3 生成、MVP QA/交付
| 场景 | 方法/路径 | 入参 | 出参 | 状态 |
|---|---|---|---|---|
| Provider 状态 | GET `/models/providers` | 无 | code, healthy[] | 路由已存在 |
| 创建生成任务 | POST `/projects/{project_id}/generation/tasks` | capability, prompt, parameters?, model_code?, provider_code?, shot_id?；Idempotency-Key | GenerationTaskRead | 路由已存在 |
| 查询任务详情 | GET `/generation/tasks/{task_id}` | task UUID | GenerationTaskDetailRead + attempts[] | 路由已存在 |
| 取消任务 | POST `/generation/tasks/{task_id}/cancel` | task UUID | GenerationTaskRead | 路由已存在 |
| 任务列表/重试/事件流 | 待定 | 需后端定义过滤器、重试幂等和 SSE event schema | Task[] / event stream | 待后端 |
| QA 规则执行/结果查询 | 待定 | object/version、rule_set | QualityResult: PASS/REVIEW_REQUIRED/FAIL/WAIVED + issues[] | 待后端正式契约 |
| 人工审核/返工 | 待定 | object_version_id、decision、comment、reason | ReviewRecord / ReworkTask | 待后端正式契约 |
| 媒体上传/下载 | 待定 | multipart、checksum、media metadata | Asset/AssetVersion + authorized URL | 待后端正式契约 |
| 时间线版本 | 待定 | frame_rate、tracks、clips、source ranges、audio/subtitle config | TimelineVersion | 待后端正式契约 |
| 导出任务 | 待定 | timeline_version_id、ExportProfile | ExportJob、progress、artifact | 待后端正式契约 |

## UI 原型限制
生产模块演示记录只存在浏览器内存；不调用真实生成 Provider、QA、审核、媒体存储或 FFmpeg。正式接口开放后通过统一 services 层接入，替换 demo adapter，不在 Vue 组件内直接 fetch。
