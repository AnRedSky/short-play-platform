# 短剧平台开源竞品分析清单

> 调研时间：2026-11-21　数据来源：GitHub 仓库元数据（stars / fork / language / topics / README）　对照基线：本仓库 `prototype/v4`（长夜制作台 · 私有化 AI 短剧智能生产管理平台）
>
> 口径说明：stars 为检索时点的 GitHub 星标数，仅作热度参考；能力判断以仓库 README 与公开目录为准，未接入真实运行环境验证。本项目定位为**私有化、单企业主体**的内部生产管理平台，不建设 SaaS 多租户、公开分发与付费售卖；竞品中的商业化、计费、分销能力仅作交互与业务闭环参考，不直接照搬进本平台。

## 一、调研范围与分组

围绕"短剧平台"这一主题，将检索到的开源项目分为三组：

- **A 组 · B 端 AI 短剧制作工作台**：剧本、资产、分镜、生成、配音、剪辑、导出的生产链路，是与本项目同构的核心对照对象。
- **B 组 · C 端播放与分发客户端**：竖屏播放、选集、收藏历史、付费解锁、充值分销等面向观众的形态，用于借鉴播放交互与成片消费闭环。
- **C 组 · 技能包 / 提示词资产**：以剧本、分镜、提示词模板为主的 Agent 技能合集，不是完整平台，仅作能力颗粒度参考。

## 二、竞品总表

### A 组 · B 端 AI 短剧制作工作台

