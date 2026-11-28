/**
 * 内部插件目录（演示数据）。
 * 产品章程不做公开插件市场：这里的条目均为平台自研 / 内部团队受控接入，
 * 安装、卸载、配置只影响本机登记状态，不加载第三方代码。
 */
export interface PluginCatalogItem {
  id: string
  name: string
  vendor: string
  category: PluginCategory
  version: string
  summary: string
  permissions: string[]
  installedByDefault: boolean
}

export type PluginCategory = '创作辅助' | '生成能力' | '后期工具' | '数据接入' | '合规与运营'

export const pluginCatalog: PluginCatalogItem[] = [
  {
    id: 'pl-script-polish',
    name: '剧本润色助手',
    vendor: '平台内置',
    category: '创作辅助',
    version: '1.4.2',
    summary: '按平台剧本规范做分场、对白与节奏润色，输出可对比版本。',
    permissions: ['读取剧本版本', '写入剧本草稿'],
    installedByDefault: true,
  },
  {
    id: 'pl-shot-breakdown',
    name: '分镜拆解器',
    vendor: '平台内置',
    category: '创作辅助',
    version: '1.2.0',
    summary: '把一场戏拆成镜头契约，补时长、景别与关键帧提示。',
    permissions: ['读取剧本', '写入镜头计划'],
    installedByDefault: true,
  },
  {
    id: 'pl-voice-clone',
    name: '音色复刻',
    vendor: '音频组',
    category: '生成能力',
    version: '2.1.5',
    summary: '基于已授权音色样本生成配音，需先在资产库登记授权。',
    permissions: ['读取音色资产', '创建音频任务'],
    installedByDefault: false,
  },
  {
    id: 'pl-subtitle-align',
    name: '字幕对齐器',
    vendor: '后期组',
    category: '后期工具',
    version: '0.9.8',
    summary: '按成片时间轴对齐字幕与口型，输出可回滚的字幕版本。',
    permissions: ['读取时间线', '写入字幕版本'],
    installedByDefault: true,
  },
  {
    id: 'pl-batch-export',
    name: '批量交付打包',
    vendor: '平台内置',
    category: '后期工具',
    version: '1.1.0',
    summary: '按交付清单批量打包分集文件并生成校验和。',
    permissions: ['读取交付包', '写入交付记录'],
    installedByDefault: false,
  },
  {
    id: 'pl-cost-guard',
    name: '成本护栏',
    vendor: '经营分析组',
    category: '合规与运营',
    version: '1.6.3',
    summary: '在提交高成本任务前按项目预算占比给出拦截或放行建议。',
    permissions: ['读取成本台账', '拦截任务提交'],
    installedByDefault: true,
  },
  {
    id: 'pl-rights-audit',
    name: '授权审计',
    vendor: '合规组',
    category: '合规与运营',
    version: '1.0.4',
    summary: '巡检资产授权到期与真人授权范围，输出待处理清单。',
    permissions: ['读取资产授权', '写入审计记录'],
    installedByDefault: false,
  },
  {
    id: 'pl-ads-connector',
    name: '投流数据接入',
    vendor: '数据组',
    category: '数据接入',
    version: '0.7.1',
    summary: '接入内部投放数据源，把上线作品消耗回写到经营分析。',
    permissions: ['读取上线作品', '写入经营指标'],
    installedByDefault: false,
  },
]
