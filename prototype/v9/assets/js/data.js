/* data.js：数据层。只读业务字典、当前身份、角色定义与枚举映射。
   全部数据为虚构演示数据（企业、员工、项目、任务、金额均为样例），不代表真实业务记录。
   渲染时不得改写本对象；业务动作产生的临时状态由应用层内存态承载。 */
window.DB = {
  meta: {
    product: "FRAME 短剧工场",
    version: "V9.5.0",
    basis: "项目业务方案（V3.0）",
    note: "单一企业内部 AI 短剧制作平台 · 静态交互原型",
    port: 4190,
    today: "2026-11-22"
  },

  /* ---------- 权限码字典 ---------- */
  permissions: {
    "platform.read": "平台总览与资源只读",
    "platform.config": "平台参数与适配器配置",
    "enterprise.read": "企业信息查看",
    "enterprise.edit": "企业信息与策略编辑",
    "org.read": "组织、员工、角色查看",
    "org.manage": "组织、员工、角色管理",
    "grant.manage": "项目成员授权与回收",
    "project.read": "项目查看",
    "project.create": "项目创建",
    "project.manage": "项目生命周期管理",
    "creation.write": "创意与剧本编辑",
    "script.review": "剧本审核（节点 A）",
    "director.write": "拆解与视觉资产编辑",
    "production.write": "视频与音频生产操作",
    "quality.read": "质量报告查看",
    "quality.operate": "质量返工与复检",
    "post.write": "后期与合成操作",
    "final.review": "成片审核（节点 B）",
    "delivery.execute": "交付执行",
    "task.operate": "任务重试、暂停、取消",
    "asset.read": "资产查看",
    "asset.manage": "资产版本、删除与归档",
    "models.own": "个人模型资源与凭据",
    "models.manage": "平台模型资源、供应商与路由管理",
    "cost.read": "用量与成本查看",
    "cost.export": "成本与账单导出",
    "cost.manage": "预算调整、阈值设置与追加审批",
    "compliance.write": "授权登记、续期、替换与风险处置",
    "compliance.read": "授权台账与项目风险查看",
    "analytics.read": "经营分析查看",
    "analytics.own": "个人产出统计",
    "audit.read": "合规台账与审计检索",
    "audit.export": "审计与合规导出",
    "notify.handle": "通知与异常处理"
  },

  /* ---------- 角色体系（六角色，不以传统制作岗位划分） ---------- */
  roles: [
    { code: "ops", name: "系统运维管理员", scope: "基础设施与全局参数", duty: "部署、运行、监控、备份恢复与技术排障", perms: ["platform.read", "platform.config"], deny: "默认不读取业务内容；不得读取任何个人凭据明文" },
    { code: "admin", name: "企业管理员", scope: "企业全域（按职责授权）", duty: "企业主体、部门、账号、角色、预算制度、合规与经营查看", perms: ["platform.read", "enterprise.read", "enterprise.edit", "org.read", "org.manage", "grant.manage", "project.read", "project.manage", "cost.read", "cost.export", "cost.manage", "models.manage", "compliance.write", "compliance.read", "analytics.read", "audit.read", "audit.export", "notify.handle"], deny: "个人凭据明文始终不可见；不得绕过内容合规与审计" },
    { code: "dept", name: "部门管理员", scope: "本部门范围", duty: "本部门成员、项目归属、部门资源与统计视图", perms: ["enterprise.read", "org.read", "org.manage", "grant.manage", "project.read", "project.manage", "cost.read", "cost.manage", "compliance.write", "compliance.read", "analytics.read", "notify.handle"], deny: "不得跨部门读写；不得调整企业级策略" },
    { code: "owner", name: "项目负责人", scope: "负责项目范围", duty: "项目推进、成员授权、关键审核、异常决策、移交配合", perms: ["project.read", "project.create", "project.manage", "creation.write", "script.review", "director.write", "production.write", "models.own", "quality.read", "quality.operate", "post.write", "final.review", "delivery.execute", "task.operate", "asset.read", "asset.manage", "cost.read", "compliance.write", "compliance.read", "analytics.own", "notify.handle"], deny: "不得读取他人个人凭据；不得绕过预算与审核规则" },
    { code: "staff", name: "普通员工", scope: "本人及被授权项目", duty: "独立制作短剧、维护个人 AI 资源、审核与交付", perms: ["project.read", "project.create", "creation.write", "director.write", "production.write", "quality.read", "quality.operate", "post.write", "task.operate", "asset.read", "models.own", "cost.read", "analytics.own", "notify.handle"], deny: "仅使用本人配置的资源；不得修改企业级策略" },
    { code: "auditor", name: "审计与经营管理人员", scope: "指定部门或汇总视图", duty: "查询操作、调用、成本、授权与交付追溯记录", perms: ["enterprise.read", "org.read", "project.read", "cost.read", "cost.export", "analytics.read", "audit.read", "audit.export", "compliance.read", "quality.read"], deny: "只读；不自动获得内容修改权" }
  ],

  /* ---------- 当前身份（切换仅用于演示菜单与路由权限差异） ---------- */
  identities: [
    { id: "i-ops", role: "ops", userId: "u-07", name: "周砚 · 系统运维", dept: "技术支持部", avatar: "运", platform: true },
    { id: "i-admin", role: "admin", userId: "u-06", name: "沈牧 · 企业管理员", dept: "企业管理部", avatar: "管" },
    { id: "i-dept", role: "dept", userId: "u-05", name: "韩清 · 内容创新部", dept: "内容创新部", avatar: "部" },
    { id: "i-owner", role: "owner", userId: "u-01", name: "林知远 · 项目负责人", dept: "内容创新部", avatar: "林" },
    { id: "i-staff", role: "staff", userId: "u-02", name: "陈可心 · 制作员工", dept: "内容创新部", avatar: "陈" },
    { id: "i-auditor", role: "auditor", userId: "u-08", name: "许衡 · 审计经营", dept: "经营管理部", avatar: "审" }
  ],
  currentIdentity: "i-owner",

  /* ---------- 企业主体 ---------- */
  enterprise: {
    name: "知微影业（虚构）",
    code: "ZW-STUDIO",
    intro: "以竖屏微短剧为主要产出的内容制作企业，制作、审核与经营统一在此平台内流转。",
    status: "正常",
    admin: "沈牧",
    members: 42,
    depts: 5,
    projects: 18,
    budget: 1200000,
    used: 486300,
    policies: [
      { name: "单项目集数上限", value: "60 集", note: "超出需企业管理员审批并留审计" },
      { name: "默认单集预算", value: "¥800", note: "项目可下调，不得上调至超出总预算" },
      { name: "模型白名单", value: "12 个能力族 · 26 个模型", note: "白名单收紧不中断执行中任务，新任务须合规" },
      { name: "凭据策略", value: "个人自持 + 企业托管并存", note: "个人凭据仅存密文，任何角色不可读明文" },
      { name: "数据外发", value: "禁止向境外未备案模型发送正式剧本", note: "合规预检自动阻断高风险外发" },
      { name: "审核节点", value: "剧本审核 + 最终成片审核", note: "不设多级会签，异常决策单独留痕" }
    ]
  },

  /* ---------- 部门与组织单元（不是租户，不作为数据隔离主键） ---------- */
  departments: [
    { id: "D-01", name: "内容创新部", code: "CONTENT", parent: "—", leader: "韩清", members: 16, projects: 8, status: "启用", budget: 420000, used: 198600, view: "项目明细 + 部门统计" },
    { id: "D-02", name: "制作中心", code: "PROD", parent: "—", leader: "王亦宁", members: 13, projects: 6, status: "启用", budget: 380000, used: 201400, view: "项目明细 + 部门统计" },
    { id: "D-03", name: "经营管理部", code: "BIZ", parent: "—", leader: "许衡", members: 6, projects: 2, status: "启用", budget: 160000, used: 63200, view: "汇总视图" },
    { id: "D-04", name: "短剧二组", code: "CONTENT-B", parent: "内容创新部", leader: "赵一宁", members: 7, projects: 4, status: "启用", budget: 120000, used: 47100, view: "项目明细" },
    { id: "D-05", name: "技术支持部", code: "TECH", parent: "—", leader: "周砚", members: 4, projects: 0, status: "启用", budget: 90000, used: 18600, view: "平台资源视图（不含业务内容）" }
  ],

  /* ---------- 员工账号 ---------- */
  users: [
    { id: "u-01", name: "林知远", email: "lin.zhiyuan@example.local", dept: "内容创新部", role: "项目负责人", roles: ["owner"], status: "在职", joined: "2025-03-11", projects: 3, delivered: 2, episodes: 34, cost: 62280, quality: 92.1, resources: "个人自持 · 3 项配置" },
    { id: "u-02", name: "陈可心", email: "chen.kexin@example.local", dept: "内容创新部", role: "普通员工", roles: ["staff"], status: "在职", joined: "2025-06-02", projects: 2, delivered: 1, episodes: 20, cost: 31240, quality: 89.4, resources: "个人自持 · 2 项配置" },
    { id: "u-03", name: "王亦宁", email: "wang.yining@example.local", dept: "制作中心", role: "部门管理员", roles: ["dept", "owner"], status: "在职", joined: "2024-11-18", projects: 4, delivered: 3, episodes: 52, cost: 88360, quality: 90.7, resources: "企业托管 · 配额 18%" },
    { id: "u-04", name: "赵一宁", email: "zhao.yining@example.local", dept: "短剧二组", role: "普通员工", roles: ["staff"], status: "在职", joined: "2026-01-09", projects: 1, delivered: 0, episodes: 6, cost: 8940, quality: 84.2, resources: "个人自持 · 1 项配置" },
    { id: "u-05", name: "韩清", email: "han.qing@example.local", dept: "内容创新部", role: "部门管理员", roles: ["dept"], status: "在职", joined: "2024-08-26", projects: 2, delivered: 1, episodes: 24, cost: 27600, quality: 88.0, resources: "企业托管 · 配额 9%" },
    { id: "u-06", name: "沈牧", email: "shen.mu@example.local", dept: "企业管理部", role: "企业管理员", roles: ["admin"], status: "在职", joined: "2024-05-06", projects: 0, delivered: 0, episodes: 0, cost: 0, quality: 0, resources: "企业托管 · 审批角色" },
    { id: "u-07", name: "周砚", email: "zhou.yan@example.local", dept: "技术支持部", role: "系统运维管理员", roles: ["ops"], status: "在职", joined: "2024-05-06", projects: 0, delivered: 0, episodes: 0, cost: 0, quality: 0, resources: "运维域隔离" },
    { id: "u-08", name: "许衡", email: "xu.heng@example.local", dept: "经营管理部", role: "审计与经营管理", roles: ["auditor"], status: "在职", joined: "2025-02-17", projects: 0, delivered: 0, episodes: 0, cost: 0, quality: 0, resources: "只读汇总视图" },
    { id: "u-09", name: "苏晓", email: "su.xiao@example.local", dept: "制作中心", role: "普通员工", roles: ["staff"], status: "停用", joined: "2025-04-21", projects: 1, delivered: 0, episodes: 8, cost: 7640, quality: 81.5, resources: "待移交 · 全部任务已暂停" }
  ],

  /* ---------- 项目 ---------- */
  projects: [
    {
      id: "SP-26031", name: "雾城来信", genre: "悬疑 / 都市", audience: "18–30 岁都市女性", episodes: 24, duration: "90 秒 / 集",
      ratio: "9:16 · 1080×1920", language: "普通话", style: "冷灰低饱和 · 手持近景", constraints: "禁止血腥正面镜头；不得出现真实品牌标识",
      budget: 18000, actual: 9260, estimated: 11400, status: "生产中", phase: "视频生产", done: 16, delivered: 0,
      quality: "良好", ownerId: "u-01", owner: "林知远", deptId: "D-01", dept: "内容创新部", budgetState: "正常",
      created: "2026-10-02", updated: "2026-11-22 10:42", scriptVersion: "SCR-26031-V4（正式，已锁定）", timelineVersion: "TL-26031-V7",
      members: [{ userId: "u-01", role: "管理" }, { userId: "u-02", role: "编辑" }, { userId: "u-03", role: "审核" }]
    },
    {
      id: "SP-26028", name: "逆光的约定", genre: "都市 / 情感", audience: "25–40 岁女性", episodes: 20, duration: "80 秒 / 集",
      ratio: "9:16 · 1080×1920", language: "普通话", style: "暖调柔光 · 固定机位", constraints: "不得出现医院真实场景标识",
      budget: 12000, actual: 680, estimated: 8200, status: "待剧本审核", phase: "剧本审核", done: 0, delivered: 0,
      quality: "待审核", ownerId: "u-02", owner: "陈可心", deptId: "D-01", dept: "内容创新部", budgetState: "正常",
      created: "2026-11-05", updated: "2026-11-22 09:18", scriptVersion: "SCR-26028-V2（候选）", timelineVersion: "—",
      members: [{ userId: "u-02", role: "管理" }, { userId: "u-01", role: "审核" }]
    },
    {
      id: "SP-26019", name: "长街旧梦", genre: "年代 / 家庭", audience: "35–55 岁泛大众", episodes: 12, duration: "120 秒 / 集",
      ratio: "9:16 · 1080×1920", language: "普通话", style: "暖褐胶片 · 稳机位长镜", constraints: "年代服饰不得混用现代元素",
      budget: 15000, actual: 11840, estimated: 12100, status: "已交付", phase: "交付完成", done: 12, delivered: 12,
      quality: "通过", ownerId: "u-03", owner: "王亦宁", deptId: "D-02", dept: "制作中心", budgetState: "正常",
      created: "2026-08-14", updated: "2026-11-18 16:05", scriptVersion: "SCR-26019-V5（已锁定）", timelineVersion: "TL-26019-V3",
      members: [{ userId: "u-03", role: "管理" }, { userId: "u-05", role: "审核" }, { userId: "u-01", role: "审核" }]
    },
    {
      id: "SP-26015", name: "第七码头", genre: "悬疑 / 犯罪", audience: "20–35 岁男性", episodes: 16, duration: "100 秒 / 集",
      ratio: "9:16 · 1080×1920", language: "普通话 + 粤语片段", style: "高对比夜景 · 冷蓝", constraints: "不得出现警用标识与真实码头名称",
      budget: 16000, actual: 7420, estimated: 9800, status: "异常中", phase: "视频生产（受阻）", done: 8, delivered: 0,
      quality: "需处理", ownerId: "u-01", owner: "林知远", deptId: "D-01", dept: "内容创新部", budgetState: "接近阈值",
      created: "2026-09-21", updated: "2026-11-21 18:20", scriptVersion: "SCR-26015-V3（已锁定）", timelineVersion: "TL-26015-V2",
      members: [{ userId: "u-01", role: "管理" }, { userId: "u-04", role: "编辑" }]
    },
    {
      id: "SP-26011", name: "夏日边界", genre: "青春 / 成长", audience: "16–24 岁学生", episodes: 16, duration: "80 秒 / 集",
      ratio: "9:16 · 1080×1920", language: "普通话", style: "高饱和日光 · 轻快剪辑", constraints: "校园场景需虚构校名",
      budget: 9000, actual: 240, estimated: 6100, status: "剧本创作中", phase: "创意与剧本", done: 0, delivered: 0,
      quality: "待检测", ownerId: "u-04", owner: "赵一宁", deptId: "D-04", dept: "短剧二组", budgetState: "正常",
      created: "2026-11-12", updated: "2026-11-21 14:02", scriptVersion: "SCR-26011-V1（草稿）", timelineVersion: "—",
      members: [{ userId: "u-04", role: "管理" }]
    },
    {
      id: "SP-26007", name: "回声计划", genre: "科幻 / 悬疑", audience: "18–35 岁科技向", episodes: 30, duration: "90 秒 / 集",
      ratio: "9:16 · 1080×1920", language: "普通话", style: "冷白极简 · 慢速运镜", constraints: "未来设备不得出现真实商标",
      budget: 26000, actual: 23890, estimated: 25100, status: "已归档", phase: "归档完成", done: 30, delivered: 30,
      quality: "通过", ownerId: "u-03", owner: "王亦宁", deptId: "D-02", dept: "制作中心", budgetState: "正常",
      created: "2026-05-08", updated: "2026-10-30 11:20", scriptVersion: "SCR-26007-V6（已锁定）", timelineVersion: "TL-26007-V4",
      members: [{ userId: "u-03", role: "管理" }]
    },
    {
      id: "SP-26004", name: "灶台之上", genre: "家庭 / 美食", audience: "28–50 岁家庭用户", episodes: 18, duration: "100 秒 / 集",
      ratio: "9:16 · 1080×1920", language: "普通话 + 方言点缀", style: "暖调厨房 · 微距特写", constraints: "食材与菜品需标注为演示素材",
      budget: 14000, actual: 0, estimated: 7600, status: "草稿", phase: "未启动", done: 0, delivered: 0,
      quality: "待检测", ownerId: "u-02", owner: "陈可心", deptId: "D-01", dept: "内容创新部", budgetState: "未设置",
      created: "2026-11-20", updated: "2026-11-20 17:44", scriptVersion: "—", timelineVersion: "—",
      members: [{ userId: "u-02", role: "管理" }]
    }
  ],

  projectStates: [
    { name: "草稿", mean: "已创建，未启动生产", enter: "项目保存成功", end: "可终止" },
    { name: "创意策划中", mean: "AI 正在生成创意方案与故事大纲", enter: "员工提交创意设定 并启动", end: "可终止" },
    { name: "剧本创作中", mean: "AI 正在生成或修订剧本", enter: "创意方案确认", end: "可终止" },
    { name: "待剧本审核", mean: "候选剧本就绪，等待人工审核", enter: "剧本生成完成且自检通过", end: "可终止" },
    { name: "生产准备中", mean: "剧本拆解、镜头规划与视觉资产准备", enter: "剧本审核通过并锁定正式版本", end: "可终止" },
    { name: "生产中", mean: "执行镜头视频与音频生成", enter: "镜头生产计划固化", end: "可终止" },
    { name: "后期制作中", mean: "剪辑、混音、字幕合成与分集输出", enter: "镜头与音频达到可用比例", end: "可终止" },
    { name: "质量检测中", mean: "执行单集级与整剧级检测", enter: "分集成片输出完成（系统自动进入）", end: "可终止" },
    { name: "待最终审核", mean: "成片就绪，等待人工终审", enter: "检测完成且无阻断项（系统自动进入）", end: "可终止" },
    { name: "已完成", mean: "终审通过，尚未交付", enter: "终审结论为通过", end: "可退回返工" },
    { name: "已交付", mean: "交付包生成并确认交付", enter: "交付执行完成", end: "不可回退" },
    { name: "已归档", mean: "交付后完成资产归档", enter: "归档动作完成", end: "不可回退" },
    { name: "已暂停", mean: "主动暂停，阻止新任务派发", enter: "员工或管理员执行暂停", end: "可恢复" },
    { name: "异常中", mean: "存在需人工处理的生产异常", enter: "重试上限、资源不可用、预算触发、合规高风险", end: "可恢复或终止" },
    { name: "已终止", mean: "项目终止，下游计划取消", enter: "终止动作并记录原因与确认人", end: "终态" }
  ],

  stagePipeline: [
    { key: "brief", name: "创意策划", owner: "员工", gate: "创意方案确认", out: "创意设定 版本" },
    { key: "script", name: "剧本创作", owner: "AI + 员工审核", gate: "剧本审核通过并锁定", out: "正式剧本版本" },
    { key: "plan", name: "导演规划", owner: "AI", gate: "镜头契约固化 + 资产就绪", out: "镜头生产计划" },
    { key: "video", name: "视频生产", owner: "AI", gate: "镜头级质量 PASS", out: "合格镜头素材" },
    { key: "audio", name: "音频字幕", owner: "AI", gate: "音频/字幕/口型校验", out: "对白、音乐、字幕资产" },
    { key: "post", name: "后期合成", owner: "AI", gate: "播放完整性检查", out: "分集成片" },
    { key: "qc", name: "质量检测", owner: "AI", gate: "无阻断项", out: "质量报告" },
    { key: "delivery", name: "终审交付", owner: "员工审核 + AI", gate: "终审通过 + 集数完整", out: "交付包与归档" }
  ],

  /* ---------- 创意设定 与方案 ---------- */
  briefs: [
    { id: "CB-26031-03", project: "SP-26031", version: "v3", mode: "自由描述", status: "已确认", by: "林知远", at: "2026-10-03 09:12", note: "雨夜、错认、连环信件三条线并进；每集结尾留一个未解动作。" },
    { id: "CB-26019-03", project: "SP-26019", version: "v3", mode: "故事梗概扩写", status: "已确认", by: "王亦宁", at: "2026-08-08 10:20", note: "九十年代老街、旧照片与一次迟到二十年的重逢；克制表达，不做强反转。" },
    { id: "CB-26015-02", project: "SP-26015", version: "v2", mode: "场景 / 事件驱动", status: "已确认", by: "林知远", at: "2026-11-10 16:35", note: "深夜码头、失踪货柜与一盒未登记的音轨；悬疑压迫感优先，控制夜景成本。" },
    { id: "CB-26028-02", project: "SP-26028", version: "v2", mode: "角色 / 关系驱动", status: "已确认", by: "陈可心", at: "2026-11-06 14:40", note: "双女主关系张力为核心，避免甜宠套路与过度狗血。" },
    { id: "CB-26011-01", project: "SP-26011", version: "v1", mode: "题材 / 类型选择", status: "草稿", by: "赵一宁", at: "2026-11-12 15:20", note: "青春成长 + 校园边缘题材，先定三个同学关系。" },
    { id: "CB-26004-01", project: "SP-26004", version: "v1", mode: "自定义结构化输入", status: "草稿", by: "陈可心", at: "2026-11-20 17:30", note: "家庭餐桌冲突，节奏偏快，避免刻意煽情。" }
  ],
  briefModes: [
    { mode: "自由描述", input: "自然语言描述灵感、人物、冲突或场景", output: "结构化创意设定" },
    { mode: "题材 / 类型选择", input: "题材、类型、风格标签", output: "创意方向候选" },
    { mode: "故事梗概扩写", input: "已有梗概或短篇内容", output: "完整故事大纲" },
    { mode: "角色 / 关系驱动", input: "人物设定、关系与核心矛盾", output: "人物关系与故事方案" },
    { mode: "场景 / 事件驱动", input: "一个场景、事件或反转设想", output: "故事切入点与剧情线" },
    { mode: "参考资料辅助", input: "有权使用的文本、图片或资料", output: "参考分析与创意建议" },
    { mode: "自定义结构化输入", input: "题材、受众、时长、风格、禁忌", output: "可编辑创意设定" }
  ],
  creativePlans: [
    { id: "CP-26031-A", project: "SP-26031", title: "错认来信 · 冷叙事", selling: "雨夜错认 + 连环信件反转", theme: "被误读的人如何自证", hook: "开场 3 秒：邮筒里出现一封写给死者的信", risk: "第 6–9 集信息密度偏低", score: 88, chosen: true },
    { id: "CP-26031-B", project: "SP-26031", title: "双线追凶 · 强冲突", selling: "双视角追凶 + 每集反转", theme: "真相与代价", hook: "开场 3 秒：嫌疑人主动走进警局", risk: "反转密度过高易疲劳", score: 82, chosen: false },
    { id: "CP-26019-A", project: "SP-26019", title: "旧照片 · 克制重逢", selling: "一张旧照片牵出二十年误解", theme: "时间能否替人道歉", hook: "开场 3 秒：照片背面出现今天的日期", risk: "中段情绪推进偏慢", score: 89, chosen: true },
    { id: "CP-26015-A", project: "SP-26015", title: "失踪货柜 · 单线压迫", selling: "一夜之内找出失踪货柜", theme: "沉默的代价", hook: "开场 3 秒：码头广播念出一个不存在的编号", risk: "夜景与水面镜头成本偏高", score: 85, chosen: true },
    { id: "CP-26015-B", project: "SP-26015", title: "双码头 · 交叉追查", selling: "两个码头、两条时间线交叉", theme: "谁在替谁隐瞒", hook: "开场 3 秒：同一只货柜出现在两个码头", risk: "场景切换过多，90 秒内信息过载", score: 78, chosen: false },
    { id: "CP-26028-A", project: "SP-26028", title: "逆光 · 双向救赎", selling: "两个失语者互相翻译", theme: "被看见的渴望", hook: "开场 3 秒：她把要说的话写在玻璃上", risk: "第 12 集后情感线需再收紧", score: 90, chosen: true },
    { id: "CP-26028-B", project: "SP-26028", title: "约定 · 时间错位", selling: "十年时差的两次告白", theme: "错过与重逢", hook: "开场 3 秒：同一张车票出现两次", risk: "时间线设定需更明确", score: 79, chosen: false }
  ],

  /* ---------- 剧本版本 ---------- */
  scripts: [
    { id: "SCR-26031-V4", project: "SP-26031", version: "v4", status: "已通过 · 正式版本", episodes: 24, scenes: 168, shots: 412, lines: 1864, by: "林知远", at: "2026-10-06 11:30", note: "锁定为下游唯一基准；第 6–9 集节奏已重排。", locked: true, studioSample: true },
    { id: "SCR-26031-V3", project: "SP-26031", version: "v3", status: "已废弃", episodes: 24, scenes: 165, shots: 398, lines: 1802, by: "林知远", at: "2026-10-04 20:10", note: "被 v4 替代，保留以便追溯。", locked: false },
    { id: "SCR-26031-V2", project: "SP-26031", version: "v2", status: "已通过（历史）", episodes: 24, scenes: 160, shots: 372, lines: 1740, by: "林知远", at: "2026-10-03 16:40", note: "首次审核通过版本。", locked: false },
    { id: "SCR-26028-V2", project: "SP-26028", version: "v2", status: "待审核", episodes: 20, scenes: 132, shots: 306, lines: 1420, by: "陈可心", at: "2026-11-22 08:50", note: "候选版本，等待项目负责人审核。", locked: false },
    { id: "SCR-26028-V1", project: "SP-26028", version: "v1", status: "退回", episodes: 20, scenes: 126, shots: 288, lines: 1358, by: "陈可心", at: "2026-11-19 19:20", note: "退回意见：第 14–16 集人物动机不足。", locked: false },
    { id: "SCR-26019-V5", project: "SP-26019", version: "v5", status: "已通过 · 正式版本", episodes: 12, scenes: 96, shots: 244, lines: 986, by: "王亦宁", at: "2026-08-20 10:05", note: "交付基准版本，已随交付冻结。", locked: true },
    { id: "SCR-26015-V2", project: "SP-26015", version: "v2", status: "已通过 · 正式版本", episodes: 16, scenes: 96, shots: 256, lines: 944, by: "林知远", at: "2026-11-10 18:00", note: "生产基准版本；第 9 集 SH-02 因合规阻断暂停。", locked: true },
    { id: "SCR-26011-V1", project: "SP-26011", version: "v1", status: "草稿", episodes: 16, scenes: 0, shots: 0, lines: 420, by: "赵一宁", at: "2026-11-21 14:02", note: "仅完成分集大纲与前三集场次。", locked: false }
  ],
  scriptDiff: [
    { version: "v4", change: "第 6–9 集重排", detail: "合并两场冗余过场，第 8 集钩子前置 4 秒", scenes: "+3 / −5", lines: "+62", by: "林知远" },
    { version: "v3", change: "人物动机补写", detail: "为顾沉增加一次主动放弃的抉择", scenes: "+2", lines: "+46", by: "林知远" },
    { version: "v2", change: "审核通过版本", detail: "按审核意见调整第 3、11 集结尾钩子", scenes: "0", lines: "−18", by: "林知远" }
  ],

  /* ---------- 集 / 场 / 人物 / 场景 / 服装道具 ---------- */
  episodes: [
    { project: "SP-26031", no: 16, title: "雨停之前", scenes: 7, shots: 18, duration: "92 秒", status: "已通过质检", qc: "PASS" },
    { project: "SP-26031", no: 17, title: "第三封信", scenes: 8, shots: 20, duration: "94 秒", status: "生产中", qc: "进行中" },
    { project: "SP-26031", no: 18, title: "旧城区的回声", scenes: 6, shots: 16, duration: "89 秒", status: "待生产", qc: "未开始" },
    { project: "SP-26031", no: 19, title: "不许回头", scenes: 7, shots: 17, duration: "91 秒", status: "待生产", qc: "未开始" },
    { project: "SP-26028", no: 1, title: "玻璃上的字", scenes: 5, shots: 12, duration: "82 秒", status: "脚本待审核", qc: "—" }
  ],
  scenes: [
    { id: "SC-26031-E17-S03", episode: 17, no: "03", location: "旧城区 · 雨夜街口", time: "夜 / 雨", chars: "顾沉、苏眠", shots: 4, status: "镜头已固化" },
    { id: "SC-26031-E17-S04", episode: 17, no: "04", location: "邮局旧址 · 内景", time: "夜 / 内", chars: "顾沉", shots: 3, status: "镜头已固化" },
    { id: "SC-26031-E18-S01", episode: 18, no: "01", location: "旧城区 · 天台", time: "黄昏 / 阴", chars: "苏眠、老周", shots: 5, status: "待规划" },
    { id: "SC-26028-E01-S02", episode: 1, no: "02", location: "出租屋 · 窗边", time: "日 / 内", chars: "林晚", shots: 4, status: "待拆解" }
  ],
  characters: [
    { id: "CH-01", project: "SP-26031", name: "顾沉", age: "29", look: "窄脸、短发、右眉浅疤", build: "偏瘦、肩线下沉", hair: "短碎发 · 湿发质感", costume: "深灰风衣 v2 + 旧围巾", forbid: "不得改变眉疤位置；不得戴眼镜", refs: 6, version: "v3", rights: "AI 生成 · 无需真人授权", status: "已确认", reuse: "第 1–24 集" },
    { id: "CH-02", project: "SP-26031", name: "苏眠", age: "26", look: "圆眼、浅褐瞳、左耳小痣", build: "中等身高、直肩", hair: "低马尾 · 前额碎发", costume: "米白高领 + 深色外套 v2", forbid: "不得更换发型轮廓；不得浓妆", refs: 5, version: "v2", rights: "AI 生成 · 无需真人授权", status: "已确认", reuse: "第 1–24 集" },
    { id: "CH-03", project: "SP-26031", name: "老周", age: "54", look: "方脸、灰白发、深法令纹", build: "肩宽、微驼", hair: "灰白平头", costume: "旧夹克 v1", forbid: "不得年轻化处理", refs: 4, version: "v1", rights: "AI 生成 · 无需真人授权", status: "抽检通过", reuse: "第 14–24 集" },
    { id: "CH-04", project: "SP-26028", name: "林晚", age: "28", look: "清瘦、长眼、唇色偏淡", build: "纤细", hair: "齐肩直发", costume: "浅灰针织 + 牛仔", forbid: "不得加夸张配饰", refs: 3, version: "v1", rights: "AI 生成 · 无需真人授权", status: "待确认", reuse: "第 1–20 集" }
  ],
  locations: [
    { id: "LC-01", project: "SP-26031", name: "旧城区 · 雨夜街口", type: "外景", layout: "窄街 + 邮筒 + 三层旧楼", light: "钠灯暖光 + 冷雨反射", color: "冷灰 + 局部暖", props: "邮筒、积水、旧招牌", refs: 4, version: "v2", rights: "AI 生成 · 无需授权", status: "已确认" },
    { id: "LC-02", project: "SP-26031", name: "邮局旧址 · 内景", type: "内景", layout: "长柜 + 信件架 + 后门", light: "单侧窗光 + 台灯", color: "暖褐", props: "信件架、旧印章", refs: 3, version: "v1", rights: "AI 生成 · 无需授权", status: "已确认" },
    { id: "LC-03", project: "SP-26031", name: "旧城区 · 天台", type: "外景", layout: "水泥天台 + 水塔 + 栏杆", light: "阴天散射", color: "灰蓝", props: "水塔、旧铁门", refs: 2, version: "v1", rights: "AI 生成 · 无需授权", status: "待抽检" },
    { id: "LC-04", project: "SP-26028", name: "出租屋 · 窗边", type: "内景", layout: "小窗 + 旧书桌", light: "晨光侧逆", color: "暖白", props: "玻璃窗、便签", refs: 2, version: "v1", rights: "AI 生成 · 无需授权", status: "待确认" }
  ],
  props: [
    { id: "PR-01", project: "SP-26031", name: "第三封信", type: "关键道具", look: "米白信封 · 蓝色钢笔字", state: "完整 → 第 19 集被撕开", owner: "顾沉 → 苏眠", refs: 3, version: "v2", consistency: "3 处出场外观一致" },
    { id: "PR-02", project: "SP-26031", name: "旧围巾", type: "服装道具", look: "深灰羊毛 · 起球", state: "全程同一状态", owner: "顾沉", refs: 2, version: "v1", consistency: "5 处出场一致" },
    { id: "PR-03", project: "SP-26031", name: "邮局印章", type: "关键道具", look: "黄铜 · 磨损边角", state: "第 17 集特写", owner: "老周", refs: 2, version: "v1", consistency: "待抽检" }
  ],

  /* ---------- 镜头生产单元（ShotContract 字段组） ---------- */
  shots: [
    { id: "SH-26031-E17-04", project: "SP-26031", ep: 17, scene: "03", no: "SH-04", order: 4, frame: "中景", angle: "平视", move: "手持轻微跟随", lens: "35mm 倾向", desc: "雨夜街口，顾沉回头停步，信件从手中滑出", chars: "顾沉", emotion: "警觉 → 迟疑", line: "「这封信不该在你手上。」", voice: "环境雨声 + 脚步", duration: "6 秒", refs: "CH-01 v3 · LC-01 v2 · PR-01 v2", model: "视频模型 A（图生视频）", quality: "人物一致性 / 画面异常 / 时长", status: "执行中", version: "待生成" },
    { id: "SH-26031-E17-05", project: "SP-26031", ep: 17, scene: "03", no: "SH-05", order: 5, frame: "近景", angle: "略仰", move: "固定", lens: "50mm 倾向", desc: "近景对白，情绪克制，雨水打在肩线", chars: "顾沉、苏眠", emotion: "克制", line: "「你认错人了。」", voice: "雨声压低声场", duration: "8 秒", refs: "CH-01 v3 · CH-02 v2 · LC-01 v2", model: "视频模型 A（参考人物视频）", quality: "口型 / 表情 / 一致性", status: "排队中", version: "待生成" },
    { id: "SH-26031-E17-06", project: "SP-26031", ep: 17, scene: "04", no: "SH-06", order: 6, frame: "远景", angle: "俯拍", move: "缓慢后拉", lens: "24mm 倾向", desc: "邮局内景，顾沉独自站在信件架前", chars: "顾沉", emotion: "疲惫", line: "旁白：信里的字迹他认得。", voice: "室内低频 + 纸张声", duration: "5 秒", refs: "CH-01 v3 · LC-02 v1", model: "视频模型 A（文生视频）", quality: "构图 / 场景一致性", status: "已通过", version: "v2 采用" },
    { id: "SH-26031-E16-09", project: "SP-26031", ep: 16, scene: "05", no: "SH-09", order: 9, frame: "特写", angle: "平视", move: "固定", lens: "85mm 倾向", desc: "手指停在信封封口处", chars: "苏眠", emotion: "犹豫", line: "—", voice: "心跳音效", duration: "4 秒", refs: "CH-02 v2 · PR-01 v2", model: "视频模型 A（图生视频）", quality: "画面异常 / 时长", status: "已通过", version: "v1 采用" },
    { id: "SH-26015-E09-02", project: "SP-26015", ep: 9, scene: "02", no: "SH-02", order: 2, frame: "中景", angle: "低机位", move: "横移", lens: "35mm 倾向", desc: "码头集装箱间，人物被灯影切开", chars: "陈默", emotion: "紧张", line: "「别开灯。」", voice: "海浪 + 金属回声", duration: "7 秒", refs: "CH-15 v1 · LC-15 v2", model: "视频模型 A（文生视频）", quality: "合规 / 一致性 / 画面", status: "待人工处理", version: "v1 未采用" },
    { id: "SH-26028-E01-03", project: "SP-26028", ep: 1, scene: "02", no: "SH-03", order: 3, frame: "近景", angle: "平视", move: "固定", lens: "50mm 倾向", desc: "林晚在玻璃上写下要说的话", chars: "林晚", emotion: "期待", line: "（写在玻璃）「我在。」", voice: "呼吸 + 雨声", duration: "6 秒", refs: "CH-04 v1 · LC-04 v1", model: "待选择", quality: "待定义", status: "待执行（阻塞：剧本未锁定）", version: "—" }
  ],

  dialogues: [
    { id: "DL-26031-118", project: "SP-26031", ep: 17, char: "顾沉", text: "「这封信不该在你手上。」", voice: "顾沉 · 声音档案 VO-01", emotion: "克制 · 压低", audio: "已生成 v1", asr: "回听一致", status: "已通过", cost: 3.2 },
    { id: "DL-26031-119", project: "SP-26031", ep: 17, char: "苏眠", text: "「你认错人了。」", voice: "苏眠 · 声音档案 VO-02", emotion: "平静 · 轻微颤", audio: "生成中", asr: "—", status: "执行中", cost: 0 },
    { id: "DL-26031-120", project: "SP-26031", ep: 17, char: "旁白", text: "信里的字迹他认得。", voice: "旁白音色 VO-09", emotion: "叙述", audio: "已生成 v2", asr: "回听一致", status: "已通过", cost: 2.4 },
    { id: "DL-26015-064", project: "SP-26015", ep: 9, char: "陈默", text: "「别开灯。」", voice: "陈默 · 声音档案 VO-11", emotion: "紧张", audio: "已生成 v1", asr: "音量偏低", status: "待修复", cost: 2.8 }
  ],
  voiceProfiles: [
    { id: "VO-01", project: "SP-26031", char: "顾沉", lang: "普通话", timbre: "低中音 · 略砂", rate: "偏慢 0.92", emotion: "克制 → 压抑", rights: "AI 合成音色 · 供应商商用条款已留档", coverage: "第 1–24 集", status: "启用" },
    { id: "VO-02", project: "SP-26031", char: "苏眠", lang: "普通话", timbre: "中音 · 柔", rate: "正常 1.0", emotion: "平静 → 波动", rights: "AI 合成音色 · 商用条款已留档", coverage: "第 1–24 集", status: "启用" },
    { id: "VO-09", project: "SP-26031", char: "旁白", lang: "普通话", timbre: "中性 · 干燥", rate: "偏慢 0.88", emotion: "叙述", rights: "AI 合成音色 · 商用条款已留档", coverage: "全剧", status: "启用" },
    { id: "VO-11", project: "SP-26015", char: "陈默", lang: "普通话 + 粤语片段", timbre: "中低音", rate: "偏快 1.06", emotion: "紧绷", rights: "真人声音克隆 · 授权书 AT-2026-041", coverage: "第 1–16 集", status: "待复核授权到期" }
  ],
  audioAssets: [
    { id: "AU-26031-BGM-07", project: "SP-26031", type: "配乐", name: "雨夜底噪 · 低钢琴", source: "AI 生成 · 配乐模型 M1", rights: "平台授权 · 全渠道 · 2026-11-30", used: "第 16–17 集 · 4 处", mix: "−18 LUFS · 侧链回避对白", status: "已通过" },
    { id: "AU-26031-SFX-12", project: "SP-26031", type: "音效", name: "信封滑落 + 雨打铁皮", source: "AI 生成 · 音效模型 S2", rights: "平台授权", used: "第 17 集 · 2 处", mix: "−12 dB", status: "已通过" },
    { id: "AU-26015-BGM-03", project: "SP-26015", type: "配乐", name: "码头低鸣", source: "第三方素材库（待补授权）", rights: "授权不明确 · 阻断交付", used: "第 8–9 集 · 1 处", mix: "−20 LUFS", status: "阻断" }
  ],
  subtitles: [
    { project: "SP-26031", ep: 16, version: "SUB-16 v2", lines: 96, timeline: "整数毫秒 · 无累计漂移", asr: "错字 0 · 校对完成", style: "字号 34 / 安全区 12% / 单行 14 字", status: "已通过" },
    { project: "SP-26031", ep: 17, version: "SUB-17 v1", lines: 88, timeline: "整数毫秒 · 待复核", asr: "错字 2 · 校对中", style: "同上", status: "处理中" },
    { project: "SP-26015", ep: 9, version: "SUB-09 v1", lines: 74, timeline: "整数毫秒 · 有 3 处重叠", asr: "与最终对白不一致", style: "同上", status: "需重做" }
  ],
  lipSync: [
    { id: "LS-26031-118", line: "DL-26031-118", shot: "SH-26031-E17-04", model: "Lip Model L1", match: "92% 帧对齐", duration: "6 秒", status: "已通过", cost: 4.1 },
    { id: "LS-26031-119", line: "DL-26031-119", shot: "SH-26031-E17-05", model: "Lip Model L1", match: "待生成", duration: "8 秒", status: "排队中", cost: 0 },
    { id: "LS-26015-064", line: "DL-26015-064", shot: "SH-26015-E09-02", model: "Lip Model L2", match: "78% 帧对齐", duration: "7 秒", status: "需重做", cost: 5.6 }
  ],

  /* ---------- 生产任务 / 尝试 / 调用 ---------- */
  tasks: [
    { id: "T-8842", project: "SP-26031", ep: 17, scene: "03", shot: "SH-04", kind: "视频生成", stage: "视频生产", status: "执行中", priority: "高", deps: ["T-8836（资产就绪）"], parallelGroup: "E17-A", input: "CH-01 v3 / LC-01 v2 / PR-01 v2", output: "MP4 1080×1920 · 6s", model: "视频模型 A", config: "PRV-01", executor: "林知远", resourceOwner: "林知远", attempt: 1, maxAttempts: 3, est: 38.0, actual: 0, failedCost: 0, submitAt: "10:35", failReason: "—", qc: "待检" },
    { id: "T-8843", project: "SP-26031", ep: 17, scene: "03", shot: "SH-05", kind: "视频生成", stage: "视频生产", status: "排队中", priority: "高", deps: ["T-8842（同场景衔接）"], parallelGroup: "E17-A", input: "CH-01 v3 / CH-02 v2 / LC-01 v2", output: "MP4 1080×1920 · 8s", model: "视频模型 A", config: "PRV-01", executor: "林知远", resourceOwner: "林知远", attempt: 0, maxAttempts: 3, est: 44.0, actual: 0, failedCost: 0, submitAt: "—", failReason: "—", qc: "待检" },
    { id: "T-8836", project: "SP-26031", ep: 17, scene: "03", shot: "—", kind: "参考资产校验", stage: "视觉资产", status: "成功", priority: "高", deps: [], parallelGroup: "E17-A", input: "CH-01 v3 / LC-01 v2", output: "校验摘要 + 一致性抽检", model: "视觉模型 V2", config: "PRV-02", executor: "林知远", resourceOwner: "林知远", attempt: 1, maxAttempts: 3, est: 4.0, actual: 3.6, failedCost: 0, submitAt: "10:12", failReason: "—", qc: "PASS" },
    { id: "T-8839", project: "SP-26031", ep: 17, scene: "03", shot: "SH-05", kind: "对白配音", stage: "音频", status: "执行中", priority: "中", deps: ["T-8843（口型需视频）"], parallelGroup: "E17-B", input: "DL-26031-119", output: "WAV 48k · 8.4s", model: "语音模型 B", config: "PRV-03", executor: "林知远", resourceOwner: "林知远", attempt: 1, maxAttempts: 3, est: 12.0, actual: 0, failedCost: 0, submitAt: "10:40", failReason: "—", qc: "待检" },
    { id: "T-8821", project: "SP-26015", ep: 9, scene: "02", shot: "SH-02", kind: "视频生成", stage: "视频生产", status: "待人工处理", priority: "高", deps: ["T-8819（合规预检）"], parallelGroup: "E09-A", input: "CH-15 v1 / LC-15 v2", output: "MP4 1080×1920 · 7s", model: "视频模型 A", config: "PRV-01", executor: "林知远", resourceOwner: "林知远", attempt: 3, maxAttempts: 3, est: 42.0, actual: 0, failedCost: 86.4, submitAt: "18:02", failReason: "合规检测阻断：画面出现疑似警用标识", qc: "FAIL" },
    { id: "T-8820", project: "SP-26031", ep: 16, scene: "05", shot: "SH-09", kind: "单集质检", stage: "质量检测", status: "成功", priority: "中", deps: ["T-8810（分集成片）"], parallelGroup: "E16", input: "EP16 成片 v2", output: "质量报告 QR-26031-E16", model: "质检模型 Q1", config: "PRV-02", executor: "林知远", resourceOwner: "林知远", attempt: 1, maxAttempts: 2, est: 6.0, actual: 5.2, failedCost: 0, submitAt: "09:05", failReason: "—", qc: "PASS" },
    { id: "T-8810", project: "SP-26031", ep: 16, scene: "—", shot: "—", kind: "单集合成", stage: "后期", status: "成功", priority: "中", deps: ["T-8801…T-8809（镜头合集）"], parallelGroup: "E16", input: "TL-26031-E16 v3", output: "EP16 MP4 · 92s", model: "转码模型 T1", config: "PRV-04", executor: "林知远", resourceOwner: "林知远", attempt: 1, maxAttempts: 2, est: 9.0, actual: 8.4, failedCost: 0, submitAt: "08:20", failReason: "—", qc: "PASS" },
    { id: "T-8792", project: "SP-26028", ep: 1, scene: "—", shot: "—", kind: "剧本结构生成", stage: "创意与剧本", status: "成功", priority: "高", deps: ["CB-26028-02"], parallelGroup: "SCR", input: "创意方案 CP-26028-A", output: "SCR-26028-V2", model: "推理模型 R1", config: "PRV-05", executor: "陈可心", resourceOwner: "陈可心", attempt: 1, maxAttempts: 3, est: 8.0, actual: 7.4, failedCost: 0, submitAt: "08:42", failReason: "—", qc: "结构校验通过" },
    { id: "T-8788", project: "SP-26019", ep: 12, scene: "—", shot: "—", kind: "整剧质检", stage: "质量检测", status: "成功", priority: "中", deps: ["T-8780（12 集齐）"], parallelGroup: "ALL", input: "12 集成片 + 时间线 v3", output: "整剧质量报告 QR-26019-ALL", model: "质检模型 Q1", config: "PRV-06", executor: "王亦宁", resourceOwner: "王亦宁", attempt: 1, maxAttempts: 2, est: 14.0, actual: 13.2, failedCost: 0, submitAt: "11:10", failReason: "—", qc: "PASS" },
    { id: "T-8846", project: "SP-26031", ep: 18, scene: "01", shot: "SH-01", kind: "视频生成", stage: "视频生产", status: "待执行", priority: "低", deps: ["T-8842", "T-8843"], parallelGroup: "E18-A", input: "CH-02 v2 / LC-03 v1", output: "MP4 1080×1920 · 5s", model: "视频模型 B（备用）", config: "PRV-01", executor: "林知远", resourceOwner: "林知远", attempt: 0, maxAttempts: 3, est: 26.0, actual: 0, failedCost: 0, submitAt: "—", failReason: "阻塞：LC-03 场景资产待抽检", qc: "—" }
  ],
  attempts: [
    { id: "AT-8821-1", task: "T-8821", at: "18:02", status: "失败", model: "视频模型 A", reason: "供应商超时（可重试）", cost: 28.0 },
    { id: "AT-8821-2", task: "T-8821", at: "18:19", status: "失败", model: "视频模型 A", reason: "生成结果人物不一致（质量不合格）", cost: 31.2 },
    { id: "AT-8821-3", task: "T-8821", at: "18:41", status: "失败", model: "视频模型 B", reason: "合规检测阻断（不可重试）", cost: 27.2 },
    { id: "AT-8842-1", task: "T-8842", at: "10:35", status: "执行中", model: "视频模型 A", reason: "—", cost: 0 }
  ],
  invocations: [
    { id: "MI-90124", task: "T-8842", provider: "视频供应商 A", model: "video-a-2.1", vendorTask: "va_9f21c7", cap: "视频生成", input: "1080×1920 · 6s · 3 张参考图", usage: "6 秒视频", cost: 38.0, status: "执行中", at: "10:35:12" },
    { id: "MI-90118", task: "T-8821", provider: "视频供应商 A", model: "video-a-2.1", vendorTask: "va_7d03b2", cap: "视频生成", input: "1080×1920 · 7s · 2 张参考图", usage: "7 秒视频", cost: 31.2, status: "失败 · 已计费", at: "18:19:40" },
    { id: "MI-90109", task: "T-8839", provider: "语音供应商", model: "tts-b-3", vendorTask: "tts_55a1", cap: "语音合成", input: "文本 12 字 · 情绪 平静", usage: "8.4 秒音频", cost: 12.0, status: "执行中", at: "10:40:03" },
    { id: "MI-90088", task: "T-8792", provider: "推理供应商", model: "reason-r1", vendorTask: "rs_20fc", cap: "推理", input: "上下文 42k tokens", usage: "68k tokens", cost: 7.4, status: "成功", at: "08:42:55" }
  ],

  /* ---------- 生产计划 ---------- */
  plans: [
    { id: "PP-26031-V3", project: "SP-26031", version: "v3", scope: "第 17–24 集", shots: 148, tasks: 212, frozen: "2026-11-18 10:20", status: "已固化", note: "第 17 集按场景衔接顺序生产；18 集后可并行。" },
    { id: "PP-26031-V2", project: "SP-26031", version: "v2", scope: "第 9–16 集", shots: 136, tasks: 198, frozen: "2026-10-28 09:00", status: "已固化", note: "替换为 v3，历史计划保留。" }
  ],

  /* ---------- 质量 ---------- */
  qualityLevels: [
    { level: "资产级", object: "单个文件 / 资产版本", check: "文件完整性、格式、分辨率、时长、可解码性、校验摘要" },
    { level: "镜头级", object: "镜头生产单元", check: "画面异常、人物一致性、动作与表情、构图、时长、音画质量" },
    { level: "单集级", object: "分集成片", check: "剧情完整、镜头顺序、字幕、对白、音乐、混音、节奏" },
    { level: "整剧级", object: "全剧", check: "人物弧光、故事连续性、风格统一、集数完整、合规、交付完整" }
  ],
  qualityMatrix: [
    { dim: "剧本质量（逻辑、人物关系、完整性）", asset: null, shot: null, ep: "REVIEW", all: "PASS" },
    { dim: "内容合规（敏感、违规、风险提示）", asset: null, shot: "PASS", ep: "PASS", all: "PASS" },
    { dim: "人物一致性（外貌、服装、年龄、身份）", asset: null, shot: "REVIEW", ep: "PASS", all: "PASS" },
    { dim: "场景一致性（场景、道具、环境连续）", asset: null, shot: "PASS", ep: "PASS", all: "PASS" },
    { dim: "视频质量（清晰度、闪烁、画面异常）", asset: "PASS", shot: "PASS", ep: "PASS", all: null },
    { dim: "表演质量（动作、表情、口型）", asset: null, shot: "REVIEW", ep: "PASS", all: null },
    { dim: "音频质量（清晰度、音量、噪声）", asset: "PASS", shot: "FAIL", ep: "PASS", all: null },
    { dim: "字幕质量（内容、时间轴、错别字）", asset: null, shot: null, ep: "PASS", all: "PASS" },
    { dim: "剪辑质量（衔接、节奏、重复）", asset: null, shot: null, ep: "PASS", all: "REVIEW" },
    { dim: "成片质量（集数、播放、交付格式）", asset: null, shot: null, ep: "PASS", all: "PASS" }
  ],
  qualityReports: [
    { id: "QR-26031-E16", object: "SP-26031 / 第 16 集成片", level: "单集级", version: "EP16 v2", result: "PASS", items: 42, issues: 1, review: 1, fail: 0, engine: "质检模型 Q1（独立检测能力）", at: "2026-11-22 09:05", note: "1 项 REVIEW_REQUIRED 已人工确认（第 3 分镜节奏）" },
    { id: "QR-26031-E17-03", object: "SP-26031 / 第 17 集 03 场", level: "镜头级", version: "SH-04 / SH-05", result: "REVIEW_REQUIRED", items: 18, issues: 3, review: 3, fail: 0, engine: "视觉模型 V2", at: "2026-11-22 10:51", note: "人物一致性 2 项、口型 1 项待人工判断" },
    { id: "QR-26015-E09", object: "SP-26015 / 第 9 集", level: "镜头级", version: "SH-02", result: "FAIL", items: 21, issues: 5, review: 1, fail: 4, engine: "质检模型 Q1 + 视觉模型 V2", at: "2026-11-21 18:15", note: "合规阻断 1 项 + 人物一致性 2 项 + 音频 2 项" },
    { id: "QR-26019-ALL", object: "SP-26019 / 全剧 12 集", level: "整剧级", version: "TL-26019-V3", result: "PASS", items: 96, issues: 2, review: 1, fail: 0, engine: "质检模型 Q1", at: "2026-11-18 11:10", note: "集数完整性、风格统一、合规全部通过" }
  ],
  qualityIssues: [
    { report: "QR-26031-E17-03", dim: "人物一致性", where: "E17 / S03 / SH-05 · 00:03", level: "中", action: "局部重生成（保留同场景其余镜头）", auto: "否" },
    { report: "QR-26031-E17-03", dim: "口型同步", where: "E17 / S03 / SH-05 · 00:05", level: "中", action: "仅重做对白 DL-26031-119 的口型", auto: "是" },
    { report: "QR-26015-E09", dim: "内容合规", where: "E09 / S02 / SH-02 · 00:01", level: "高", action: "阻断下游；替换画面元素后重生成", auto: "否" },
    { report: "QR-26015-E09", dim: "音频质量", where: "E09 / DL-26015-064", level: "中", action: "重配单条对白", auto: "是" },
    { report: "QR-26019-ALL", dim: "剪辑质量", where: "E07 · 00:42 转场", level: "低", action: "人工确认后接受现状（已记录理由）", auto: "否" }
  ],
  reworkLedger: [
    { id: "RW-26031-014", project: "SP-26031", target: "SH-26031-E17-05", type: "人物不一致", round: 1, cost: 44.0, old: "v1 保留", status: "进行中", at: "2026-11-22 10:50" },
    { id: "RW-26015-009", project: "SP-26015", target: "SH-26015-E09-02", type: "合规风险", round: 3, cost: 86.4, old: "v1 / v2 保留", status: "转人工", at: "2026-11-21 18:41" },
    { id: "RW-26031-011", project: "SP-26031", target: "DL-26031-118", type: "音量偏低", round: 1, cost: 3.2, old: "v0 保留", status: "已修复", at: "2026-11-20 16:20" }
  ],

  /* ---------- 审核 ---------- */
  reviews: [
    { id: "RV-26031-A4", project: "SP-26031", node: "剧本审核（节点 A）", object: "SCR-26031-V4", version: "v4", auditor: "林知远", role: "项目负责人", at: "2026-10-06 11:30", result: "通过", note: "锁定正式版本；第 6–9 集节奏已调整。", positions: "E06–E09", tasks: "T-8792 后续", follow: "进入导演规划" },
    { id: "RV-26028-A2", project: "SP-26028", node: "剧本审核（节点 A）", object: "SCR-26028-V1", version: "v1", auditor: "林知远", role: "项目负责人", at: "2026-11-20 09:40", result: "退回修改", note: "第 14–16 集人物动机不足，需补写主动选择。", positions: "E14 / S02 · E16 / S04", tasks: "创建修订任务 T-8796", follow: "回到剧本创作中" },
    { id: "RV-26019-B3", project: "SP-26019", node: "最终成片审核（节点 B）", object: "TL-26019-V3 / 12 集", version: "v3", auditor: "王亦宁", role: "项目负责人", at: "2026-11-18 14:20", result: "通过交付", note: "集数完整、字幕一致、music 授权齐备。", positions: "全 12 集", tasks: "T-8788", follow: "生成交付包 DP-26019-01" },
    { id: "RV-26015-B1", project: "SP-26015", node: "最终成片审核（节点 B）", object: "TL-26015-V2 / 前 8 集", version: "v2", auditor: "林知远", role: "项目负责人", at: "2026-11-21 19:05", result: "指定镜头返工", note: "仅第 9 集 SH-02 合规问题需处理，其余保持。", positions: "E09 / S02 / SH-02", tasks: "T-8821", follow: "建立局部返工任务" }
  ],
  reviewChecklist: [
    { group: "剧本审核", items: ["故事方向与题材定位", "人物设定与关系", "分集剧情与结构", "故事逻辑", "对白质量", "内容合规", "版权与授权风险"] },
    { group: "成片审核", items: ["整体剧情完整性", "成片质量", "人物一致性", "视频画面", "音频质量", "字幕准确性", "集数完整性", "剪辑与节奏", "内容合规", "交付完整性"] }
  ],

  /* ---------- 后期与交付 ---------- */
  timelines: [
    { project: "SP-26031", ep: 16, version: "TL-26031-E16-V3", tracks: 6, clips: 41, duration: "92 秒", timebase: "PTS + 1/25 时基", status: "已输出", stale: 0 },
    { project: "SP-26031", ep: 17, version: "TL-26031-E17-V2", tracks: 6, clips: 38, duration: "94 秒（草稿）", timebase: "PTS + 1/25 时基", status: "编辑中", stale: 2 },
    { project: "SP-26019", ep: 12, version: "TL-26019-V3", tracks: 6, clips: 36, duration: "118 秒", timebase: "PTS + 1/25 时基", status: "已输出", stale: 0 }
  ],
  tracks: [
    { name: "视频轨", items: [{ label: "SH-01", w: 26 }, { label: "SH-02", w: 22 }, { label: "SH-03", w: 30 }, { label: "SH-04", w: 18 }], tone: "accent" },
    { name: "对白轨", items: [{ label: "DL-117", w: 30 }, { label: "DL-118", w: 26 }, { label: "DL-119", w: 34 }], tone: "ok" },
    { name: "音乐轨", items: [{ label: "BGM-07", w: 62 }, { label: "BGM-08", w: 28 }], tone: "info" },
    { name: "音效轨", items: [{ label: "SFX-12", w: 14 }, { label: "SFX-13", w: 20 }, { label: "SFX-14", w: 12 }], tone: "warn" },
    { name: "字幕轨", items: [{ label: "SUB-17 v1", w: 88 }], tone: "muted" },
    { name: "特效轨", items: [{ label: "雨雾叠加", w: 24 }, { label: "闪白", w: 6 }], tone: "muted" }
  ],
  deliveries: [
    { id: "DP-26019-01", project: "SP-26019", version: "V1", episodes: 12, files: 11, size: "6.8 GB", checksum: "sha256:9f3a…c21", reviewer: "王亦宁", at: "2026-11-18 16:05", status: "已交付", receiver: "企业内容库", frozen: true },
    { id: "DP-26007-01", project: "SP-26007", version: "V1", episodes: 30, files: 11, size: "15.2 GB", checksum: "sha256:4b7d…9ea", reviewer: "王亦宁", at: "2026-10-30 11:20", status: "已归档", receiver: "企业内容库", frozen: true },
    { id: "DP-26031-00", project: "SP-26031", version: "—", episodes: 0, files: 0, size: "—", checksum: "—", reviewer: "—", at: "—", status: "未生成（集数未齐）", receiver: "—", frozen: false }
  ],
  deliveryChecklist: [
    { item: "完整短剧成片（整剧打包）", required: true, status: "已就绪" },
    { item: "分集视频文件", required: true, status: "已就绪" },
    { item: "字幕文件（含时间轴）", required: true, status: "已就绪" },
    { item: "封面与宣传素材", required: true, status: "已就绪" },
    { item: "项目剧本与分集大纲", required: true, status: "已就绪" },
    { item: "人物设定与视觉档案摘要", required: true, status: "已就绪" },
    { item: "生产报告 / 质量报告 / 成本报告", required: true, status: "已就绪" },
    { item: "合规与授权资料", required: true, status: "已就绪" },
    { item: "交付清单与校验摘要", required: true, status: "已就绪" }
  ],
  works: [
    { project: "SP-26019", name: "长街旧梦", status: "已交付", episodes: "12 / 12", duration: "24 分钟", delivered: "2026-11-18", version: "交付 V1 · 冻结", next: "可新建 V2，不覆盖历史" },
    { project: "SP-26007", name: "回声计划", status: "已归档", episodes: "30 / 30", duration: "45 分钟", delivered: "2026-10-30", version: "交付 V1 · 冻结", next: "只读可查" },
    { project: "SP-26031", name: "雾城来信", status: "制作中", episodes: "16 / 24", duration: "—", delivered: "—", version: "—", next: "集数未齐，不可交付" },
    { project: "SP-26015", name: "第七码头", status: "返工中", episodes: "8 / 16", duration: "—", delivered: "—", version: "—", next: "合规阻断，待替换素材" }
  ],

  /* ---------- 资产 ---------- */
  assetCategories: [
    "创意与剧本资产", "人物资产", "场景资产", "服装与道具资产", "分镜与镜头资产", "音频资产", "字幕与时间线资产", "成片与交付资产"
  ],
  assets: [
    { id: "A-1201", name: "顾沉 · 正面人物设定", cat: "人物资产", project: "SP-26031", type: "人物参考图", version: "v3", versions: 3, origin: "图像模型 I1 · 参数摘要 p-8821", creator: "林知远", executor: "林知远", size: "1440×1920 · PNG", checksum: "sha256:1c9f…77a", qc: "已确认", rights: "AI 生成 · 无需真人授权", refs: 12, formal: true, at: "2026-10-05 10:12", status: "正式" },
    { id: "A-1198", name: "旧城区雨夜 · 街口场景", cat: "场景资产", project: "SP-26031", type: "场景参考图", version: "v2", versions: 2, origin: "图像模型 I1 · 参数摘要 p-8903", creator: "林知远", executor: "林知远", size: "1920×1080 · PNG", checksum: "sha256:4d02…3be", qc: "已确认", rights: "AI 生成 · 无需授权", refs: 9, formal: true, at: "2026-10-05 11:40", status: "正式" },
    { id: "A-1180", name: "第 16 集成片", cat: "成片与交付资产", project: "SP-26031", type: "分集成片", version: "v2", versions: 2, origin: "转码模型 T1 · 参数摘要 p-9101", creator: "林知远", executor: "林知远", size: "1080×1920 · 92s · MP4", checksum: "sha256:8a31…0cd", qc: "PASS", rights: "项目内使用", refs: 3, formal: true, at: "2026-11-22 09:02", status: "正式" },
    { id: "A-1162", name: "长街旧梦 · 正式剧本", cat: "创意与剧本资产", project: "SP-26019", type: "剧本版本", version: "v5", versions: 5, origin: "推理模型 R1 · 参数摘要 p-7712", creator: "王亦宁", executor: "王亦宁", size: "文本 · 986 行", checksum: "sha256:2f77…9aa", qc: "已审核", rights: "企业自有", refs: 44, formal: true, at: "2026-08-20 10:05", status: "正式（锁定）" },
    { id: "A-1150", name: "第 12 集终版字幕", cat: "字幕与时间线资产", project: "SP-26019", type: "字幕文件", version: "v2", versions: 2, origin: "ASR Model A3 + 人工校对", creator: "王亦宁", executor: "王亦宁", size: "SRT · 118s", checksum: "sha256:5b10…e4f", qc: "已通过", rights: "企业自有", refs: 6, formal: true, at: "2026-11-17 15:20", status: "正式" },
    { id: "A-1132", name: "第 9 集镜头 02 草稿", cat: "分镜与镜头资产", project: "SP-26015", type: "原始视频", version: "v1", versions: 3, origin: "视频模型 A · 参数摘要 p-9122", creator: "林知远", executor: "林知远", size: "1080×1920 · 7s · MP4", checksum: "sha256:7ce0…12b", qc: "FAIL（合规）", rights: "待替换", refs: 0, formal: false, at: "2026-11-21 18:40", status: "临时素材（不可交付）" },
    { id: "A-1120", name: "码头低鸣 · 配乐", cat: "音频资产", project: "SP-26015", type: "配乐", version: "v1", versions: 1, origin: "第三方素材库（授权待补）", creator: "林知远", executor: "林知远", size: "WAV 48k · 32s", checksum: "sha256:0ab9…8c1", qc: "待授权复核", rights: "授权不明确", refs: 2, formal: false, at: "2026-11-19 20:12", status: "阻断交付" },
    { id: "A-1108", name: "第三封信 · 道具设定", cat: "服装与道具资产", project: "SP-26031", type: "道具参考图", version: "v2", versions: 2, origin: "图像模型 I2 · 参数摘要 p-8654", creator: "林知远", executor: "林知远", size: "1024×1024 · PNG", checksum: "sha256:cc31…40d", qc: "已确认", rights: "AI 生成 · 无需授权", refs: 7, formal: true, at: "2026-10-06 09:15", status: "正式" },
    { id: "A-1094", name: "雾城来信 · 分镜图集", cat: "分镜与镜头资产", project: "SP-26031", type: "分镜图", version: "v1", versions: 1, origin: "图像模型 I3 · 参数摘要 p-8930", creator: "林知远", executor: "林知远", size: "148 张 · PNG", checksum: "sha256:91dd…2ff", qc: "已抽检", rights: "AI 生成 · 无需授权", refs: 148, formal: true, at: "2026-10-07 14:30", status: "正式" }
  ],

  /* ---------- 用量与成本 ---------- */
  usage: [
    { id: "US-26031-1121", project: "SP-26031", task: "T-8842", cap: "视频生成", unit: "秒", vendorQty: "6 秒", platformQty: "6 秒", src: "视频供应商 A", status: "已计量", at: "2026-11-22 10:35" },
    { id: "US-26031-1118", project: "SP-26031", task: "T-8839", cap: "语音合成", unit: "字符", vendorQty: "12 字 / 8.4s", platformQty: "8.4 秒音频", src: "语音供应商", status: "计量中", at: "2026-11-22 10:40" },
    { id: "US-26015-1082", project: "SP-26015", task: "T-8821", cap: "视频生成", unit: "秒", vendorQty: "21 秒（含 3 次失败）", platformQty: "7 秒有效", src: "视频供应商 A", status: "已计量", at: "2026-11-21 18:41" },
    { id: "US-26028-1070", project: "SP-26028", task: "T-8792", cap: "推理", unit: "tokens", vendorQty: "68k", platformQty: "68k", src: "推理供应商", status: "已计量", at: "2026-11-22 08:42" },
    { id: "US-26019-1055", project: "SP-26019", task: "T-8788", cap: "视觉理解", unit: "帧", platformQty: "24k 帧", vendorQty: "24k 帧", src: "QC Provider", status: "已计量", at: "2026-11-18 11:10" }
  ],
  budgets: [
    { scope: "企业", name: "企业年度 AI 预算", total: 1200000, used: 486300, reserve: 96000, state: "正常", owner: "沈牧" },
    { scope: "部门", name: "内容创新部", total: 420000, used: 198600, reserve: 42000, state: "正常", owner: "韩清" },
    { scope: "部门", name: "制作中心", total: 380000, used: 201400, reserve: 38000, state: "接近阈值", owner: "王亦宁" },
    { scope: "项目", name: "SP-26031 雾城来信", total: 18000, used: 9260, reserve: 2000, state: "正常", owner: "林知远" },
    { scope: "项目", name: "SP-26015 第七码头", total: 16000, used: 14420, reserve: 800, state: "接近阈值", owner: "林知远" },
    { scope: "项目", name: "SP-26007 回声计划", total: 26000, used: 26000, reserve: 0, state: "已冻结", owner: "王亦宁" }
  ],
  budgetRules: [
    "项目总预算与单集预算两级控制；单集预算之和不得超过总预算，弹性需显式声明。",
    "每个任务提交前估算预计成本并做预算预检，超限则任务保持「待执行」并给出阻塞原因。",
    "失败、重试与取消产生的费用必须入账，不得因无产出而丢弃记录。",
    "预算接近阈值时提醒项目负责人与员工；已超限则暂停受影响任务，不做整项目静默继续。",
    "已合格资产优先复用，避免重复生成；复用不重复计量。",
    "重要镜头允许高质量模型，但需计入预算并保留选择理由。"
  ],
  costs: [
    { id: "CR-26031-221", project: "SP-26031", ep: 17, shot: "SH-04", task: "T-8842", cap: "视频生成", est: 38.0, actual: 38.0, failed: 0, bearer: "企业承担", source: "企业托管额度", provider: "视频供应商 A", status: "已确认", bill: "INV-VA-2611" },
    { id: "CR-26031-218", project: "SP-26031", ep: 17, shot: "SH-05", task: "T-8839", cap: "语音合成", est: 12.0, actual: 0, failed: 0, bearer: "企业承担", source: "企业托管额度", provider: "语音供应商", status: "待核实", bill: "—" },
    { id: "CR-26015-204", project: "SP-26015", ep: 9, shot: "SH-02", task: "T-8821", cap: "视频生成", est: 42.0, actual: 0, failed: 86.4, bearer: "个人承担", source: "员工个人账户扣费", provider: "视频供应商 A", status: "已确认", bill: "INV-VA-2610" },
    { id: "CR-26019-188", project: "SP-26019", ep: 12, shot: "—", task: "T-8788", cap: "视觉理解", est: 14.0, actual: 13.2, failed: 0, bearer: "企业承担", source: "赠送额度 + 企业额度", provider: "QC Provider", status: "已确认", bill: "INV-QC-2609" },
    { id: "CR-26028-165", project: "SP-26028", ep: 1, shot: "—", task: "T-8792", cap: "推理", est: 8.0, actual: 7.4, failed: 0, bearer: "个人承担", source: "员工个人账户扣费", provider: "推理供应商", status: "已确认", bill: "INV-RS-2611" },
    { id: "CR-26031-160", project: "SP-26031", ep: 16, shot: "—", task: "T-8810", cap: "媒体转码", est: 9.0, actual: 8.4, failed: 0, bearer: "企业承担", source: "企业托管额度", provider: "转码供应商", status: "已确认", bill: "INV-TC-2610" }
  ],
  costDimensions: [
    "项目成本", "单集成本", "单镜头成本", "图像生成成本", "视频生成成本", "音频生成成本", "后期处理成本", "失败任务成本", "重试成本", "存储与转码成本"
  ],

  /* ---------- 个人模型资源 ---------- */
  providers: [
    { id: "PRV-01", ownerId: "u-01", owner: "林知远", mode: "个人自持", name: "视频供应商 A", kind: "内置适配器 · 视频生成", endpoint: "https://video.example.local/v2", auth: "Bearer Token", region: "境内", masked: "vp-••••••••7K2P", capabilities: "视频生成 / 视频编辑", quota: "个人额度 · 已用 62%", test: "已验证 · 2026-11-20 09:12", status: "启用", defaultFor: "视频生成" },
    { id: "PRV-02", ownerId: "u-01", owner: "林知远", mode: "个人自持", name: "视觉供应商", kind: "内置适配器 · 视觉理解", endpoint: "https://vision.example.local/v1", auth: "API Key", region: "境内", masked: "vi-••••••••3N5R", capabilities: "视觉理解 / 内容审核", quota: "个人额度 · 已用 34%", test: "已验证 · 2026-11-19 15:40", status: "启用", defaultFor: "视觉理解" },
    { id: "PRV-03", ownerId: "u-01", owner: "林知远", mode: "个人自持", name: "语音供应商", kind: "内置适配器 · 语音", endpoint: "https://speech.example.local/tts", auth: "API Key", region: "境内", masked: "sp-••••••••1M8Q", capabilities: "语音合成 / 语音识别", quota: "个人额度 · 已用 21%", test: "已验证 · 2026-11-18 11:02", status: "启用", defaultFor: "语音合成" },
    { id: "PRV-04", ownerId: "u-01", owner: "林知远", mode: "个人自持", name: "转码供应商", kind: "内置适配器 · 转码", endpoint: "https://media.example.local/transcode", auth: "签名密钥", region: "境内", masked: "tc-••••••••9B4T", capabilities: "媒体转码 / 视频处理", quota: "企业配额 · 部门分配", test: "已验证 · 2026-11-17 17:21", status: "启用", defaultFor: "媒体转码" },
    { id: "PRV-05", ownerId: "u-02", owner: "陈可心", mode: "个人自持", name: "推理供应商", kind: "兼容接口 · 文本推理", endpoint: "https://llm.example.local/v1", auth: "Bearer Token", region: "境内", masked: "rs-••••••••6Y3L", capabilities: "文本生成 / 推理", quota: "个人额度 · 已用 47%", test: "已验证 · 2026-11-22 08:30", status: "启用", defaultFor: "文本生成" },
    { id: "PRV-06", ownerId: "u-03", owner: "王亦宁", mode: "企业托管", name: "QC Provider（企业托管）", kind: "企业托管 · 质量检测", endpoint: "https://qc.enterprise.local/v1", auth: "企业托管密钥", region: "境内", masked: "••••（企业托管，员工仅见脱敏）", capabilities: "视觉理解 / 内容审核", quota: "企业配额 · 制作中心 18%", test: "已验证 · 2026-11-16 10:00", status: "启用", defaultFor: "质量检测" },
    { id: "PRV-07", ownerId: "u-04", owner: "赵一宁", mode: "个人自持", name: "图像供应商 B", kind: "内置适配器 · 图像", endpoint: "https://image.example.local/v1", auth: "API Key", region: "境内", masked: "im-••••••••2Q7Z", capabilities: "图像生成 / 图像编辑", quota: "个人额度 · 已用 12%", test: "失效 · 鉴权失败 2026-11-21", status: "停用", defaultFor: "—" },
    { id: "PRV-08", ownerId: "u-01", owner: "林知远", mode: "个人自持", name: "文本供应商 A", kind: "内置适配器 · 文本生成", endpoint: "https://text.example.local/v1", auth: "Bearer Token", region: "境内", masked: "tx-••••••••5H8Q", capabilities: "文本生成 / 推理", quota: "个人额度 · 已用 28%", test: "已验证 · 2026-11-21 14:05", status: "启用", defaultFor: "文本生成" }
  ],
  modelProfiles: [
    { id: "MP-01", provider: "PRV-01", model: "video-a-2.1", cap: "视频生成", io: "文/图/参考视频 → MP4", limits: "≤ 12s · ≤ 1080×1920 · 参考图 ≤ 4", price: "¥6.3 / 秒", license: "商用可用 · 条款已留档" },
    { id: "MP-02", provider: "PRV-01", model: "video-b-1.0", cap: "视频生成", io: "文/图 → MP4", limits: "≤ 8s · ≤ 720×1280 · 不支持参考图", price: "¥3.1 / 秒", license: "商用可用 · 不可作主生产" },
    { id: "MP-03", provider: "PRV-02", model: "vision-v2", cap: "视觉理解", io: "图像/视频帧 → 结构化结果", limits: "单次 ≤ 48 帧", price: "¥0.42 / 帧", license: "商用可用" },
    { id: "MP-04", provider: "PRV-03", model: "tts-b-3", cap: "语音合成", io: "文本 + 音色 → WAV", limits: "单次 ≤ 600 字", price: "¥0.9 / 百字", license: "商用可用 · 克隆需授权" },
    { id: "MP-05", provider: "PRV-05", model: "reason-r1", cap: "推理", io: "文本 → 结构化文本", limits: "上下文 128k", price: "¥0.11 / 千 tokens", license: "商用可用" },
    { id: "MP-06", provider: "PRV-06", model: "qc-q1", cap: "内容审核", io: "图像/视频 → 检测项", limits: "单次 ≤ 3 分钟素材", price: "企业内结算", license: "企业托管" },
    { id: "MP-07", provider: "PRV-08", model: "text-a-1", cap: "文本生成", io: "文本 → 结构化文本", limits: "上下文 128k · 单次 ≤ 32k tokens", price: "¥0.09 / 千 tokens", license: "商用可用 · 条款已留档" }
  ],
  routePolicy: {
    project: "SP-26031", capability: "视频生成", version: "RP-26031-04",
    primary: "video-a-2.1（PRV-01）", aux: "vision-v2（PRV-02）", backup: "video-b-1.0（PRV-01）",
    basis: "质量优先：人物一致性表现稳定；成本 ¥6.3/秒在项目预算内",
    updated: "2026-11-18 10:26", by: "林知远",
    compat: [
      { item: "输入模式（图生视频 + 参考人物）", primary: "支持", backup: "支持", ok: true },
      { item: "参考图数量 ≥ 3", primary: "支持 4 张", backup: "仅 2 张", ok: false },
      { item: "分辨率 1080×1920", primary: "支持", backup: "仅 720×1280", ok: false },
      { item: "单镜头时长 ≤ 8s", primary: "支持 12s", backup: "支持 8s", ok: true },
      { item: "商用许可", primary: "可商用", backup: "可商用", ok: true }
    ],
    conclusion: "备用模型不可直接承接参考人物类镜头，切换前须降级为无参考镜头或换用其他供应商。"
  },
  callLogs: [
    { id: "MI-90124", provider: "视频供应商 A", model: "video-a-2.1", cap: "视频生成", project: "SP-26031", task: "T-8842", tokens: "—", usage: "6 秒", cost: 38.0, status: "执行中", at: "10:35:12" },
    { id: "MI-90118", provider: "视频供应商 A", model: "video-a-2.1", cap: "视频生成", project: "SP-26015", task: "T-8821", tokens: "—", usage: "7 秒", cost: 31.2, status: "失败 · 计费", at: "18:19:40" },
    { id: "MI-90088", provider: "推理供应商", model: "reason-r1", cap: "推理", project: "SP-26028", task: "T-8792", tokens: "68k", usage: "68k tokens", cost: 7.4, status: "成功", at: "08:42:55" },
    { id: "MI-90071", provider: "语音供应商", model: "tts-b-3", cap: "语音合成", project: "SP-26031", task: "T-8839", tokens: "12 字", usage: "8.4 秒", cost: 12.0, status: "执行中", at: "10:40:03" }
  ],

  /* ---------- 能力字典 ---------- */
  capabilities: [
    { cap: "文本生成", use: "创意、剧本、大纲、结构化内容", io: "文本 → 文本", unit: "tokens", models: 4 },
    { cap: "推理", use: "剧情逻辑、连续性、复杂内容分析", io: "文本 → 结构化文本", unit: "tokens", models: 3 },
    { cap: "图像生成", use: "人物、场景、道具、分镜", io: "文本/参考图 → 图像", unit: "张", models: 5 },
    { cap: "图像编辑", use: "参考图修正、局部重绘、风格统一", io: "图像 + 指令 → 图像", unit: "张", models: 3 },
    { cap: "视频生成", use: "镜头与动态表演", io: "文本/图/参考视频 → 视频", unit: "秒", models: 4 },
    { cap: "视频编辑", use: "延展、修复、增强、裁剪", io: "视频 + 指令 → 视频", unit: "秒", models: 2 },
    { cap: "语音合成", use: "角色配音、旁白", io: "文本 + 音色 → 音频", unit: "字符 / 秒", models: 3 },
    { cap: "语音识别", use: "台词识别、字幕校对、配音回听", io: "音频 → 文本", unit: "音频秒", models: 2 },
    { cap: "音乐生成", use: "配乐", io: "提示 + 时长 → 音频", unit: "曲目", models: 2 },
    { cap: "音效生成", use: "环境音、动作音效", io: "提示 → 音频", unit: "条", models: 2 },
    { cap: "口型同步", use: "对白与画面口型匹配", io: "视频 + 音频 → 视频", unit: "秒", models: 2 },
    { cap: "数字人", use: "人物表演驱动", io: "形象 + 文本/音频 → 视频", unit: "秒", models: 1 },
    { cap: "视觉理解", use: "画面审核、人物与场景一致性判断", io: "图像/帧 → 结构化结果", unit: "帧", models: 2 },
    { cap: "内容审核", use: "合规与风险识别", io: "文本/图像/视频 → 风险项", unit: "次", models: 3 },
    { cap: "视频处理", use: "调色、增强、修复", io: "视频 + 参数 → 视频", unit: "秒", models: 2 },
    { cap: "媒体转码", use: "格式、码率、封装转换", io: "媒体 → 媒体", unit: "分钟", models: 2 }
  ],
  videoCapabilities: [
    { item: "文生视频", status: "已接入", note: "视频模型 A/B" }, { item: "图生视频", status: "已接入", note: "参考图 ≤ 4 张" },
    { item: "参考人物视频", status: "已接入", note: "身份一致性约束" }, { item: "人物动作生成", status: "受限", note: "仅单人简动作" },
    { item: "人物表情生成", status: "受限", note: "需参考表情图" }, { item: "多人物互动", status: "受限", note: "≤ 2 人" },
    { item: "对白口型同步", status: "已接入", note: "Lip Model L1" }, { item: "镜头运动", status: "已接入", note: "推拉摇移" },
    { item: "场景动态生成", status: "已接入", note: "雨、雾、灯影" }, { item: "视频延展", status: "受限", note: "≤ 4 秒延展" },
    { item: "镜头衔接", status: "规则实现", note: "同场景顺序生产" }, { item: "视频修复", status: "已接入", note: "去闪烁/降噪" },
    { item: "镜头重新生成", status: "已接入", note: "局部返工" }
  ],
  postCapabilities: [
    "镜头筛选", "镜头排序", "自动剪辑", "镜头时长调整", "转场", "画面裁切", "画幅与比例调整", "调色", "画面增强", "字幕生成与合成", "特效", "片头片尾", "音频混合", "视频合成", "成片输出"
  ],

  /* ---------- 经营分析 ---------- */
  analytics: {
    enterprise: [
      { label: "项目总数", value: "18", foot: "进行中 6 · 已完成 9 · 已终止 3" },
      { label: "交付作品", value: "7", foot: "累计 96 集 · 成片 182 分钟" },
      { label: "剧本审核通过率", value: "78.6%", foot: "14 通过 / 18 提交" },
      { label: "终审通过率", value: "87.5%", foot: "7 通过 / 8 提交" },
      { label: "镜头生成成功率", value: "91.2%", foot: "终态任务为分母 · 取消单列" },
      { label: "视频返工率", value: "8.4%", foot: "返工镜头 / 已生产镜头" },
      { label: "企业 AI 总消耗", value: "¥486,300", foot: "实际 ¥462,180 · 待核实 ¥24,120" },
      { label: "失败任务成本", value: "¥38,640", foot: "含重试与取消 · 已入账" },
      { label: "预算使用率", value: "40.5%", foot: "年度预算 ¥1,200,000" },
      { label: "平均单集成本", value: "¥4,810", foot: "交付集口径" },
      { label: "平均制作周期", value: "18.4 天", foot: "生产启动至交付 · 不含暂停" },
      { label: "单位时间完成集数", value: "5.2 集 / 周", foot: "近 12 周均值" }
    ],
    depts: [
      { dept: "内容创新部", members: 16, projects: 8, delivered: 3, episodes: 48, cost: 198600, quality: 90.2, cycle: 17.2, budget: 420000 },
      { dept: "制作中心", members: 13, projects: 6, delivered: 3, episodes: 52, cost: 201400, quality: 91.6, cycle: 16.5, budget: 380000 },
      { dept: "短剧二组", members: 7, projects: 4, delivered: 0, episodes: 6, cost: 47100, quality: 84.2, cycle: 21.8, budget: 120000 },
      { dept: "经营管理部", members: 6, projects: 0, delivered: 0, episodes: 0, cost: 0, quality: 0, cycle: 0, budget: 160000 }
    ],
    contribution: [
      { user: "林知远", created: 3, executed: 8, reviewed: 4, delivered: 2, cost: 62280, quality: 92.1 },
      { user: "王亦宁", created: 4, executed: 3, reviewed: 2, delivered: 3, cost: 88360, quality: 90.7 },
      { user: "陈可心", created: 2, executed: 2, reviewed: 1, delivered: 1, cost: 31240, quality: 89.4 },
      { user: "韩清", created: 2, executed: 1, reviewed: 1, delivered: 1, cost: 27600, quality: 88.0 },
      { user: "赵一宁", created: 1, executed: 1, reviewed: 0, delivered: 0, cost: 8940, quality: 84.2 }
    ],
    personal: {
      user: "陈可心",
      metrics: [
        { label: "创建项目数", value: "2", foot: "成功创建且有效归属" },
        { label: "有效生产项目数", value: "2", foot: "至少一项真实生产任务启动" },
        { label: "完成短剧数", value: "1", foot: "终审通过并交付" },
        { label: "完成集数", value: "20", foot: "终审通过并交付的集数" },
        { label: "视频生产量", value: "306 镜头 / 26 分钟", foot: "实际生成并持久化" },
        { label: "任务成功率", value: "93.8%", foot: "终态任务 · 取消不计入" },
        { label: "返工率", value: "6.1%", foot: "返工镜头 / 已生产镜头" },
        { label: "AI 使用成本", value: "¥31,240", foot: "个人承担 ¥8,600 · 企业承担 ¥22,640" }
      ]
    },
    snapshots: [
      { id: "SN-2026-11-21", at: "2026-11-21 00:00", projects: 18, delivered: 7, episodes: 96, quality: 90.1, cost: 478200, failed: 37600, frozen: true },
      { id: "SN-2026-11-14", at: "2026-11-14 00:00", projects: 17, delivered: 7, episodes: 92, quality: 89.4, cost: 451800, failed: 34920, frozen: true },
      { id: "SN-2026-11-07", at: "2026-11-07 00:00", projects: 17, delivered: 6, episodes: 84, quality: 88.7, cost: 426500, failed: 31880, frozen: true }
    ],
    trend: { labels: ["9/27", "10/4", "10/11", "10/18", "10/25", "11/1", "11/8", "11/15", "11/21"], delivered: [2, 3, 3, 4, 4, 5, 6, 7, 7], cost: [82000, 96000, 124000, 186000, 248000, 302000, 356000, 412000, 462000] }
  },

  /* ---------- 合规与审计 ---------- */
  rights: [
    { id: "RT-01", project: "SP-26031", subject: "AI 生成形象 · 顾沉", type: "生成内容", owner: "平台生成", proof: "模型商用条款 M-2026-11", use: "短剧正片 · 全渠道", region: "中国大陆", term: "长期 · 随项目", commercial: "可商用", limit: "不得用于真人代言类场景", review: "已复核", status: "有效" },
    { id: "RT-02", project: "SP-26015", subject: "真人声音克隆 · 陈默音色", type: "声音", owner: "配音演员（虚构姓名）", proof: "授权书 AT-2026-041", use: "第 1–16 集对白", region: "中国大陆", term: "至 2026-12-31", commercial: "可商用 · 不含二次销售", limit: "不得用于其他项目", review: "待到期复核", status: "30 天内到期" },
    { id: "RT-03", project: "SP-26015", subject: "配乐 · 码头低鸣", type: "音乐", owner: "第三方素材库", proof: "缺失", use: "第 8–9 集", region: "—", term: "—", commercial: "不明确", limit: "来源不明不得交付", review: "未通过", status: "阻断交付" },
    { id: "RT-04", project: "SP-26031", subject: "字体 · 思源黑体（演示名）", type: "字体", owner: "开源字体许可", proof: "OSS-Font-1.1", use: "全项目字幕", region: "全球", term: "长期", commercial: "可商用", limit: "保留许可声明", review: "已复核", status: "有效" },
    { id: "RT-05", subject: "模型服务条款 · 视频供应商 A", type: "模型条款", owner: "供应商", proof: "ToS 2026-09 存档", use: "视频生成", region: "境内", term: "订阅期内", commercial: "可商用 · 需标注 AI 生成", limit: "不得反向工程", review: "已复核", status: "有效" },
    { id: "RT-06", project: "SP-26031", subject: "场景参考 · 旧城区街口", type: "第三方素材", owner: "自摄素材（企业自有）", proof: "内部素材编号 SP-OWN-118", use: "第 1–24 集", region: "中国大陆", term: "长期", commercial: "可商用", limit: "不含可识别人物", review: "已复核", status: "有效" }
  ],
  risks: [
    { id: "RK-0142", project: "SP-26015", type: "内容合规高风险", where: "E09 / S02 / SH-02", level: "高", action: "阻断下游，替换疑似标识后重生成", owner: "林知远", status: "处理中", at: "2026-11-21 18:15" },
    { id: "RK-0139", project: "SP-26015", type: "授权不明确", where: "AU-26015-BGM-03", level: "高", action: "阻断交付，补授权或替换素材", owner: "林知远", status: "待补授权", at: "2026-11-20 10:02" },
    { id: "RK-0135", project: "SP-26031", type: "人物严重不一致", where: "E17 / S03 / SH-05", level: "中", action: "重建参考 + 局部重生成 + 抽检", owner: "林知远", status: "处理中", at: "2026-11-22 10:50" },
    { id: "RK-0131", project: "SP-26028", type: "剧情偏离正式剧本", where: "E01 / S02", level: "中", action: "回溯镜头与剧本比对后重生成", owner: "陈可心", status: "已闭环", at: "2026-11-19 16:30" },
    { id: "RK-0128", project: "SP-26031", type: "预算接近阈值", where: "项目 SP-26015", level: "低", action: "提醒负责人并暂停非关键镜头", owner: "林知远", status: "已通知", at: "2026-11-21 09:40" }
  ],
  audits: [
    { time: "2026-11-22 10:50", actor: "林知远", object: "项目 SP-26031", action: "发起镜头局部返工", result: "成功", src: "10.12.4.31 · 桌面端", link: "RW-26031-014" },
    { time: "2026-11-22 09:40", actor: "沈牧", object: "员工 u-09", action: "账号停用并冻结会话", result: "成功", src: "10.12.4.8 · 桌面端", link: "AUD-8871" },
    { time: "2026-11-21 18:41", actor: "系统 · 任务服务", object: "任务 T-8821", action: "失败重试达上限转人工", result: "待人工处理", src: "worker-3", link: "AT-8821-3" },
    { time: "2026-11-21 17:26", actor: "周砚", object: "个人凭据 PRV-07", action: "凭据变更（仅记录元数据）", result: "成功", src: "10.12.9.11 · 跳板机", link: "AUD-8865" },
    { time: "2026-11-20 15:02", actor: "韩清", object: "项目成员 u-04", action: "撤销项目编辑授权", result: "成功", src: "10.12.4.19 · 桌面端", link: "AUD-8850" },
    { time: "2026-11-19 11:30", actor: "许衡", object: "成本报表 2026-11", action: "导出成本明细", result: "成功", src: "10.12.6.4 · 桌面端", link: "AUD-8842" },
    { time: "2026-11-18 16:05", actor: "王亦宁", object: "交付 DP-26019-01", action: "执行交付并冻结版本", result: "成功", src: "10.12.4.27 · 桌面端", link: "DP-26019-01" }
  ],
  auditTypes: [
    "登录与身份变化", "角色与权限调整", "项目创建 / 移交 / 归档 / 终止", "个人凭据配置变更（仅元数据）",
    "模型路由变化", "任务提交 / 重试 / 取消 / 暂停", "预算与费用修正", "资产下载 / 删除 / 导出",
    "审核结论", "交付执行", "数据导出"
  ],

  /* ---------- 通知与异常 ---------- */
  notifications: [
    { id: "N-4412", type: "待剧本审核", project: "SP-26028", title: "《逆光的约定》剧本 v2 待审核", reason: "候选剧本生成完成且自检通过", impact: "第 1–20 集下游生产全部阻塞", state: "待处理", action: "逐集预览后通过或退回", owner: "林知远", link: "creation/review", unread: true, at: "2026-11-22 08:52" },
    { id: "N-4410", type: "质量不通过", project: "SP-26031", title: "第 17 集 03 场 3 项待人工判断", reason: "人物一致性 2 项 + 口型 1 项", impact: "仅影响 E17 该场景，其余镜头不受影响", state: "处理中", action: "局部返工或接受并记录理由", owner: "林知远", link: "quality/reports", unread: true, at: "2026-11-22 10:51" },
    { id: "N-4408", type: "资源失效", project: "SP-26028", title: "个人配置 PRV-07 鉴权失败", reason: "API Key 失效（供应商返回 401）", impact: "该配置相关任务已暂停，未静默改用他人凭据", state: "待处理", action: "更新凭据后重试", owner: "赵一宁", link: "models/providers", unread: false, at: "2026-11-21 21:12" },
    { id: "N-4405", type: "预算提醒", project: "SP-26015", title: "《第七码头》预算接近阈值", reason: "已用 90.1%，剩余 ¥1,580", impact: "高成本镜头需先请示调整", state: "已通知", action: "调整预算或缩减范围", owner: "林知远", link: "cost/budget", unread: false, at: "2026-11-21 09:40" },
    { id: "N-4402", type: "授权到期", project: "SP-26015", title: "声音克隆授权 30 天内到期", reason: "AT-2026-041 有效期至 2026-12-31", impact: "到期后相关对白不可交付", state: "待处理", action: "续期或替换音色", owner: "林知远", link: "compliance/rights", unread: false, at: "2026-11-20 10:02" },
    { id: "N-4398", type: "交付完成", project: "SP-26019", title: "《长街旧梦》交付包已生成", reason: "终审通过且集数完整", impact: "已冻结交付 V1", state: "已完成", action: "查看交付包与校验摘要", owner: "王亦宁", link: "post/delivery", unread: false, at: "2026-11-18 16:05" },
    { id: "N-4390", type: "异常升级", project: "SP-26015", title: "异常超 4 小时未处理，已升级", reason: "合规阻断未在阈值内处理", impact: "第 9–16 集交付全部阻塞", state: "已升级", action: "由企业管理员指派处理人", owner: "沈牧", link: "notify/incidents", unread: true, at: "2026-11-21 22:30" }
  ],
  incidents: [
    { id: "IN-0087", project: "SP-26015", type: "内容合规高风险", first: "2026-11-21 18:15", handled: 3, last: "2026-11-22 09:20", action: "暂停 E09 受影响链路；发起素材替换重生成", decision: "林知远 · 待补授权后重生成", result: "未闭环", next: "替换画面元素 → 重生成 SH-02 → 抽检", level: "升级至企业管理员" },
    { id: "IN-0083", project: "SP-26031", type: "人物严重不一致", first: "2026-11-22 10:50", handled: 1, last: "2026-11-22 10:50", action: "仅暂停 E17/S03 链路，其余镜头继续", decision: "林知远 · 局部重生成", result: "处理中", next: "重建参考 → 重生成 SH-05 → 复检", level: "项目负责人" },
    { id: "IN-0081", project: "SP-26028", type: "模型不可用", first: "2026-11-21 21:12", handled: 2, last: "2026-11-21 21:40", action: "暂停依赖该配置的任务并通知配置人", decision: "赵一宁 · 更新凭据", result: "已闭环", next: "凭据更新后重做资源可用性检查", level: "配置人" },
    { id: "IN-0079", project: "SP-26031", type: "预算接近阈值", first: "2026-11-21 09:40", handled: 1, last: "2026-11-21 10:10", action: "提醒负责人，未自动暂停", decision: "林知远 · 降低非关键镜头质量档", result: "已闭环", next: "按预算规则继续观察", level: "项目负责人" }
  ],

  /* ---------- 菜单结构（通用静态原型开发规范 §五 / §六）----------
     一级菜单 = 顶层导航域；二级菜单 = 流程节点；三级（子）菜单 = 具体操作，对应一条路由。
     短剧制作整体流程收在一个一级菜单下，其二级菜单即生产流程节点（立项 → 创意剧本 → 导演视觉 →
     视频 → 音频字幕 → 后期交付 → 质量返工），三级为各节点下的具体操作。
     菜单与路由注册表的一致性由 tools/regress.mjs 交叉校验，避免两处口径漂移。 */
  menu: [
    {
      id: "workspace", label: "创作工作台", icon: "home",
      children: [
      { id: "workspace-desk", label: "工作台", items: [
        { id: "w-home", label: "工作台首页", path: "workspace/home", perm: "analytics.own" },
        { id: "w-assistant", label: "指令式生产助手", path: "workspace/assistant", perm: "creation.write" },
        { id: "w-projects", label: "我的项目", path: "workspace/projects", perm: "project.read" }
      ] },
      { id: "workspace-notify", label: "通知与异常", items: [
        { id: "w-inbox", label: "待办与通知", path: "notify/inbox", perm: "notify.handle" },
        { id: "w-incidents", label: "异常中心", path: "notify/incidents", perm: "notify.handle" }
      ] }
      ]
    },
    {
      id: "production", label: "短剧制作", icon: "film",
      children: [
      { id: "prod-project", label: "立项与项目", items: [
        { id: "p-list", label: "项目列表", path: "projects/list", perm: "project.read" },
        { id: "p-new", label: "新建项目", path: "projects/new", perm: "project.create" },
        { id: "p-workflow", label: "制作流水线", path: "projects/workflow", perm: "project.read" },
        { id: "p-detail", label: "项目详情", path: "projects/detail", perm: "project.read", hidden: true },
        { id: "p-lifecycle", label: "生命周期与状态机", path: "projects/lifecycle", perm: "project.manage" }
      ] },
      { id: "prod-creation", label: "创意与剧本", items: [
        { id: "c-brief", label: "创意设定", path: "creation/brief", perm: "creation.write" },
        { id: "c-plan", label: "创意方案", path: "creation/plan", perm: "creation.write" },
        { id: "c-script", label: "剧本版本", path: "creation/script", perm: "creation.write" },
        { id: "c-review", label: "剧本审核", path: "creation/review", perm: "script.review" },
        { id: "c-breakdown", label: "剧本拆解", path: "creation/breakdown", perm: "creation.write" }
      ] },
      { id: "prod-director", label: "导演与视觉", items: [
        { id: "d-plan", label: "镜头生产计划", path: "director/plan", perm: "director.write" },
        { id: "d-cast", label: "人物视觉档案", path: "director/cast", perm: "director.write" },
        { id: "d-world", label: "场景与道具", path: "director/world", perm: "director.write" },
        { id: "d-shots", label: "镜头契约", path: "director/shots", perm: "director.write" },
        { id: "d-storyboard", label: "分镜板", path: "director/storyboard", perm: "director.write" }
      ] },
      { id: "prod-video", label: "视频生产", items: [
        { id: "v-queue", label: "视频生产队列", path: "video/production", perm: "production.write" },
        { id: "v-results", label: "生成结果", path: "video/results", perm: "production.write" },
        { id: "v-preview", label: "预览与校验", path: "video/preview", perm: "production.write" }
      ] },
      { id: "prod-audio", label: "音频与字幕", items: [
        { id: "a-dialogue", label: "对白配音", path: "audio/dialogue", perm: "production.write" },
        { id: "a-voice", label: "声音档案", path: "audio/voice", perm: "production.write" },
        { id: "a-bgm", label: "配乐与音效", path: "audio/bgm", perm: "production.write" },
        { id: "a-subtitle", label: "字幕与口型", path: "audio/subtitle", perm: "production.write" }
      ] },
      { id: "prod-post", label: "后期与交付", items: [
        { id: "o-timeline", label: "时间线与剪辑", path: "post/timeline", perm: "post.write" },
        { id: "o-episodes", label: "分集成片", path: "post/episodes", perm: "post.write" },
        { id: "o-review", label: "最终成片审核", path: "post/review", perm: "final.review" },
        { id: "o-delivery", label: "交付包", path: "post/delivery", perm: "delivery.execute" },
        { id: "o-works", label: "作品库", path: "post/works", perm: "delivery.execute" },
        { id: "o-versions", label: "版本链", path: "post/versions", perm: "post.write" }
      ] },
      { id: "prod-quality", label: "质量与返工", items: [
        { id: "q-gates", label: "质量门禁", path: "quality/gates", perm: "quality.read" },
        { id: "q-reports", label: "质量报告", path: "quality/reports", perm: "quality.read" },
        { id: "q-rework", label: "返工与返工台账", path: "quality/rework", perm: "quality.operate" }
      ] }
      ]
    },
    {
      id: "resource", label: "资源与治理", icon: "cube",
      children: [
      { id: "res-models", label: "模型资源", items: [
        { id: "m-config", label: "资源配置", path: "models/config", perm: "models.own" },
        { id: "m-providers", label: "供应商与模型", path: "models/providers", perm: "models.manage" },
        { id: "m-routing", label: "能力与路由", path: "models/routing", perm: "models.manage" }
      ] },
      { id: "res-tasks", label: "生产任务", items: [
        { id: "k-list", label: "生产任务", path: "tasks/list", perm: ["task.operate", "audit.read"] },
        { id: "k-queue", label: "资源池与队列", path: "tasks/queue", perm: ["task.operate", "audit.read"] },
        { id: "k-attempt", label: "尝试与调用记录", path: "tasks/attempt", perm: ["task.operate", "audit.read"] }
      ] },
      { id: "res-assets", label: "数字资产", items: [
        { id: "s-library", label: "资产库", path: "assets/library", perm: "asset.read" },
        { id: "s-usage", label: "引用与使用关系", path: "assets/usage", perm: "asset.read" }
      ] },
      { id: "res-cost", label: "成本与预算", items: [
        { id: "t-ledger", label: "成本台账", path: "cost/ledger", perm: "cost.read" },
        { id: "t-budget", label: "预算与阈值", path: "cost/budget", perm: "cost.read" },
        { id: "t-usage", label: "用量与计量", path: "cost/usage", perm: "cost.read" }
      ] }
      ]
    },
    {
      id: "analysis", label: "经营分析", icon: "chart",
      children: [
      { id: "ana-enterprise", label: "企业经营", items: [
        { id: "n-enterprise", label: "企业整体数据", path: "analytics/enterprise", perm: "analytics.read" },
        { id: "n-departments", label: "部门对比", path: "analytics/departments", perm: "analytics.read" },
        { id: "n-employees", label: "员工对比", path: "analytics/employees", perm: "analytics.read" },
        { id: "n-me", label: "我的数据", path: "analytics/me", perm: ["analytics.own", "analytics.read"] }
      ] }
      ]
    },
    {
      id: "enterprise", label: "企业与合规", icon: "shield",
      children: [
      { id: "ent-org", label: "组织与权限", items: [
        { id: "g-enterprise", label: "企业主体", path: "orgs/enterprise", perm: "enterprise.read" },
        { id: "g-departments", label: "部门与组织单元", path: "orgs/departments", perm: "org.read" },
        { id: "g-members", label: "员工账号", path: "orgs/members", perm: "org.read" },
        { id: "g-member", label: "员工档案", path: "orgs/member", perm: "org.read", hidden: true },
        { id: "g-roles", label: "角色与权限", path: "orgs/roles", perm: "org.read" },
        { id: "g-grants", label: "项目成员授权", path: "orgs/grants", perm: "grant.manage" },
        { id: "g-handover", label: "离职与移交", path: "orgs/handover", perm: "grant.manage" }
      ] },
      { id: "ent-compliance", label: "合规与审计", items: [
        { id: "y-rights", label: "权利与授权台账", path: "compliance/rights", perm: "compliance.read" },
        { id: "y-risks", label: "风险与异常", path: "compliance/risks", perm: "compliance.read" },
        { id: "y-audit", label: "审计日志", path: "compliance/audit", perm: "compliance.read" }
      ] }
      ]
    },
    {
      id: "platform", label: "平台运维", icon: "server",
      children: [
      { id: "plat-ops", label: "平台管理", items: [
        { id: "o-overview", label: "平台总览", path: "ops/overview", perm: "platform.read" },
        { id: "o-capabilities", label: "能力字典与适配器", path: "ops/capabilities", perm: "platform.read" },
        { id: "o-queue", label: "队列、存储与备份", path: "ops/queue", perm: "platform.read" },
        { id: "o-logs", label: "系统日志", path: "ops/logs", perm: "platform.read" },
        { id: "o-config", label: "平台业务配置", path: "ops/config", perm: "platform.config" }
      ] }
      ]
    }
  ],
  /* ---------- 平台管理与系统 ---------- */
  ops: {
    logs: [
      { at: "2026-11-22 10:51", level: "WARN", source: "调度服务", message: "镜头 SH-26031-E17-05 重试达上限，已转人工处理" },
      { at: "2026-11-22 10:35", level: "INFO", source: "供应商回执", message: "视频供应商 A 受理任务 va_9f21c7（请求摘要已脱敏）" },
      { at: "2026-11-22 09:20", level: "ERROR", source: "媒体存储", message: "对象校验失败 1 个，已标记重取并保留占位" },
      { at: "2026-11-22 08:12", level: "INFO", source: "任务队列", message: "视频队列并发 3/3，新增任务转排队" },
      { at: "2026-11-21 23:40", level: "WARN", source: "备份任务", message: "媒体存储增量备份延迟 12 分钟，已在窗口内完成" },
      { at: "2026-11-21 21:12", level: "ERROR", source: "供应商回执", message: "QC Provider 鉴权失败，已暂停引用该配置的质检任务" }
    ],
    services: [
      { name: "业务 API", kind: "服务", status: "健康", latency: "42 ms", load: "23%", note: "P95 82ms · 错误率 0.04%" },
      { name: "任务调度器", kind: "服务", status: "健康", latency: "12 ms", load: "18%", note: "worker × 3 · 队列积压 4" },
      { name: "媒体处理", kind: "服务", status: "降级", latency: "1.2 s", load: "76%", note: "转码并发受限 · 已限流" },
      { name: "对象存储", kind: "基础设施", status: "健康", latency: "8 ms", load: "62%", note: "1.8 TB / 3 TB" },
      { name: "数据库", kind: "基础设施", status: "健康", latency: "3 ms", load: "41%", note: "连接 68 / 200 · 备份 03:00 成功" },
      { name: "队列中间件", kind: "基础设施", status: "健康", latency: "5 ms", load: "29%", note: "重试队列 2 · 死信 0" }
    ],
    queue: [
      { name: "视频生成队列", pending: 4, running: 3, failed: 1, retry: 2, concurrency: "3 / 6", avg: "4.6 分钟", note: "供应商限流中，退避 60s" },
      { name: "语音与音乐队列", pending: 2, running: 2, failed: 0, retry: 0, concurrency: "2 / 4", avg: "48 秒", note: "正常" },
      { name: "质量检测队列", pending: 1, running: 2, failed: 0, retry: 1, concurrency: "2 / 2", avg: "2.1 分钟", note: "饱和，建议扩容" },
      { name: "合成与转码队列", pending: 6, running: 1, failed: 0, retry: 0, concurrency: "1 / 3", avg: "6.8 分钟", note: "受媒体处理降级影响" }
    ],
    adapters: [
      { name: "video-adapter", cap: "视频生成 / 视频编辑", vendor: "视频供应商 A", version: "2.1.4", contract: "同步提交 + 轮询", status: "启用", errors: "E-4011 超时 · E-4102 参数不支持" },
      { name: "speech-adapter", cap: "语音合成 / 语音识别", vendor: "语音供应商", version: "1.8.0", contract: "同步返回 + 回调", status: "启用", errors: "E-4203 音色不存在" },
      { name: "image-adapter", cap: "图像生成 / 图像编辑", vendor: "图像供应商 B", version: "3.0.1", contract: "异步任务 + 轮询", status: "停用", errors: "E-4301 鉴权失败（凭据失效）" },
      { name: "qc-adapter", cap: "视觉理解 / 内容审核", vendor: "QC Provider", version: "1.2.0", contract: "批量帧提交", status: "启用", errors: "E-4501 帧数超限" },
      { name: "media-adapter", cap: "媒体转码 / 视频处理", vendor: "转码供应商", version: "0.9.7", contract: "本地进程 + 任务", status: "降级", errors: "E-4602 并发不足" }
    ],
    storage: { total: "3 TB", used: "1.8 TB", formal: "1.2 TB", temp: "0.36 TB", audit: "0.02 TB", backup: "每日 03:00 · 保留 30 天", checksumFail: 1 },
    retention: [
      { object: "业务数据（项目/剧本/任务）", period: "长期保留", action: "归档只读，不清理", note: "参与历史统计" },
      { object: "正式资产与交付包", period: "长期保留", action: "冻结版本，不清理", note: "交付可追溯" },
      { object: "临时生成素材", period: "30 天", action: "到期自动清理", note: "被引用则跳过并记录" },
      { object: "调用日志", period: "180 天", action: "归档后清理", note: "费用与追溯依赖项单独保留" },
      { object: "审计记录", period: "≥ 3 年", action: "不可由普通用户删除", note: "导出亦记审计" },
      { object: "备份", period: "30 天滚动", action: "异地副本 1 份", note: "密钥恢复材料单独保管" }
    ],
    platformConfig: [
      { key: "默认项目预算", value: "¥12,000", note: "企业管理员可在范围内调整" },
      { key: "单项目集数上限", value: "60 集", note: "超出需审批" },
      { key: "任务最大重试次数", value: "3 次", note: "退避 30s / 120s / 480s" },
      { key: "视频生成并发上限", value: "6", note: "按供应商配额动态下调" },
      { key: "预算提醒阈值", value: "85%", note: "提醒负责人与员工" },
      { key: "数据保留期（临时素材）", value: "30 天", note: "被引用不清理" },
      { key: "模型白名单", value: "26 个模型 / 12 个能力族", note: "收紧不中断执行中任务" },
      { key: "审核节点", value: "剧本 + 终审", note: "MVP 不开放豁免通道" }
    ],
    backups: [
      { target: "数据库全量", at: "2026-11-22 03:00", size: "18 GB", result: "成功", verify: "校验通过", keep: "30 天" },
      { target: "媒体存储增量", at: "2026-11-22 03:20", size: "126 GB", result: "成功", verify: "抽验 20 个对象通过", keep: "30 天" },
      { target: "配置与密钥材料", at: "2026-11-21 23:00", size: "42 MB", result: "成功", verify: "双人复核", keep: "单独保管" }
    ]
  },

  /* ---------- 枚举映射（全项目统一口径） ---------- */
  enums: {
    toneByStatus: {
      "成功": "ok", "已通过": "ok", "已确认": "ok", "已交付": "ok", "已归档": "ok", "正常": "ok", "健康": "ok", "已验证": "ok", "启用": "ok", "在职": "ok", "通过": "ok", "PASS": "ok", "已完成": "ok", "已闭环": "ok", "已计量": "ok",
      "执行中": "info", "排队中": "info", "计量中": "info", "编辑中": "info", "处理中": "info", "抽检通过": "info",
      "待执行": "warn", "待审核": "warn", "待验证": "warn", "待确认": "warn", "待处理": "warn", "待补授权": "warn", "待人工处理": "bad", "待抽检": "warn", "接近阈值": "warn", "待核实": "warn", "REVIEW_REQUIRED": "warn", "降级": "warn", "已通知": "warn", "待到期复核": "warn", "待复核": "warn",
      "失败": "bad", "异常中": "bad", "需处理": "bad", "阻断": "bad", "阻断交付": "bad", "停用": "bad", "已终止": "bad", "已冻结": "bad", "FAIL": "bad", "未通过": "bad", "已升级": "bad", "需重做": "bad", "未闭环": "bad"
    }
  }
};