| # | 仓库 | Stars | 技术栈 | 产品定位 | 核心功能模块 | 页面布局形态 | 关键亮点 / 局限 |
|---|---|---:|---|---|---|---|---|
| A1 | [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | 144.9k | Python · Streamlit WebUI + FastAPI API + CLI | 主题/关键词一键生成短视频（非短剧专用，工作流可复用） | 脚本生成与改写、素材匹配、TTS 配音、字幕（时间戳/Whisper）、配乐、FFmpeg 合成、批量生成、任务历史、跨平台发布 | 单页表单式配置 + 阶段进度条；WebUI / API / CLI / Agent 四种入口 | 多 LLM/TTS Provider 适配成熟；阶段进度与批量重试完善；无剧本分集、角色一致性、审核与团队协作概念 |
| A2 | [HBAI-Ltd/Toonflow-app](https://github.com/HBAI-Ltd/Toonflow-app) | 22.4k | TypeScript · Vue3 · Bun · Electrobun 桌面 | 开源 AI 短剧/漫剧/视频创作平台 | 剧本与分镜文本节点、角色/场景/道具资产画布、图片生成、图生视频、3D 导演台镜头预演、插件市场、MCP 接入、开放 Agent/A2A、21 语言 | **无限画布 + 节点编排**；项目首页、快速配置、深/浅主题画布、资产画布、导演台、角色三视图、视频生成、节点菜单分组 | 画布化创作与扩展生态（插件/MCP/Agent）最完整；角色三视图与多参考视频生成；无登录鉴权，无团队权限、审核、预算治理 |
| A3 | [chatfire-AI/huobao-drama](https://github.com/chatfire-AI/huobao-drama) | 17.8k | Nuxt3 + Vue3 + TS 前端；Hono + Drizzle ORM + SQLite + Mastra Agents 后端；Electron 桌面 | 一句话生成完整短剧，剧本到成片全自动 | 4 个内置 Agent（剧本改写、实体提取、分镜拆解、提示词生成）、项目创建（比例/风格）、剧本 AI 改写、资产提取与形象生成、分镜拆解、@角色引用映射、批量视频生成与失败重试、FFmpeg 拼接、在线播放下载、剧集进度栏 | 项目卡片列表 → 单集工作台纵向阶段推进；顶栏模型即时切换；右侧提示词检查面板；左侧进度导航 | 阶段向导闭环清晰，Agent 职责拆分到位，Skill 可界面内编辑；单机 SQLite，无多用户/RBAC/审核治理 |
| A4 | [Forget-C/Jellyfish](https://github.com/Forget-C/Jellyfish) | 7.3k | FastAPI + React/Vite；MySQL + Redis + RustFS；Apache-2.0 | 端到端 AI 短剧制作工作台 | 剧本理解与分镜拆解、实体（角色/演员/场景/道具/服装）一致性管理、镜头候选确认流（接受/忽略/关联）、镜头就绪状态、关键帧与参考图管理、单镜/批量生成预检、统一异步任务中心、多 Provider/模型/提示词模板、文件媒体管理、OpenAPI 前后端契约 | 项目总览 + 资产管理双栏；镜头准备工作流；生成工作台；全局任务中心可回跳项目/章节/镜头 | "候选确认 → ready → 生成"状态机严谨，任务可追踪可取消可回跳；OpenAPI 契约驱动前后端；时间线剪辑与配音能力弱 |
| A5 | [yi1108/printfilm](https://github.com/yi1108/printfilm) | 7.2k | Python | AI 短视频营销 + AI 短剧创作平台 | 营销短片与短剧生成链路、视频生成编排 | 工作台式 | 营销场景模板化；公开文档中团队协作与治理模块披露较少 |
| A6 | [xuanyustudio/LocalMiniDrama](https://github.com/xuanyustudio/LocalMiniDrama) | 2.5k | Electron + Node.js + Vue3；本地离线 | 本地优先 AI 短剧/漫剧生成工具 | 故事 → 分镜 → 视频本地流水线、工作流管理、高灵活度参数、真人剧/漫剧 | 桌面应用内工作台 | 数据不出本机、离线可用；功能覆盖偏生成执行，缺管理与审核 |
| A7 | [Stonewuu/ai-fusion-video](https://github.com/Stonewuu/ai-fusion-video) | 1.8k | Java · AgentScope 2.0 | Agent 驱动全流程短剧/漫剧/视频创作平台 | Agent 编排的剧本、分镜、图/视频生成 | Agent 工作台 | Java 技术栈与 Agent 框架结合；前端与治理能力披露有限 |
| A8 | [LingGuoAI/LingGuo-Drama](https://github.com/LingGuoAI/LingGuo-Drama) | 1.7k | Go | 一站式短剧/漫剧全自动生成 | 剧本到成片自动化流水线 | Web 工作台 | 全自动链路；工程化细节与角色一致性方案披露有限 |
| A9 | [alibaba/lumenx](https://github.com/alibaba/lumenx) | 1.5k | Python 后端 + Next.js 前端；MIT | AI 原生短漫剧与视频创作平台 | **双模块**：Studio（剧本分析→分镜→资产→视频→合成→导出）+ Playground（脱离剧本上下文的独立图/视频生成台）；模型目录（YAML→JSON）、TTS 配音、多 Provider 直连/代理、本地优先 + OSS 镜像 | Studio 分镜工作台；Playground 独立创作台；全局布局模块 | 生产管线与独立生成台分离的产品结构清晰；模型目录化配置；团队/权限/审核非其目标 |
| A10 | [shijue-aid/aid-studio](https://github.com/shijue-aid/aid-studio) | 1.5k | Java17 + SpringBoot3.5 + MyBatis-Plus + MySQL + Redis + RocketMQ + Quartz + OSS；React 管理端 + Web 创作端；MIT | 可自部署的 AI 漫剧/短剧/电影/漫画平台，含运营后台 | 剧本分集、角色/道具/场景资产库与角色配音绑定、分镜工作台、图生视频/首尾帧/多镜头批量、TTS 多音色与对口型、成片预览；统一 Provider 编排（能力/参考图数/分辨率/时长/比例可配）；统一任务系统（排队/并发调度/进度推送/重试/补偿/回收）；**计费体系**（按 SKU 计费、余额冻结结算、充值套餐、支付宝/微信）；**用户体系**（账号/短信/邮箱/扫码、实名、邀请激励）；运营后台（模型/供应商/智能体/提示词/内容/订单/用户/存储/配置）；Docker/systemd 部署、在线升级与回退 | 用户创作端（流程画布 + 流程化创作双入口）+ 独立 React 运营管理端 | 三端同版本、商业化与运营闭环最完整；流程画布与向导双模式；体量偏大，私有化内部场景下计费/实名/支付模块不需要 |
| A11 | [Swayingleaves/novanova-studio](https://github.com/Swayingleaves/novanova-studio) | 0.97k | Java21 + SpringBoot3.5 + WebFlux + AgentScope Java；Next16 + React19 + React Flow + AntD + Tailwind + Zustand；PostgreSQL17 + Redis Stream + 多对象存储 | Agent 驱动全流程开源平台 | 无限画布、对话式图/视频生成与迭代、Agent Profile、小说解析转短剧、3D 导演台、提示词优化、生成记录与资产沉淀、渠道适配器与模型能力/积分规则配置；邮箱/OAuth 登录、积分、通知、提示词库、首页展示、管理后台 | Next.js 创作工作台 + React Flow 无限画布 + 对话面板；管理后台 | Redis Stream 消费组 + 任务锁 + SSE 实时事件的长任务机制成熟；画布上下文连续创作；积分/登录属公开运营形态 |
| A12 | [looplj/reveric](https://github.com/looplj/reveric) | 0.93k | Dart 桌面 | Agent Native 小说 + 短剧桌面创作工作台 | 小说到短剧、无限画布、Agent 协作 | 桌面工作台 | 桌面端 Agent 形态；Web 化与多端能力弱 |
| A13 | [TypeTale/TypeTale](https://github.com/TypeTale/TypeTale) | 0.92k | 原生应用 | 免费 AIGC 视频生成，面向 AI 短剧/电影/小说推文 | 文本驱动视频生成、成片导出 | 单机工具界面 | 轻量出片工具；无项目管理与团队协作 |
| A14 | [ChrisChen667788/wind-comic](https://github.com/ChrisChen667788/wind-comic) | 0.72k | TypeScript · Next.js | 多 Agent 文本到短剧 pipeline | 编剧 → 分镜 → 关键帧 → 角色一致视频；Provider 无关（OpenAI/Claude、MJ、Minimax、Veo/Sora、fal、ComfyUI） | Web 工作台 | Provider 抽象干净；前端工程与治理模块较轻 |
| A15 | [Anil-matcha/Open-AI-Micro-Drama-Generator](https://github.com/Anil-matcha/Open-AI-Micro-Drama-Generator) | 0.59k | Python FastAPI + Next.js | 多 Agent 微短剧生成器 | 编剧/分镜/帧/视频 pipeline；Seedance、Kling、Veo、Sora 等模型 | Web 工作台 | 多模型接入展示；分集管理与审核薄弱 |
| A16 | [yfge/ai-video-studio](https://github.com/yfge/ai-video-studio) | 0.07k | Python FastAPI + Next.js + LangGraph | 面向专业短剧团队的视频制作工作台 | Timeline-first、Agent 辅助、分镜与视频生产 | 时间线优先工作台 | 时间线先行的编排思路；社区规模小 |
| A17 | [EvoLinkAI/ai-short-drama](https://github.com/EvoLinkAI/ai-short-drama) | 0.07k | TypeScript · Next.js；MIT | 小说转视频自托管平台 | 20+ 模型接入、图/视频/配音生成、自托管 | Web 工作台 | 模型数量多；深度生产能力有限 |
| A18 | [charliewwdev/OpenMontage](https://github.com/charliewwdev/OpenMontage) | 0.06k | Python FastAPI + React + Docker Compose | 短剧/短视频/产品广告 AI 工坊 | 一句话创意 → 剧本/选角/分镜/视频/配音/剪辑 | Web 工作台 | 链路齐全；早期阶段 |
| A19 | [JerrIsTheBesta/AI-Short-Drama-Studio](https://github.com/JerrIsTheBesta/AI-Short-Drama-Studio) | 0.06k | TypeScript · Electron + Vue3 + ffmpeg-wasm | 开源 AI 短剧/视频工作流工作室 | LLM、视觉理解、生图、图生视频、配音、字幕、浏览器内剪辑 | 桌面工作室 | ffmpeg-wasm 浏览器内剪辑；团队能力弱 |
| A20 | [shuyu-labs/BigBanana-AI-Director](https://github.com/shuyu-labs/BigBanana-AI-Director) | 2.5k* | 未公开明细 | 工业级 AI 导演平台 | Script-to-Asset-to-Keyframe 工作流，角色一致性、场景连续性、镜头运动控制 | 导演工作台 | 工业化一致性控制思路；*热度来自相关榜单聚合，仓库细节待核 |

### B 组 · C 端播放与分发客户端

| # | 仓库 | Stars | 技术栈 | 产品定位 | 核心功能模块 | 页面布局形态 | 关键亮点 / 局限 |
|---|---|---:|---|---|---|---|---|
| B1 | [Donkor798/hajimi_short_video_drama](https://github.com/Donkor798/hajimi_short_video_drama) | 0.06k | Flutter 3.22 · MVVM + Provider · video_player · sqflite · Fluro · EasyRefresh | 专业短剧观看 App | 抖音式上下滑切集、沉浸式全屏、预加载、收藏、播放历史、搜索历史、设置、中英 i18n、图片缓存 | 首页 / 分类 / 详情 / 竖屏播放 / 收藏 / 我的 六页 | C 端播放交互范式最典型；数据存本地 SQLite，无后端账号体系与付费能力 |
| B2 | [pan8664716/HGTV](https://github.com/pan8664716/HGTV) | 1.0k | 原生 Android | 短剧客户端（手机/平板/Android TV） | 剧集浏览、播放、TV 适配 | 竖屏 + TV 双形态 | 多端适配；开源后端与内容治理未含 |
| B3 | [N3urda/hongguoTV](https://github.com/N3urda/hongguoTV) | 1.5k | Kotlin · Android TV | 安卓 TV 短剧客户端 | TV 端浏览与播放 | TV 大屏形态 | 大屏遥控器交互；移动端体验未覆盖 |
| B4 | [yangbin1322/hongguo-player](https://github.com/yangbin1322/hongguo-player) | 4.5k | Wails(Go) + Vue3 · 桌面 | 桌面端短剧播放器 | 找剧、选集、收藏、续播、HEVC 播放 | 桌面窗口应用 | 桌面刷剧形态；依赖外部内容源 |
| B5 | [jackotom/hongguo-drama](https://github.com/jackotom/hongguo-drama) | 2.6k | Electron · GPL-3.0 | 桌面短剧客户端 | 三来源搜索、播放、下载、追剧 | 桌面窗口应用 | 多源聚合与追剧；离线下载 |
| B6 | [ch6vip/novel-sound](https://github.com/ch6vip/novel-sound) | 1.7k | Flutter + Rust 进程内核心 | 内容聚合客户端（小说/短剧/漫剧/听书/漫画） | 多品类内容浏览、播放、本地收藏 | 聚合首页 + 品类详情 | 多品类统一容器；无自建服务器 |
| B7 | [ssanii-001/vignette-video](https://github.com/ssanii-001/vignette-video) | 0.02k | Java 后端 + UniApp(Vue) | 微短剧观看与分发应用 | 视频流、剧集播放、**付费解锁**、虚拟支付/微信支付、账户充值、VIP、充值记录、消费记录、**分销管理**、签到、邀请；微信/抖音/快手小程序 + H5 + App 多端 | C 端信息流 + 剧集详情 + 充值/会员页 + 分销后台 | 唯一覆盖完整付费/分销闭环的样本；代码质量与合规性需自行评估，本项目不照搬其支付与分销 |

### C 组 · 技能包 / 提示词资产（非平台，仅作能力颗粒度参考）

| # | 仓库 | Stars | 形态 | 覆盖环节 |
|---|---|---:|---|---|
| C1 | [eternityspring/shuohao-skills](https://github.com/eternityspring/shuohao-skills) | 6.9k | Agent Skill 集 | 角色设定、改编大纲、场景道具设定、剧本、分镜 |
| C2 | [zenstory-ai/drama-skills](https://github.com/zenstory-ai/drama-skills) | 4.6k | Agent Skill 集 | 小说改剧本、视觉设定、分镜、生图/生视频提示词、剪辑成片 |
| C3 | [liangdabiao/Seedance2-Storyboard-Generator](https://github.com/liangdabiao/Seedance2-Storyboard-Generator) | 2.9k | Skill 工具 | 小说/故事转多集视频、剧本与分镜提示词 |
| C4 | [UnderleveledBuilder/awesome-short-drama-skills](https://github.com/UnderleveledBuilder/awesome-short-drama-skills) | 2.7k | 精选清单 | 剧本、改编、分镜、各视频模型提示词 |
| C5 | [0xsline/short-drama](https://github.com/0xsline/short-drama) | 1.7k | 剧本创作 Skill | 选题立项、分集撰写、质量自检、合规审核、出海 |
| C6 | [Shanyin-ai/shanyin-screenwriting-master](https://github.com/Shanyin-ai/shanyin-screenwriting-master) | 1.5k | 编剧 Skill | 人物设计、结构大纲、场景拆解、全格式剧本 |

## 三、五维归纳

### 3.1 技术架构

- **后端形态三类**：① 单体 Web 工作台（Python FastAPI / Node Hono+Drizzle / Java Spring Boot / Go）；② 桌面应用壳（Electron、Electrobun、Wails、Flutter Desktop）内嵌本地服务或纯前端；③ C 端移动客户端（Flutter、Kotlin、UniApp）配 Java/Node 后端。
- **异步任务是标配**：长耗时生成普遍走独立队列——Celery/RabbitMQ、Redis Stream 消费组、RocketMQ、Mastra Agent 或 LangGraph；任务状态、取消、重试、结果回收与上下文回跳是必备基础设施。
- **存储分层**：单机轻量方案用 SQLite + 本地文件；团队化方案用 MySQL/PostgreSQL + Redis + 对象存储（OSS/COS/Kodo/R2/RustFS）；媒体文件单独存对象层，库内只存元数据与引用。
- **Provider 适配解耦**：文本/图片/视频/语音四类能力各设适配器；模型目录登记能力档位（参考图数量、分辨率、时长、画幅、是否支持首尾帧/对口型），前端按能力显隐参数项。
- **前后端契约**：成熟样本以 OpenAPI/Swagger 生成前端类型与请求层（Jellyfish、aid-studio），后端领域层与 Web 层分离。

### 3.2 核心功能模块

按生产链路归纳，竞品覆盖度从高到低为：

1. **项目与剧集**：项目卡片、剧集季卡、创建后锁定画幅/风格、集状态与进度。
2. **剧本创作**：小说导入/粘贴、AI 改写拍摄剧本、按集拆分、场景与角色标注、版本记录、一致性检查。
3. **实体资产**：角色/演员/场景/道具/服装库，参考图与三视图，资产跨镜头复用，名称查重鼓励复用。
4. **分镜与镜头**：剧本拆镜、镜头候选确认（接受/忽略/关联既有资产）、镜头就绪状态、Shot Contract、关键帧与参考图、视频提示词与 `@角色` 引用映射。
5. **媒体生成**：文生图/图生图/多图融合、图生视频/首尾帧/多镜头批量、单镜与批量预检、候选结果回写镜头。
6. **配音语音**：TTS 多音色、音色库、角色配音绑定、参考音频克隆、试听预览、对口型状态。
7. **剪辑合成**：多轨时间线（视频/音频/字幕）、片段拖拽缩放、字幕样式、配乐、FFmpeg 合成、多规格导出。
8. **任务中心**：队列、进度、耗时、失败诊断、重试/取消、全局任务可回跳对应项目/集/镜头。
9. **审核质检**：人工批注、PASS/REVIEW/FAIL 结论、退回重做、质量门禁解锁下游环节（本项目基线已具备，多数轻量竞品缺失）。
10. **模型与提示词治理**：Provider/模型管理、分类默认模型、提示词模板库、风格快照、连通测试。
11. **团队与治理**：账号、角色、项目授权、组织架构、审计、用量预算（仅本项目与 aid-studio、novanova 等少数样本覆盖）。
12. **商业化与运营**：充值套餐、余额冻结结算、按量计费、VIP、付费解锁、分销、签到、邀请激励、订单与内容运营后台（B7、A10、A11）。
13. **扩展生态**：插件市场、MCP、Agent/A2A、技能包、ComfyUI 工作流接入（A2、A3、A11）。

### 3.3 页面布局方案

- **工作台首页**：项目卡片网格 + 今日待办 + 生产动态 + 阶段流水线入口；首次进入有快速配置引导。
- **创作主界面两种范式**：
  - **阶段向导式**（A3、A4、A9 Studio）：左侧集/阶段导航，中间正文工作台，右侧属性/提示词面板；顶部进度栏逐阶段点亮。
  - **无限画布式**（A2、A11、A10 画布入口）：文本/角色/场景/镜头/视频节点同画布编排，节点连线表达引用与生成关系，支持分组、缩放、3D 导演台预演。
- **资产库**：网格卡片 + 类型筛选 + 状态/版本标签 + 锁定态；详情抽屉展示版本与引用次数。
- **分镜台**：9:16 画幅网格排列镜头，候选图/视频缩略图，提示词与状态侧栏，送审操作在行内。
- **任务中心**：队列表格/卡片，状态徽章、进度条、耗时、错误诊断、重试/取消按钮；点击回跳来源镜头。
- **时间线**：多轨横向条带，片段可拖拽、可缩放，字幕/音频独立轨道。
- **C 端播放**：竖屏全屏沉浸式，上下滑切集；底部标题/简介/互动栏；首页信息流、分类页、详情页、收藏/历史/我的标准五页结构。
- **运营后台**：独立于创作端的第二套前端（A10 admin、A11 管理后台），覆盖用户、订单、模型、内容、配置。

### 3.4 用户交互逻辑

- **状态驱动推进**：剧本 → 资产 → 分镜 → 生成 → 质检 → 剪辑 → 导出，每环有明确就绪条件；未就绪不可进入下游（A4 的 ready 状态、本项目的质量门禁）。
- **候选确认流**：AI 提取的实体/对白以候选形式列出，逐条接受、忽略或关联既有资产，避免脏数据直接进生产库。
- **顶栏即时切换**：文本/图片/视频模型在创作页顶栏可切，分辨率/时长档位随模型能力联动。
- **引用即映射**：提示词中 `@角色名` 自动绑定对应参考图；资产被镜头引用后保留来源上下文。
- **批量与失败回收**：批量发起生成，失败任务一键重试；长任务不阻塞当前页面，结果经轮询或 SSE 推送回写。
- **版本不可变**：剧本、圣经、镜头合同、资产均生成新不可变版本，旧版可追溯不被覆盖。
- **预览先行**：镜头悬停预览单条片段，成片可在线播放后再标记完成。
- **权限分层**：菜单可见性、路由可达性、按钮可用性三层判定；无权限入口不展示而非置灰报错（本项目基线已实现）。
- **反馈闭环**：Toast 轻提示、弹窗二次确认、抽屉详情、空态/加载/错误/403/404 状态齐备。
- **菜单信息架构（侧栏分层）**：参考 MapleTechLabs/maple（可观测工作台）与 codustry/khaopad（CMS 管理台）两套开源导航实现，共性范式为——一级主入口只放高频直达功能，同域细分页收纳为父条目下的二级子菜单；菜单按业务生命周期分组，治理/设置类入口下沉独立折叠组；个人自助入口不设权限门槛；菜单由注册表（组 + 条目）驱动，新功能追加注册项即可扩展；条目可见性按角色权限过滤，无权限不展示。本项目 V5.2 据此将侧栏重构为总览 / 创作 / 制作 / 审核与交付 / 系统管理五组，次要视图（小说改编、分镜画布、剪辑时间线）收纳为二级子菜单。V5.3 进一步收敛：业务侧栏只保留概览 / 工作台 / 资产三组，治理与设置类入口完全下沉到左下账号配置面板（不再占侧栏折叠组），品牌块与项目切换卡片也从侧栏顶部移除。

### 3.5 已实现的业务能力

- **内容生产侧**：从灵感到成片的全链路 AI 辅助创作，覆盖文本、图像、视频、语音、合成五类媒体的生成与编排。
- **团队协作侧**：项目成员、角色分工、资产复用、任务分派、审核批注、版本追溯——仅 Jellyfish、aid-studio、novanova 与本项目等少数样本成体系。
- **平台运营侧**：账号体系、模型渠道管理、计费/积分、订单、内容审核、通知、管理后台；多见于公开商业化产品（A10、A11、B7）。
- **分发消费侧**：多端播放、追剧收藏、历史续播、付费解锁、会员、分销返佣、签到邀请（B 组与 B7）。
- **扩展定制侧**：插件市场、MCP 工具接入、自定义 Agent 与技能、ComfyUI 私有工作流、模型渠道模板。

## 四、与本项目（V4 基线）对照矩阵

图例：● 已实现/成体系　◐ 部分实现或原型演示中　○ 竞品有覆盖、本项目未实现或薄弱

| 能力项 | 本项目 V4 | 竞品覆盖情况 | 差距判断 |
|---|:---:|---|---|
| 项目/剧集管理、成员授权 | ● | A3/A4/A9 | 基线对齐，项目双层授权为独有优势 |
| 故事圣经与剧本版本 | ● | A3/A4/C1/C2 | 基线对齐 |
| 角色/场景/道具/服装资产库 | ● | A2/A4/A10 | 服装实体与资产复用查重可补细节 |
| 分镜台与 Shot Contract | ● | A2/A3/A4 | 已有网格视图；缺画布化节点编排视角 |
| 图片/视频生成与任务中心 | ◐ | A1/A3/A4/A11 | 异步任务、取消、重试已有契约；实时进度推送与失败诊断体验待增强 |
| 质检与人工审核门禁 | ● | A4/A10 | 基线强于多数轻量竞品，保持 |
| 多轨时间线剪辑 | ◐ | A16/A19/A10 | 持久化时间线与片段编排仍是后端缺口，原型以演示态呈现 |
| 配音 / TTS / 角色音色绑定 | ○ | A10/A9/A19 | 竞品普遍有音色库与试听；本项目 V4 路由未设独立配音台，为明显缺口 |
| 成片预览与审片消费闭环 | ◐ | B1/B4/B5 | 仅有播放器式质检；缺竖屏沉浸式预览、上下滑切集、批注与版本对比 |
| 独立生成台（Playground） | ○ | A9 | 脱离剧本上下文的即开图/视频生成台缺失 |
| Agent 角色与技能/提示词模板库 | ◐ | A3/A11/C1–C6 | 有 Provider 适配器与工作流；缺专职 Agent 卡、技能包与模板库的可视化管理 |
| 模型目录与能力矩阵配置 | ◐ | A4/A10/A11 | Provider/模型已有页面；能力档位、参考图上限、比例时长校验的可视化呈现可增强 |
| 无限画布 / 导演台 | ○ | A2/A11/A10 | 画布编排与镜头预演为竞品高频形态，本项目未覆盖 |
| 团队 RBAC / 组织 / 审计 / 预算用量 | ● | A10/A11 | 基线领先；竞品多为单机或公开运营形态，无企业级权限治理 |
| 私有化合规与数据边界 | ● | — | 本项目独有：资产项目内隔离、数据外发策略、审计保留、部署安全基线 |
| 计费 / 充值 / VIP / 付费解锁 / 分销 | ○ | A10/A11/B7 | 属公开商业化能力，**不在本项目私有化边界内**，仅记录不建设 |
| 插件市场 / MCP / Agent 扩展 | ○ | A2/A3/A11 | 扩展生态为中长期方向，原型预留入口与说明 |
| 多语言 / 多端发布 | ○ | A2/A3/B 组 | 内部平台暂不需要；出海与多端发布列入路线图观察项 |

## 五、机会点与原型优化方向（映射 V5）

基于上表差距，V5 原型在守住私有化边界的前提下，吸收竞品成熟交互，按优先级落地以下优化：

1. **创作主界面补画布视角**：在分镜台之外新增无限画布视图，角色/场景/镜头/生成结果以节点编排，连线表达引用与生成关系；保留阶段向导式工作台作为并行入口（对标 A2/A11/A10 双入口）。
2. **新增配音台**：角色音色绑定、TTS 音色库、试听与试听波形、对口型状态、配音轨道清单，纳入时间线音频轨来源（对标 A10/A9）。
3. **新增成片预览中心**：竖屏沉浸式预览、上下滑切换镜头/集、批注、版本对比、收藏与审片结论回写质检；面向内部审片，不接付费解锁（对标 B1 播放交互 + A4 审核回写）。
4. **新增独立生成台 Playground**：脱离剧本上下文的文生图/图生图/文生视频/配音即开生成，历史结果可一键收入项目资产库（对标 A9）。
5. **Agent 与技能面板**：专职 Agent 卡片（剧本改写、实体提取、分镜拆解、提示词生成）、技能包与提示词模板库、项目风格快照；运行结果可追溯（对标 A3/A11/C 组）。
6. **任务中心体验增强**：SSE 风格实时进度表现、失败诊断摘要、一键重试失败任务、任务回跳来源镜头（对标 A4/A11）。
7. **模型能力矩阵可视化**：Provider 卡片展示能力档位、参考图上限、支持比例/时长、连通状态；新建项目时画幅与风格锁定规则前置说明（对标 A3/A10）。
8. **首次配置引导**：未配置 Provider 时顶部引导横幅，快捷配置与手动模板并存，连通性测试后消失（对标 A3）。
9. **工作台首页增强**：阶段流水线全景、待办、项目卡、AI 快捷创作入口（一句话原创 / 导入小说）、生产动态一屏汇聚（对标 A3/A9）。
10. **一致性与就绪状态可视化**：镜头候选确认流、资产复用查重、就绪条件清单在分镜与资产页显性呈现（对标 A4）。

不纳入 V5 的方向：充值/计费/VIP/付费解锁/分销/邀请激励（公开商业化能力）、公网多租户与自助开通、外部内容源爬虫采集、插件市场公网生态；这些在原型中仅以"路线图观察项"注释，不做可用入口。

落地状态：机会点 1–5 已在 V5 静态原型中实现（分镜画布、配音台、成片预览中心、独立生成台 Playground、专职 Agent 与模板/风格快照数据），6–10 作为后续迭代方向保留。原型入口与逐页说明见 [`prototype/v5/README.md`](../../prototype/v5/README.md)。

## 六、参考仓库索引

- A 组：A1 MoneyPrinterTurbo · A2 Toonflow-app · A3 huobao-drama · A4 Jellyfish · A5 printfilm · A6 LocalMiniDrama · A7 ai-fusion-video · A8 LingGuo-Drama · A9 lumenx · A10 aid-studio · A11 novanova-studio · A12 reveric · A13 TypeTale · A14 wind-comic · A15 Open-AI-Micro-Drama-Generator · A16 ai-video-studio · A17 ai-short-drama · A18 OpenMontage · A19 AI-Short-Drama-Studio · A20 BigBanana-AI-Director
- B 组：B1 hajimi_short_video_drama · B2 HGTV · B3 hongguoTV · B4 hongguo-player · B5 hongguo-drama · B6 novel-sound · B7 vignette-video
- C 组：C1 shuohao-skills · C2 drama-skills · C3 Seedance2-Storyboard-Generator · C4 awesome-short-drama-skills · C5 short-drama · C6 shanyin-screenwriting-master
