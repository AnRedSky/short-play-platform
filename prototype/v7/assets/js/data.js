/* 数据层：只读业务字典、演示身份、角色与枚举。禁止在渲染阶段改写数据。 */
window.DB = {
  meta: {
    product: 'FRAMEWORK',
    edition: 'AI PRODUCTION OS / 07',
    version: 'V7.4',
    benchmark: '完整项目业务方案 V1.0'
  },

  /* 工作台导航：一级仅“短剧制作工作台”与“企业与平台”，制作流程按环节排序；
     路由通过 stage 字段归入环节，模块不再自行拆分一级菜单 */
  flow: [
    {
      group: 'workflow', label: '短剧制作工作台', icon: '◫', defaultOpen: true,
      stages: [
        { key: 'overview', label: '总览' },
        { key: 'project', label: '项目创建' },
        { key: 'script', label: '剧本创作' },
        { key: 'assets', label: '素材与分镜' },
        { key: 'shoot', label: '拍摄排期' },
        { key: 'post', label: '后期制作' },
        { key: 'deliver', label: '审核交付' },
        { key: 'release', label: '发布上线' },
        { key: 'insight', label: '运营分析' }
      ]
    },
    {
      group: 'admin', label: '企业与平台', icon: '▦', defaultOpen: false,
      stages: [
        { key: 'governance', label: '企业治理' },
        { key: 'people', label: '组织与身份' },
        { key: 'platform', label: '平台与审计' }
      ]
    }
  ],

  /* 企业内部租户空间：企业主体唯一，租户为内部组织与隔离单元 */
  tenants: [
    { id: 'tn-north', name: '北方制作中心', code: 'NORTH-01', owner: '林知远', members: 18, projects: 12, budget: 85000, used: 52600, status: '运行中', modelPolicy: '继承企业白名单', retention: '项目数据 36 个月', createdAt: '2025-03-12', updated: '2026-11-20' },
    { id: 'tn-short', name: '精品短剧事业部', code: 'DRAMA-02', owner: '周予安', members: 12, projects: 9, budget: 62000, used: 41800, status: '运行中', modelPolicy: '恋爱 / 都市优先', retention: '项目数据 36 个月', createdAt: '2025-06-08', updated: '2026-11-18' },
    { id: 'tn-lab', name: 'AI 创新实验室', code: 'LAB-03', owner: '陈屿', members: 7, projects: 5, budget: 40000, used: 12900, status: '运行中', modelPolicy: '实验能力白名单', retention: '项目数据 24 个月', createdAt: '2025-08-21', updated: '2026-11-15' },
    { id: 'tn-archive', name: '历史项目组', code: 'ARCH-04', owner: '系统归档', members: 0, projects: 4, budget: 0, used: 0, status: '已归档', modelPolicy: '只读', retention: '永久保留', createdAt: '2024-11-01', updated: '2026-11-01' }
  ],

  /* 权限身份：决定菜单、路由可达性与操作入口显隐 */
  roles: [
    { id: 'platform', name: '平台运维管理员', desc: '基础设施、运行配置与运维审计', scope: '平台技术域', limit: '不默认读取业务内容' },
    { id: 'enterprise', name: '企业级管理员', desc: '企业主体、全局身份、租户治理与全局策略', scope: '企业全域', limit: '按职责与操作审计' },
    { id: 'tenant', name: '租户管理员', desc: '成员、项目、资产、预算与租户内统计', scope: '当前租户', limit: '按职责与操作审计' },
    { id: 'auditor', name: '企业审计 / 经营管理', desc: '授权范围汇总分析、审计与导出', scope: '授权租户范围', limit: '仅授权范围汇总 / 审计' },
    { id: 'employee', name: '普通员工', desc: '独立 AI 制作、剧本与成片审核、作品交付', scope: '本人及获授权项目', limit: '本人及获授权项目' }
  ],

  /* 成员样例：租户 members 字段为聚合值，此处为典型样本 */
  users: [
    { id: 'u01', name: '林知远', email: 'lin.zy@framework.local', role: 'enterprise', tenant: 'tn-north', status: '正常', projects: 4, delivered: 8, cost: 6240, joined: '2025-03-12', lastActive: '刚刚' },
    { id: 'u02', name: '周予安', email: 'zhou.ya@framework.local', role: 'tenant', tenant: 'tn-short', status: '正常', projects: 3, delivered: 6, cost: 4820, joined: '2025-06-08', lastActive: '今天 10:20' },
    { id: 'u03', name: '陈屿', email: 'chen.yu@framework.local', role: 'tenant', tenant: 'tn-lab', status: '正常', projects: 2, delivered: 2, cost: 2150, joined: '2025-08-21', lastActive: '昨天 16:05' },
    { id: 'u04', name: '许一禾', email: 'xu.yh@framework.local', role: 'employee', tenant: 'tn-north', status: '正常', projects: 2, delivered: 3, cost: 1980, joined: '2025-09-02', lastActive: '今天 10:42' },
    { id: 'u05', name: '沈星河', email: 'shen.xh@framework.local', role: 'auditor', tenant: 'tn-north', status: '正常', projects: 0, delivered: 0, cost: 0, joined: '2025-11-15', lastActive: '今天 09:31' },
    { id: 'u06', name: '顾清', email: 'gu.q@framework.local', role: 'employee', tenant: 'tn-short', status: '待邀请', projects: 0, delivered: 0, cost: 0, joined: '—', lastActive: '—' }
  ],

  /* 项目：短剧生产主业务对象，字段与页面口径一致 */
  projects: [
    {
      id: 'SP-26041', title: '雾城来信', genre: '悬疑 / 都市', owner: '许一禾', tenant: 'tn-north', episodes: 12, done: 8,
      status: '制作中', updated: '今天 10:42', stage: '视频生产', cost: 4280, quality: 92, shotCount: 96, coverAssets: 2, scriptVersion: 3,
      duration: 2, budget: 42000, deadline: '2026-12-05', priority: '高',
      brief: '一部以旧城区秘密、家庭关系与层层反转为核心的悬疑都市短剧。围绕主角追查线索的过程推进剧情，强调人物动机与悬念节奏。',
      audience: '泛悬疑受众', visualStyle: '电影感写实', scriptApproved: true, productionStarted: true
    },
    {
      id: 'SP-26038', title: '她的第七码头', genre: '女性 / 逆袭', owner: '林知远', tenant: 'tn-north', episodes: 16, done: 16,
      status: '待成片审核', updated: '今天 09:18', stage: '最终审核', cost: 5860, quality: 96, shotCount: 128, coverAssets: 2, scriptVersion: 4,
      duration: 2, budget: 56000, deadline: '2026-11-21', priority: '紧急',
      brief: '围绕女性成长与人生转折展开的现实题材短剧，突出角色选择、情感张力与阶段性目标。',
      audience: '女性成长向', visualStyle: '电影感写实', scriptApproved: true, productionStarted: true
    },
    {
      id: 'SP-26035', title: '借月三分', genre: '古装 / 爱情', owner: '周予安', tenant: 'tn-short', episodes: 20, done: 20,
      status: '已交付', updated: '昨天 18:20', stage: '已归档', cost: 7240, quality: 95, shotCount: 160, coverAssets: 2, scriptVersion: 3,
      duration: 3, budget: 70000, deadline: '2026-11-20', priority: '普通',
      brief: '以古装背景下的人物关系和情感抉择为主线，结合误会、承诺与身份变化推进故事。',
      audience: '女性成长向', visualStyle: '国风美学', scriptApproved: true, productionStarted: true, finalApproved: true, delivered: true
    },
    {
      id: 'SP-26031', title: '最后一封语音', genre: '悬疑 / 家庭', owner: '陈屿', tenant: 'tn-lab', episodes: 8, done: 3,
      status: '异常待处理', updated: '昨天 16:05', stage: '音频合成', cost: 1920, quality: 84, shotCount: 64, coverAssets: 1, scriptVersion: 2,
      duration: 2, budget: 24000, deadline: '2026-11-28', priority: '高',
      brief: '围绕家庭成员之间未说出口的秘密展开，以声音线索推动人物重新理解彼此。',
      audience: '泛悬疑受众', visualStyle: '高饱和商业短剧', scriptApproved: true, productionStarted: true
    },
    {
      id: 'SP-26028', title: '七日合约', genre: '都市 / 喜剧', owner: '周予安', tenant: 'tn-short', episodes: 10, done: 10,
      status: '已交付', updated: '11月19日', stage: '已归档', cost: 3980, quality: 94, shotCount: 80, coverAssets: 2, scriptVersion: 3,
      duration: 2, budget: 38000, deadline: '2026-11-19', priority: '普通',
      brief: '以都市轻喜剧方式呈现契约关系中的误解、协作与成长。',
      audience: '18–35 岁都市观众', visualStyle: '高饱和商业短剧', scriptApproved: true, productionStarted: true, finalApproved: true, delivered: true
    },
    {
      id: 'SP-26022', title: '逆光而行', genre: '现实 / 成长', owner: '许一禾', tenant: 'tn-north', episodes: 12, done: 5,
      status: '制作中', updated: '11月19日', stage: '视觉规划', cost: 2460, quality: 89, shotCount: 96, coverAssets: 1, scriptVersion: 2,
      duration: 2, budget: 30000, deadline: '2026-12-20', priority: '普通',
      brief: '以现实成长为主题，关注主角面对压力、选择方向并逐步建立自我认同的过程。',
      audience: '18–35 岁都市观众', visualStyle: '电影感写实', scriptApproved: true, productionStarted: true
    }
  ],

  /* 生产阶段：模板字典，页面按当前项目派生状态与数量 */
  stages: [
    { name: '创意策划', key: 'concept', desc: '题材、故事方向、世界观' },
    { name: '剧本创作', key: 'script', desc: '大纲、分集与对白' },
    { name: '剧本审核', key: 'script-review', desc: '人工确认正式版本' },
    { name: '导演分镜', key: 'storyboard', desc: '场次拆解与镜头单元' },
    { name: '视觉设计', key: 'visual', desc: '人物、场景与道具资产' },
    { name: '视频生产', key: 'video', desc: '镜头生成与一致性检测' },
    { name: '音频后期', key: 'audio', desc: '配音、配乐、字幕与合成' },
    { name: '质检交付', key: 'delivery', desc: '整剧质检、人工终审' }
  ],

  /* 拍摄排期：按项目与集次窗口排定生产环节，页面只读展示 */
  schedule: [
    { id: 'SC-1121', project: 'SP-26041', tenant: 'tn-north', episodes: '第 09–10 集', stage: '视频生产', window: '11-22 → 11-23', units: 16, owner: 'AI 导演 / 镜头组', status: '执行中' },
    { id: 'SC-1122', project: 'SP-26041', tenant: 'tn-north', episodes: '第 11–12 集', stage: '视频生产', window: '11-24 → 11-26', units: 16, owner: 'AI 导演 / 镜头组', status: '待开工' },
    { id: 'SC-1118', project: 'SP-26038', tenant: 'tn-north', episodes: '第 13–16 集', stage: '整集质检', window: '11-19 → 11-21', units: 32, owner: 'AI 质检 / 人工终审', status: '已完成' },
    { id: 'SC-1109', project: 'SP-26022', tenant: 'tn-north', episodes: '第 05–08 集', stage: '视觉规划', window: '11-23 → 11-27', units: 32, owner: 'AI 视觉组', status: '待排期' },
    { id: 'SC-1102', project: 'SP-26031', tenant: 'tn-lab', episodes: '第 03–04 集', stage: '音频合成', window: '11-20 → 11-22', units: 16, owner: 'AI 音频组', status: '已暂停' }
  ],

  /* 后期制作：配音、字幕、剪辑、调色、混音与成片合成环节 */
  postJobs: [
    { project: 'SP-26038', tenant: 'tn-north', item: '角色配音', status: '已完成', owner: 'AI 音频', updated: '11-21 08:40' },
    { project: 'SP-26038', tenant: 'tn-north', item: '字幕与时间轴', status: '已完成', owner: 'AI 字幕', updated: '11-21 07:15' },
    { project: 'SP-26038', tenant: 'tn-north', item: '剪辑与节奏', status: '已完成', owner: 'AI 剪辑', updated: '11-20 22:30' },
    { project: 'SP-26038', tenant: 'tn-north', item: '调色与画质', status: '已完成', owner: 'AI 调色', updated: '11-20 20:10' },
    { project: 'SP-26038', tenant: 'tn-north', item: '混音与配乐', status: '已完成', owner: 'AI 音频', updated: '11-20 19:05' },
    { project: 'SP-26038', tenant: 'tn-north', item: '整集合成', status: '待终审', owner: 'AI 合成', updated: '11-21 09:02' },
    { project: 'SP-26041', tenant: 'tn-north', item: '角色配音', status: '执行中', owner: 'AI 音频', updated: '11-21 10:20' },
    { project: 'SP-26041', tenant: 'tn-north', item: '字幕与时间轴', status: '待开工', owner: 'AI 字幕', updated: '11-21 09:50' },
    { project: 'SP-26041', tenant: 'tn-north', item: '混音与配乐', status: '待开工', owner: 'AI 音频', updated: '11-21 09:50' },
    { project: 'SP-26031', tenant: 'tn-lab', item: '混音与配乐', status: '异常暂停', owner: 'AI 音频', updated: '11-20 16:05' }
  ],

  /* 发布渠道与上线排期 */
  channels: [
    { id: 'ch-douyin', name: '抖音短剧', account: 'framework.north', status: '已授权', scope: '全量短剧', expires: '2026-12-31' },
    { id: 'ch-kuaishou', name: '快手星芒', account: 'framework.drama', status: '已授权', scope: '恋爱 / 都市', expires: '2027-03-31' },
    { id: 'ch-wechat', name: '微信视频号', account: 'framework.video', status: '待授权', scope: '未授权', expires: '—' }
  ],

  releases: [
    { project: 'SP-26035', tenant: 'tn-short', channel: 'ch-douyin', slot: '11-20 20:00', status: '已上线', note: '首播 20 集全量', operator: '周予安', updated: '11-20 20:00' },
    { project: 'SP-26035', tenant: 'tn-short', channel: 'ch-kuaishou', slot: '11-24 20:00', status: '已排期', note: '等待投放确认', operator: '周予安', updated: '11-21 09:10' },
    { project: 'SP-26028', tenant: 'tn-short', channel: 'ch-wechat', slot: '11-19 18:00', status: '已上线', note: '首播 10 集全量', operator: '周予安', updated: '11-19 18:00' }
  ],

  /* 剧本版本快照：版本只追加不覆盖，审核记录绑定版本 */
  scriptVersions: [
    { id: 'SV-26041-3', project: 'SP-26041', tenant: 'tn-north', version: 3, status: '待审核', author: 'AI 编剧', createdAt: '11-21 09:52', words: 18420, note: '补强第 7–8 集反转铺垫与人物动机' },
    { id: 'SV-26041-2', project: 'SP-26041', tenant: 'tn-north', version: 2, status: '已归档', author: 'AI 编剧', createdAt: '11-18 14:20', words: 17980, note: '调整第 3 集节奏，压缩支线对白' },
    { id: 'SV-26041-1', project: 'SP-26041', tenant: 'tn-north', version: 1, status: '已归档', author: 'AI 编剧', createdAt: '11-15 11:05', words: 16890, note: '初版全 12 集剧本与分集大纲' },
    { id: 'SV-26038-4', project: 'SP-26038', tenant: 'tn-north', version: 4, status: '已通过', author: 'AI 编剧', createdAt: '11-12 16:40', words: 24100, note: '终版，补全人物弧光与集尾钩子' },
    { id: 'SV-26031-2', project: 'SP-26031', tenant: 'tn-lab', version: 2, status: '已通过', author: 'AI 编剧', createdAt: '11-14 10:30', words: 11620, note: '强化声音线索与家庭关系反转' }
  ],

  /* 交付包：归档时冻结版本，记录文件清单 */
  deliveries: [
    { id: 'DL-26035', project: 'SP-26035', tenant: 'tn-short', createdAt: '11-20 18:20', operator: '周予安', episodes: 20, files: 64, size: '18.6 GB', status: '已归档', manifest: '借月三分_交付清单_V1.csv' },
    { id: 'DL-26028', project: 'SP-26028', tenant: 'tn-short', createdAt: '11-19 17:40', operator: '周予安', episodes: 10, files: 32, size: '9.2 GB', status: '已归档', manifest: '七日合约_交付清单_V1.csv' }
  ],


  assets: [
    { id: 'AS-1042', name: '林晚 · 标准造型', type: '人物设定', project: 'SP-26041', version: 'V4', owner: '许一禾', date: '11-21', tenant: 'tn-north' },
    { id: 'AS-1038', name: '旧城区雨夜', type: '场景设定', project: 'SP-26041', version: 'V2', owner: '许一禾', date: '11-20', tenant: 'tn-north' },
    { id: 'AS-1021', name: '借月三分 · 正式成片', type: '成片', project: 'SP-26035', version: 'V1', owner: '周予安', date: '11-20', tenant: 'tn-short' },
    { id: 'AS-1014', name: '第 03 集分镜板', type: '分镜', project: 'SP-26038', version: 'V5', owner: '林知远', date: '11-19', tenant: 'tn-north' },
    { id: 'AS-0992', name: '主题旋律 · 主版本', type: '音频', project: 'SP-26028', version: 'V3', owner: '周予安', date: '11-18', tenant: 'tn-short' }
  ],

  /* 审计事件：时间、主体、行为、对象、结果五要素完整 */
  audits: [
    { time: '11-21 10:38:12', actor: '林知远', action: '授予跨租户汇总查看', target: '精品短剧事业部', result: '成功', type: '授权' },
    { time: '11-21 10:12:44', actor: '许一禾', action: '提交剧本审核', target: '雾城来信 / V3', result: '成功', type: '项目' },
    { time: '11-21 09:45:03', actor: 'AI 调度器', action: '视频任务自动重试', target: 'SP-26041 / SH-067', result: '成功', type: '生产' },
    { time: '11-20 18:22:51', actor: '周予安', action: '完成作品交付', target: '借月三分 / 全 20 集', result: '成功', type: '交付' },
    { time: '11-20 16:08:31', actor: '陈屿', action: '触发异常暂停', target: '最后一封语音 / 音频合成', result: '待处置', type: '生产' }
  ],

  /* 演示身份：权限身份与业务视角解耦，切换只影响菜单、路由与按钮显隐 */
  identities: [
    { id: 'id-enterprise', label: '林知远 · 企业级管理员', user: '林知远', role: 'enterprise', tenants: ['tn-north', 'tn-short', 'tn-lab'] },
    { id: 'id-tenant', label: '周予安 · 租户管理员', user: '周予安', role: 'tenant', tenants: ['tn-short'] },
    { id: 'id-employee', label: '许一禾 · 普通员工', user: '许一禾', role: 'employee', tenants: ['tn-north'] },
    { id: 'id-auditor', label: '沈星河 · 企业审计', user: '沈星河', role: 'auditor', tenants: ['tn-north', 'tn-short'] },
    { id: 'id-platform', label: '系统运维 · 平台运维管理员', user: '系统运维', role: 'platform', tenants: [] }
  ],

  /* 权限码：键为角色码，值为可访问的业务域或受限路由权限码 */
  permissions: {
    platform: ['platform', 'audit'],
    enterprise: ['overview', 'governance', 'people', 'workspace', 'studio', 'pipeline', 'assets', 'delivery', 'analytics', 'platform', 'audit'],
    tenant: ['overview', 'people', 'workspace', 'studio', 'pipeline', 'assets', 'delivery', 'analytics', 'audit'],
    auditor: ['overview', 'analytics', 'audit', 'workspace', 'delivery'],
    employee: ['overview', 'workspace', 'studio', 'pipeline', 'assets', 'delivery']
  },

  roleNames: {
    platform: '平台运维管理员',
    enterprise: '企业级管理员',
    tenant: '租户管理员',
    auditor: '企业审计 / 经营管理',
    employee: '普通员工'
  },

  crossAuthorizations: [
    { id: 'XA-021', actor: '沈星河', tenantIds: ['tn-north', 'tn-short'], permission: '汇总查看 / 审计', purpose: '企业经营分析', expires: '2026-12-31', status: '有效' },
    { id: 'XA-018', actor: '林知远', tenantIds: ['tn-lab'], permission: '项目只读', purpose: '季度质量复盘', expires: '2026-11-30', status: '有效' }
  ],

  /* 平台治理：能力类型、模型与备用策略 */
  models: [
    { type: '文本 / 剧本', primary: 'Text Studio Pro', backup: 'Text Studio Lite', status: '可用', tone: 'green', rule: '租户白名单' },
    { type: '图像 / 视觉', primary: 'Vision Render X', backup: 'Vision Render S', status: '可用', tone: 'green', rule: '人物一致性优先' },
    { type: '视频生成', primary: 'Motion Forge 2', backup: 'Motion Forge 1', status: '繁忙', tone: 'orange', rule: '并发配额控制' },
    { type: '语音合成', primary: 'Voice Studio', backup: 'Voice Studio Backup', status: '可用', tone: 'green', rule: '音色授权校验' },
    { type: '音频后期', primary: 'Audio Master', backup: 'Audio Lite', status: '可用', tone: 'green', rule: '成本阈值控制' }
  ],

  runtime: {
    health: '99.98%',
    queue: '08',
    backup: '02:00',
    callsToday: '3,482',
    components: [
      { name: 'API 网关', status: '运行正常', tone: 'green' },
      { name: '任务调度器', status: '运行正常', tone: 'green' },
      { name: '对象存储', status: '运行正常', tone: 'green' },
      { name: '模型路由', status: '部分繁忙', tone: 'orange' }
    ]
  },

  /* 经营分析：仅保留无法从项目记录派生的展示型指标 */
  analytics: {
    weeklyDeliveries: [25, 38, 43, 55, 61, 72, 88],
    weeklyLabels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
    employeeTotal: 37,
    auditEventsThisMonth: '1,284',
    highRiskEvents: 0
  },

  /* 页面内存态：仅身份、租户、项目上下文，刷新即重置 */
  state: {
    identity: 'enterprise',
    tenant: 'tn-north',
    projectId: 'SP-26041'
  }
};
