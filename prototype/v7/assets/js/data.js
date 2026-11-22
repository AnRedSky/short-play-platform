/* 数据层：只读业务字典、演示身份、角色与枚举。禁止在渲染阶段改写数据。 */
window.DB = {
  meta: {
    product: 'FRAMEWORK',
    edition: 'AI PRODUCTION OS / 07',
    version: 'V7.5',
    benchmark: '完整项目业务方案 V1.0'
  },

  /* 唯一企业主体：部署级最高业务边界，租户是其内部组织单元 */
  enterprise: {
    name: '星幕内容科技有限公司',
    code: 'ENT-FRAMEWORK',
    intro: '面向内部事业部与制作中心提供 AI 短剧生产能力的单一企业主体，采用私有化部署与多租户隔离运营。',
    status: '正常运营',
    admin: '林知远',
    adminEmail: 'lin.zy@framework.local',
    members: 37,
    tenantCount: 4,
    projectCount: 6,
    budget: 300000,
    used: 107300,
    updated: '2026-11-21',
    policies: {
      projectBudget: 60000,
      employeeQuota: 20000,
      concurrency: 12,
      retryLimit: 3,
      alertThreshold: 80,
      retention: '项目数据 36 个月 / 审计记录 5 年',
      modelScope: '企业白名单 + 租户申请',
      compliance: '第三方素材、肖像、声音克隆、音乐字体均需登记授权'
    }
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
    { id: 'tn-north', name: '北方制作中心', code: 'NORTH-01', unit: '北方事业部 / 制作中心', admin: '林知远', owner: '林知远', members: 18, projects: 12, budget: 85000, used: 52600, status: '运行中', modelPolicy: '继承企业白名单', retention: '项目数据 36 个月', quotaConcurrency: 5, quotaStorage: 600, createdAt: '2025-03-12', updated: '2026-11-20' },
    { id: 'tn-short', name: '精品短剧事业部', code: 'DRAMA-02', unit: '内容事业部 / 精品短剧组', admin: '周予安', owner: '周予安', members: 12, projects: 9, budget: 62000, used: 41800, status: '运行中', modelPolicy: '恋爱 / 都市优先', retention: '项目数据 36 个月', quotaConcurrency: 4, quotaStorage: 480, createdAt: '2025-06-08', updated: '2026-11-18' },
    { id: 'tn-lab', name: 'AI 创新实验室', code: 'LAB-03', unit: '技术中心 / 创新实验室', admin: '陈屿', owner: '陈屿', members: 7, projects: 5, budget: 40000, used: 12900, status: '运行中', modelPolicy: '实验能力白名单', retention: '项目数据 24 个月', quotaConcurrency: 3, quotaStorage: 320, createdAt: '2025-08-21', updated: '2026-11-15' },
    { id: 'tn-archive', name: '历史项目组', code: 'ARCH-04', unit: '企业归档 / 历史项目', admin: '系统归档', owner: '系统归档', members: 0, projects: 4, budget: 0, used: 0, status: '已归档', modelPolicy: '只读', retention: '永久保留', quotaConcurrency: 0, quotaStorage: 120, createdAt: '2024-11-01', updated: '2026-11-01' }
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
    { id: 'u01', name: '林知远', email: 'lin.zy@framework.local', role: 'enterprise', tenant: 'tn-north', tenants: [{ tenant: 'tn-north', role: 'enterprise' }, { tenant: 'tn-short', role: 'auditor' }], status: '正常', projects: 4, delivered: 8, episodes: 52, completed: 3, cost: 6240, joined: '2025-03-12', lastActive: '刚刚', access: '全租户汇总 / 指定项目', projectAccess: ['SP-26041','SP-26038','SP-26035','SP-26031','SP-26028','SP-26022'] },
    { id: 'u02', name: '周予安', email: 'zhou.ya@framework.local', role: 'tenant', tenant: 'tn-short', tenants: [{ tenant: 'tn-short', role: 'tenant' }], status: '正常', projects: 3, delivered: 6, episodes: 30, completed: 2, cost: 4820, joined: '2025-06-08', lastActive: '今天 10:20', access: '租户内全部项目', projectAccess: ['SP-26035','SP-26028'] },
    { id: 'u03', name: '陈屿', email: 'chen.yu@framework.local', role: 'tenant', tenant: 'tn-lab', tenants: [{ tenant: 'tn-lab', role: 'tenant' }], status: '正常', projects: 2, delivered: 2, episodes: 16, completed: 1, cost: 2150, joined: '2025-08-21', lastActive: '昨天 16:05', access: '租户内全部项目', projectAccess: ['SP-26031'] },
    { id: 'u04', name: '许一禾', email: 'xu.yh@framework.local', role: 'employee', tenant: 'tn-north', tenants: [{ tenant: 'tn-north', role: 'employee' }, { tenant: 'tn-short', role: 'employee' }], status: '正常', projects: 2, delivered: 3, episodes: 24, completed: 1, cost: 1980, joined: '2025-09-02', lastActive: '今天 10:42', access: '本人项目 + 授权项目', projectAccess: ['SP-26041','SP-26022'] },
    { id: 'u05', name: '沈星河', email: 'shen.xh@framework.local', role: 'auditor', tenant: 'tn-north', tenants: [{ tenant: 'tn-north', role: 'auditor' }, { tenant: 'tn-short', role: 'auditor' }], status: '正常', projects: 0, delivered: 0, episodes: 0, completed: 0, cost: 0, joined: '2025-11-15', lastActive: '今天 09:31', access: '授权租户汇总只读', projectAccess: ['SP-26038','SP-26035'] },
    { id: 'u06', name: '顾清', email: 'gu.q@framework.local', role: 'employee', tenant: 'tn-short', tenants: [{ tenant: 'tn-short', role: 'employee' }], status: '待邀请', projects: 0, delivered: 0, episodes: 0, completed: 0, cost: 0, joined: '—', lastActive: '—', access: '待邀请确认', projectAccess: [] }
  ],

  /* 项目：短剧生产主业务对象，字段与页面口径一致 */
  projects: [
    {
      id: 'SP-26041', title: '雾城来信', genre: '悬疑 / 都市', projectType: '自制短剧', owner: '许一禾', tenant: 'tn-north', episodes: 12, done: 8,
      status: '生产中', updated: '今天 10:42', stage: '视频生产', cost: 4280, quality: 92, qualityState: '部分待复检', deliveredEpisodes: 0, createdAt: '2026-10-18', shotCount: 96, coverAssets: 2, scriptVersion: 3,
      duration: 2, budget: 42000, deadline: '2026-12-05', priority: '高',
      brief: '一部以旧城区秘密、家庭关系与层层反转为核心的悬疑都市短剧。围绕主角追查线索的过程推进剧情，强调人物动机与悬念节奏。',
      audience: '泛悬疑受众', visualStyle: '电影感写实', scriptApproved: true, productionStarted: true
    },
    {
      id: 'SP-26038', title: '她的第七码头', genre: '女性 / 逆袭', projectType: '自制短剧', owner: '林知远', tenant: 'tn-north', episodes: 16, done: 16,
      status: '待最终审核', updated: '今天 09:18', stage: '最终审核', cost: 5860, quality: 96, qualityState: '已通过', deliveredEpisodes: 0, createdAt: '2026-09-26', shotCount: 128, coverAssets: 2, scriptVersion: 4,
      duration: 2, budget: 56000, deadline: '2026-11-21', priority: '紧急',
      brief: '围绕女性成长与人生转折展开的现实题材短剧，突出角色选择、情感张力与阶段性目标。',
      audience: '女性成长向', visualStyle: '电影感写实', scriptApproved: true, productionStarted: true
    },
    {
      id: 'SP-26035', title: '借月三分', genre: '古装 / 爱情', projectType: '承制短剧', owner: '周予安', tenant: 'tn-short', episodes: 20, done: 20,
      status: '已完成', updated: '昨天 18:20', stage: '已归档', cost: 7240, quality: 95, qualityState: '已通过', deliveredEpisodes: 20, createdAt: '2026-08-20', shotCount: 160, coverAssets: 2, scriptVersion: 3,
      duration: 3, budget: 70000, deadline: '2026-11-20', priority: '普通',
      brief: '以古装背景下的人物关系和情感抉择为主线，结合误会、承诺与身份变化推进故事。',
      audience: '女性成长向', visualStyle: '国风美学', scriptApproved: true, productionStarted: true, finalApproved: true, delivered: true
    },
    {
      id: 'SP-26031', title: '最后一封语音', genre: '悬疑 / 家庭', projectType: '自制短剧', owner: '陈屿', tenant: 'tn-lab', episodes: 8, done: 3,
      status: '异常中', updated: '昨天 16:05', stage: '音频合成', cost: 1920, quality: 84, qualityState: '待返工', deliveredEpisodes: 0, createdAt: '2026-10-30', shotCount: 64, coverAssets: 1, scriptVersion: 2,
      duration: 2, budget: 24000, deadline: '2026-11-28', priority: '高',
      brief: '围绕家庭成员之间未说出口的秘密展开，以声音线索推动人物重新理解彼此。',
      audience: '泛悬疑受众', visualStyle: '高饱和商业短剧', scriptApproved: true, productionStarted: true
    },
    {
      id: 'SP-26028', title: '七日合约', genre: '都市 / 喜剧', projectType: '自制短剧', owner: '周予安', tenant: 'tn-short', episodes: 10, done: 10,
      status: '已完成', updated: '11月19日', stage: '已归档', cost: 3980, quality: 94, qualityState: '已通过', deliveredEpisodes: 10, createdAt: '2026-09-12', shotCount: 80, coverAssets: 2, scriptVersion: 3,
      duration: 2, budget: 38000, deadline: '2026-11-19', priority: '普通',
      brief: '以都市轻喜剧方式呈现契约关系中的误解、协作与成长。',
      audience: '18–35 岁都市观众', visualStyle: '高饱和商业短剧', scriptApproved: true, productionStarted: true, finalApproved: true, delivered: true
    },
    {
      id: 'SP-26022', title: '逆光而行', genre: '现实 / 成长', projectType: '合作出品', owner: '许一禾', tenant: 'tn-north', episodes: 12, done: 5,
      status: '生产准备中', updated: '11月19日', stage: '视觉规划', cost: 2460, quality: 89, qualityState: '待检测', deliveredEpisodes: 0, createdAt: '2026-11-02', shotCount: 96, coverAssets: 1, scriptVersion: 2,
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

  /* 生产任务：AI 自动调度的最小执行单元，记录依赖、模型、重试、失败原因与实际成本 */
  productionTasks: [
    { id: 'PT-4121', project: 'SP-26041', tenant: 'tn-north', stage: '视频生成', episode: 9, scene: '旧城码头 · 夜', shot: 'SH-067', capability: '视频生成', status: '失败待重试', model: 'Motion Forge 2', backup: 'Motion Forge 1', attempt: 2, maxAttempts: 3, cost: 46, failedCost: 18, failure: '人物口型偏移，未达质量阈值', dependsOn: ['PT-4108'], input: '镜头单元 SH-067 / 角色参考图', output: '候选视频 v2', startedAt: '11-21 09:32', finishedAt: '11-21 09:45', quality: 72 },
    { id: 'PT-4122', project: 'SP-26041', tenant: 'tn-north', stage: '音频生成', episode: 9, scene: '旧城码头 · 夜', shot: 'SH-067', capability: '语音生成', status: '执行中', model: 'Voice Studio', backup: 'Voice Studio Backup', attempt: 1, maxAttempts: 3, cost: 12, failedCost: 0, failure: '', dependsOn: ['PT-4121'], input: '对白清单 / 角色声音档案', output: '角色对白 WAV', startedAt: '11-21 10:20', finishedAt: '', quality: 0 },
    { id: 'PT-4123', project: 'SP-26041', tenant: 'tn-north', stage: '导演分镜', episode: 10, scene: '码头仓库 · 日', shot: 'SH-074', capability: '视觉审核', status: '已完成', model: 'Vision Audit Pro', backup: 'Vision Audit S', attempt: 1, maxAttempts: 3, cost: 6, failedCost: 0, failure: '', dependsOn: ['PT-4102'], input: '正式剧本 V3 / 分镜提示词', output: '分镜图与镜头连续性报告', startedAt: '11-21 08:10', finishedAt: '11-21 08:26', quality: 94 },
    { id: 'PT-4124', project: 'SP-26041', tenant: 'tn-north', stage: '质量检测', episode: 10, scene: '整集', shot: '—', capability: '视觉审核', status: '待执行', model: 'Vision Audit Pro', backup: 'Vision Audit S', attempt: 0, maxAttempts: 3, cost: 0, failedCost: 0, failure: '', dependsOn: ['PT-4121', 'PT-4122'], input: '第 10 集合成候选', output: '十维质检报告', startedAt: '', finishedAt: '', quality: 0 },
    { id: 'PT-3811', project: 'SP-26038', tenant: 'tn-north', stage: '质量检测', episode: 16, scene: '码头 · 黄昏', shot: 'SH-121', capability: '视觉审核', status: '已完成', model: 'Vision Audit Pro', backup: 'Vision Audit S', attempt: 1, maxAttempts: 3, cost: 8, failedCost: 0, failure: '', dependsOn: ['PT-3804'], input: '第 16 集成片', output: '质量报告 QC-26038', startedAt: '11-21 08:50', finishedAt: '11-21 09:08', quality: 96 },
    { id: 'PT-3812', project: 'SP-26038', tenant: 'tn-north', stage: '后期合成', episode: 16, scene: '整集', shot: '—', capability: '视频处理', status: '已完成', model: 'Post Master', backup: 'Post Lite', attempt: 1, maxAttempts: 3, cost: 14, failedCost: 0, failure: '', dependsOn: ['PT-3811'], input: '镜头与音频时间轴', output: '第 16 集成片', startedAt: '11-21 08:20', finishedAt: '11-21 08:46', quality: 96 },
    { id: 'PT-3101', project: 'SP-26031', tenant: 'tn-lab', stage: '音频生成', episode: 4, scene: '客厅 · 夜', shot: 'SH-029', capability: '音乐生成', status: '异常暂停', model: 'Music Forge', backup: '—', attempt: 3, maxAttempts: 3, cost: 22, failedCost: 15, failure: '重试达到上限，备用模型不可用', dependsOn: ['PT-3098'], input: '第 4 集情绪曲线 / 环境音需求', output: '配乐候选 v3', startedAt: '11-20 15:40', finishedAt: '11-20 16:05', quality: 61 },
    { id: 'PT-2201', project: 'SP-26022', tenant: 'tn-north', stage: '导演分镜', episode: 5, scene: '天台 · 清晨', shot: 'SH-041', capability: '图像生成', status: '待执行', model: 'Vision Render X', backup: 'Vision Render S', attempt: 0, maxAttempts: 3, cost: 0, failedCost: 0, failure: '', dependsOn: [], input: '场景设定 / 人物参考', output: '分镜图', startedAt: '', finishedAt: '', quality: 0 }
  ],

  /* 质量检查：十维独立检查能力，不依赖生成模型自评 */
  qualityChecks: [
    { id: 'QC-26038-01', project: 'SP-26038', tenant: 'tn-north', dimension: '剧本质量', status: '通过', score: 96, issues: 0, note: '故事闭环完整，人物动机成立', target: 'V4 正式剧本', task: '—' },
    { id: 'QC-26038-02', project: 'SP-26038', tenant: 'tn-north', dimension: '内容合规', status: '通过', score: 95, issues: 0, note: '未发现敏感内容，版权登记齐全', target: '全 16 集', task: '—' },
    { id: 'QC-26038-03', project: 'SP-26038', tenant: 'tn-north', dimension: '人物一致性', status: '通过', score: 97, issues: 0, note: '主角跨集外貌与服装一致', target: 'SH-001–128', task: 'PT-3811' },
    { id: 'QC-26038-04', project: 'SP-26038', tenant: 'tn-north', dimension: '场景一致性', status: '通过', score: 96, issues: 0, note: '码头场景光线与道具连续', target: '场景 01–12', task: 'PT-3811' },
    { id: 'QC-26038-05', project: 'SP-26038', tenant: 'tn-north', dimension: '视频质量', status: '通过', score: 95, issues: 0, note: '清晰度、闪烁与画面异常均达标', target: '全 16 集', task: 'PT-3811' },
    { id: 'QC-26038-06', project: 'SP-26038', tenant: 'tn-north', dimension: '表演质量', status: '通过', score: 94, issues: 0, note: '动作与口型同步通过抽检', target: 'SH-021–128', task: 'PT-3811' },
    { id: 'QC-26038-07', project: 'SP-26038', tenant: 'tn-north', dimension: '音频质量', status: '通过', score: 95, issues: 0, note: '音量平衡、无噪声、对白清晰', target: '全 16 集', task: 'PT-3812' },
    { id: 'QC-26038-08', project: 'SP-26038', tenant: 'tn-north', dimension: '字幕质量', status: '通过', score: 96, issues: 0, note: '字幕内容与时间轴抽检一致', target: '全 16 集', task: 'PT-3812' },
    { id: 'QC-26038-09', project: 'SP-26038', tenant: 'tn-north', dimension: '剪辑质量', status: '通过', score: 96, issues: 0, note: '镜头衔接与节奏无明显重复', target: '全 16 集', task: 'PT-3812' },
    { id: 'QC-26038-10', project: 'SP-26038', tenant: 'tn-north', dimension: '成片质量', status: '通过', score: 96, issues: 0, note: '集数完整、播放与交付格式正常', target: 'DL 候选包', task: 'PT-3812' },
    { id: 'QC-26041-01', project: 'SP-26041', tenant: 'tn-north', dimension: '剧本质量', status: '通过', score: 92, issues: 0, note: 'V3 反转铺垫已补强', target: 'V3 剧本', task: '—' },
    { id: 'QC-26041-02', project: 'SP-26041', tenant: 'tn-north', dimension: '内容合规', status: '通过', score: 90, issues: 0, note: '风险提示已人工确认', target: 'V3 剧本', task: '—' },
    { id: 'QC-26041-03', project: 'SP-26041', tenant: 'tn-north', dimension: '人物一致性', status: '警告', score: 84, issues: 2, note: '第 9 集雨夜造型与标准造型偏差', target: 'SH-067 / 第 9 集', task: 'PT-4121' },
    { id: 'QC-26041-04', project: 'SP-26041', tenant: 'tn-north', dimension: '场景一致性', status: '通过', score: 93, issues: 0, note: '旧城区雨夜场景参考已锁定', target: '场景 03–08', task: 'PT-4123' },
    { id: 'QC-26041-05', project: 'SP-26041', tenant: 'tn-north', dimension: '视频质量', status: '不合格', score: 72, issues: 4, note: '口型偏移与局部闪烁', target: 'SH-067', task: 'PT-4121' },
    { id: 'QC-26041-06', project: 'SP-26041', tenant: 'tn-north', dimension: '表演质量', status: '警告', score: 79, issues: 2, note: '人物表情与对白情绪不完全匹配', target: 'SH-067', task: 'PT-4121' },
    { id: 'QC-26041-07', project: 'SP-26041', tenant: 'tn-north', dimension: '音频质量', status: '待检测', score: 0, issues: 0, note: '等待第 9 集对白生成完成', target: '第 9 集', task: 'PT-4122' },
    { id: 'QC-26041-08', project: 'SP-26041', tenant: 'tn-north', dimension: '字幕质量', status: '待检测', score: 0, issues: 0, note: '等待音频时间轴', target: '第 9 集', task: 'PT-4122' },
    { id: 'QC-26041-09', project: 'SP-26041', tenant: 'tn-north', dimension: '剪辑质量', status: '待检测', score: 0, issues: 0, note: '尚未进入整集剪辑', target: '第 9–12 集', task: 'PT-4124' },
    { id: 'QC-26041-10', project: 'SP-26041', tenant: 'tn-north', dimension: '成片质量', status: '待检测', score: 0, issues: 0, note: '尚未完成整集成片', target: '第 9–12 集', task: 'PT-4124' }
  ],

  /* 审核记录：审核对象、版本、人员、结果、意见与后续处理全部结构化留痕 */
  reviews: [
    { id: 'RV-26038-4', project: 'SP-26038', tenant: 'tn-north', type: '剧本审核', subject: '她的第七码头', version: 'V4', reviewer: '林知远', time: '11-12 16:52', result: '通过', note: '人物弧光与集尾钩子完整，锁定为正式生产基准', tasks: '—', followup: '进入导演分镜与视觉规划' },
    { id: 'RV-26035-F', project: 'SP-26035', tenant: 'tn-short', type: '成片审核', subject: '借月三分', version: 'V1 成片', reviewer: '周予安', time: '11-20 18:10', result: '通过', note: '全 20 集剧情、画面、音频与字幕确认', tasks: 'PT-3512', followup: '生成交付包并归档' },
    { id: 'RV-26028-F', project: 'SP-26028', tenant: 'tn-short', type: '成片审核', subject: '七日合约', version: 'V1 成片', reviewer: '周予安', time: '11-19 17:20', result: '通过', note: '都市轻喜剧节奏与字幕确认', tasks: 'PT-2810', followup: '交付归档' },
    { id: 'RV-26031-2', project: 'SP-26031', tenant: 'tn-lab', type: '剧本审核', subject: '最后一封语音', version: 'V2', reviewer: '陈屿', time: '11-14 10:42', result: '通过', note: '声音线索与家庭关系反转成立', tasks: '—', followup: '进入生产' },
    { id: 'RV-26041-2', project: 'SP-26041', tenant: 'tn-north', type: '剧本审核', subject: '雾城来信', version: 'V2', reviewer: '许一禾', time: '11-18 15:05', result: '退回修改', note: '第 3 集节奏偏慢，反派动机不足', tasks: '—', followup: '生成 V3 修订版本' },
    { id: 'RV-26041-3', project: 'SP-26041', tenant: 'tn-north', type: '剧本审核', subject: '雾城来信', version: 'V3', reviewer: '许一禾', time: '11-21 09:52', result: '待审核', note: '补强第 7–8 集反转铺垫，等待人工确认', tasks: '—', followup: '待人工决策' }
  ],

  /* 剧本修改影响分析：仅重生产受影响对象 */
  impactAnalyses: [
    { id: 'IA-26041-3', project: 'SP-26041', tenant: 'tn-north', version: 'V3', baseVersion: 'V2', createdAt: '11-21 09:55', episodes: '第 7–8 集', scenes: 4, characters: 2, dialogues: 12, shots: 18, audio: 6, timeline: 2, tasks: ['PT-4121', 'PT-4122'], status: '待确认', note: '补强反转铺垫，涉及第 7–8 集人物动机与对白，需重生成 18 个镜头并重做 6 段音频。' }
  ],

  /* 项目负责人移交记录：项目归属企业不变，历史生产记录保留 */
  projectHandovers: [
    { id: 'HO-26038-1', project: 'SP-26038', tenant: 'tn-north', from: '陈屿', to: '林知远', reason: '组织调整，转入北方制作中心继续制作', operator: '林知远', time: '10-28 14:20', kept: '剧本版本、128 个镜头、质量记录与成本' }
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
    { id: 'AS-1042', name: '林晚 · 标准造型', type: '人物设定', project: 'SP-26041', version: 'V4', owner: '许一禾', date: '11-21', tenant: 'tn-north', origin: 'AI 生成', license: '企业自有', commercial: '可商用', expires: '—' },
    { id: 'AS-1038', name: '旧城区雨夜', type: '场景设定', project: 'SP-26041', version: 'V2', owner: '许一禾', date: '11-20', tenant: 'tn-north', origin: 'AI 生成 + 实拍参考', license: '企业自有', commercial: '可商用', expires: '—' },
    { id: 'AS-1021', name: '借月三分 · 正式成片', type: '成片', project: 'SP-26035', version: 'V1', owner: '周予安', date: '11-20', tenant: 'tn-short', origin: 'AI 合成', license: '企业自有', commercial: '全渠道商用', expires: '—' },
    { id: 'AS-1014', name: '第 03 集分镜板', type: '分镜', project: 'SP-26038', version: 'V5', owner: '林知远', date: '11-19', tenant: 'tn-north', origin: 'AI 生成', license: '企业自有', commercial: '可商用', expires: '—' },
    { id: 'AS-0992', name: '主题旋律 · 主版本', type: '音频', project: 'SP-26028', version: 'V3', owner: '周予安', date: '11-18', tenant: 'tn-short', origin: 'AI 音乐生成', license: '平台商用条款', commercial: '短剧配乐', expires: '2027-11-18' },
    { id: 'AS-1061', name: '林晚 · 声音档案（授权音色）', type: '人物声音', project: 'SP-26041', version: 'V2', owner: '许一禾', date: '11-21', tenant: 'tn-north', origin: '真人声音克隆', license: '肖像与声音授权书 SVA-021', commercial: '仅限本项目', expires: '2027-05-31' },
    { id: 'AS-1058', name: '旧怀表 · 关键剧情道具', type: '道具服装', project: 'SP-26041', version: 'V1', owner: '许一禾', date: '11-20', tenant: 'tn-north', origin: 'AI 设计 + 实物参考', license: '企业自有', commercial: '可商用', expires: '—' },
    { id: 'AS-1052', name: '第 16 集字幕 SRT', type: '字幕', project: 'SP-26038', version: 'V2', owner: '林知远', date: '11-21', tenant: 'tn-north', origin: 'ASR + 人工校对', license: '企业自有', commercial: '可商用', expires: '—' }
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
    enterprise: ['overview', 'governance', 'people', 'workspace', 'studio', 'pipeline', 'assets', 'delivery', 'analytics', 'analytics-self', 'platform', 'audit'],
    tenant: ['overview', 'people', 'workspace', 'studio', 'pipeline', 'assets', 'delivery', 'analytics', 'analytics-self', 'audit'],
    auditor: ['overview', 'analytics', 'analytics-self', 'audit', 'workspace', 'delivery'],
    employee: ['overview', 'workspace', 'studio', 'pipeline', 'assets', 'delivery', 'analytics-self']
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
    { type: '大语言模型', primary: 'Text Studio Pro', backup: 'Text Studio Lite', status: '可用', tone: 'green', rule: '租户白名单' },
    { type: '推理模型', primary: 'Logic Reasoner R2', backup: 'Logic Reasoner R1', status: '可用', tone: 'green', rule: '剧情连续性检查' },
    { type: '图像生成', primary: 'Vision Render X', backup: 'Vision Render S', status: '可用', tone: 'green', rule: '人物一致性优先' },
    { type: '视频生成', primary: 'Motion Forge 2', backup: 'Motion Forge 1', status: '繁忙', tone: 'orange', rule: '并发配额控制' },
    { type: '数字人口型', primary: 'Avatar LipSync', backup: 'Avatar LipSync Lite', status: '可用', tone: 'green', rule: '参考人物优先' },
    { type: '语音生成', primary: 'Voice Studio', backup: 'Voice Studio Backup', status: '可用', tone: 'green', rule: '音色授权校验' },
    { type: '音乐生成', primary: 'Music Forge', backup: 'Music Forge Lite', status: '可用', tone: 'green', rule: '版权与商用范围' },
    { type: '视频处理', primary: 'Post Master', backup: 'Post Lite', status: '可用', tone: 'green', rule: '成本阈值控制' },
    { type: '语音识别', primary: 'ASR Transcript', backup: 'ASR Lite', status: '可用', tone: 'green', rule: '字幕时间轴校对' },
    { type: '视觉审核', primary: 'Vision Audit Pro', backup: 'Vision Audit S', status: '可用', tone: 'green', rule: '独立质检，不复用生成模型' }
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
    ],
    config: {
      defaultProjectBudget: 60000,
      defaultEpisodes: 12,
      retryLimit: 3,
      alertThreshold: 80,
      maxConcurrency: 12,
      retention: '项目数据 36 个月 / 审计记录 5 年',
      modelWhitelist: '全部十类能力，租户按需申请',
      invitePolicy: '企业管理员邀请，成员需确认后生效',
      reviewPolicy: '剧本审核与成片终审均需人工确认',
      updated: '2026-11-21'
    }
  },

  /* 经营分析：仅保留无法从项目记录派生的展示型指标 */
  analytics: {
    weeklyDeliveries: [25, 38, 43, 55, 61, 72, 88],
    weeklyLabels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
    employeeTotal: 37,
    auditEventsThisMonth: '1,284',
    highRiskEvents: 0,
    snapshotAt: '2026-11-21 00:00',
    videoMinutes: 1268,
    renderedMinutes: 2840,
    aiTaskSuccess: 91.6,
    reworkRate: 8.4,
    audioIssueRate: 3.1,
    scriptPassRate: 78,
    finalPassRate: 86,
    avgProjectDays: 31,
    avgEpisodeDays: 2.6,
    failedCost: 1830
  },

  analyticsSnapshots: [
    { id: 'SN-1121', capturedAt: '2026-11-21 00:00', projects: 6, deliveredWorks: 2, deliveredEpisodes: 30, quality: 94.2, cost: 107300, failedCost: 1830, operator: '系统', note: '11 月经营快照，交付与成本按交付记录冻结' },
    { id: 'SN-1115', capturedAt: '2026-11-15 00:00', projects: 5, deliveredWorks: 1, deliveredEpisodes: 20, quality: 92.8, cost: 98400, failedCost: 1620, operator: '系统', note: '月中快照，未含 SP-26038 终审' },
    { id: 'SN-1031', capturedAt: '2026-10-31 00:00', projects: 5, deliveredWorks: 1, deliveredEpisodes: 20, quality: 91.6, cost: 89060, failedCost: 1410, operator: '林知远', note: '10 月结账快照，用于环比' }
  ],

  compliance: [
    { id: 'CP-021', category: '人物肖像', subject: '林晚 · 角色定妆', project: 'SP-26041', license: '肖像使用授权 SVA-021', scope: '本项目短剧与宣传', expires: '2027-05-31', status: '有效', owner: '许一禾', note: '含 AI 生成参考图与二次修改' },
    { id: 'CP-022', category: '真人声音', subject: '林晚 · 授权音色', project: 'SP-26041', license: '声音克隆授权 SVA-021', scope: '仅限本项目对白', expires: '2027-05-31', status: '有效', owner: '许一禾', note: '禁止跨项目复用与第三方转授' },
    { id: 'CP-023', category: '音乐版权', subject: '主题旋律 · 主版本', project: 'SP-26028', license: '平台商用条款 M-031', scope: '短剧配乐 / 单平台', expires: '2027-11-18', status: '有效', owner: '周予安', note: '不含衍生音乐发行' },
    { id: 'CP-024', category: '字体授权', subject: '标题字库 · 汉仪旗黑', project: 'SP-26038', license: '企业商用字库授权 F-118', scope: '全渠道宣传物料', expires: '2028-03-31', status: '有效', owner: '林知远', note: '覆盖 5 台设计终端' },
    { id: 'CP-025', category: '模型服务', subject: 'Motion Forge 2 商用条款', project: '—', license: '供应商企业版条款', scope: '企业内全部租户', expires: '2027-06-30', status: '有效', owner: '系统运维', note: '生成内容可用于商业短剧' },
    { id: 'CP-026', category: '模型服务', subject: 'Voice Studio 商用条款', project: '—', license: '供应商标准条款', scope: '仅限内部试听', expires: '2027-06-30', status: '待确认', owner: '系统运维', note: '公开商用前需升级企业授权' },
    { id: 'CP-027', category: '生成内容', subject: '全量 AI 生成画面', project: 'SP-26031', license: '平台合规策略', scope: '待人工复核', expires: '—', status: '待复核', owner: '陈屿', note: '第 4 集配乐异常暂停，恢复后重新检测' }
  ],

  /* 页面内存态：仅身份、租户、项目上下文，刷新即重置 */
  state: {
    identity: 'enterprise',
    tenant: 'tn-north',
    projectId: 'SP-26041'
  }
};

