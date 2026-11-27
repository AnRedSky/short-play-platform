import type { PageSpec } from './specs'

export interface SpecTab {
  path: string
  label: string
}

export interface SpecGroup {
  key: string
  label: string
  tabs: SpecTab[]
}

/** 同构规格页按业务域合并：同一域下共用一套页头/工具栏/表格骨架，以标签切换。 */
export const SPEC_GROUPS: SpecGroup[] = [
  { key: 'audio', label: '音频制作', tabs: [{ path: '/audio/dialogue', label: '对白配音' }, { path: '/audio/voice', label: '声音档案' }, { path: '/audio/bgm', label: '背景音乐' }, { path: '/audio/subtitle', label: '字幕' }] },
  { key: 'creation-extra', label: '创意补充', tabs: [{ path: '/creation/plan', label: '创意方案' }, { path: '/creation/breakdown', label: '剧本拆解' }] },
  { key: 'director-extra', label: '导演档案', tabs: [{ path: '/director/plan', label: '镜头计划' }, { path: '/director/cast', label: '人物档案' }, { path: '/director/world', label: '场景道具' }] },
  { key: 'models', label: '模型与路由', tabs: [{ path: '/models/config', label: '模型档案' }, { path: '/models/providers', label: '供应商' }, { path: '/models/routing', label: '能力路由' }] },
  { key: 'compliance', label: '合规', tabs: [{ path: '/compliance/rights', label: '版权与授权' }, { path: '/compliance/risks', label: '风险评估' }, { path: '/compliance/audit', label: '审计留痕' }] },
  { key: 'cost', label: '成本', tabs: [{ path: '/cost/ledger', label: '成本台账' }, { path: '/cost/budget', label: '预算阈值' }] },
  { key: 'ops', label: '运维', tabs: [{ path: '/ops/capabilities', label: '能力字典' }, { path: '/ops/queue', label: '队列与存储' }, { path: '/ops/logs', label: '系统日志' }] },
  { key: 'orgs', label: '组织与权限', tabs: [{ path: '/orgs/departments', label: '部门' }, { path: '/orgs/members', label: '员工' }, { path: '/orgs/member', label: '员工档案' }, { path: '/orgs/roles', label: '角色' }, { path: '/orgs/grants', label: '项目授权' }, { path: '/orgs/handover', label: '离职移交' }] },
  { key: 'tasks', label: '任务与队列', tabs: [{ path: '/tasks/queue', label: '资源队列' }, { path: '/tasks/list', label: '生产任务' }, { path: '/tasks/attempt', label: '调用记录' }] },
  { key: 'post-extra', label: '后期补充', tabs: [{ path: '/post/versions', label: '版本链' }] },
  { key: 'quality-extra', label: '质量补充', tabs: [{ path: '/quality/rework', label: '返工台账' }] },
  { key: 'video-extra', label: '视频补充', tabs: [{ path: '/video/preview', label: '预览校验' }] },
]

export function groupFor(path: string): { group: SpecGroup; tab: SpecTab } | null {
  for (const group of SPEC_GROUPS) {
    const tab = group.tabs.find((item) => item.path === path)
    if (tab) return { group, tab }
  }
  return null
}

/** 规格键必须全部落在分组内，避免新增页面又退回散装形态。 */
export function ungrouped(specs: Record<string, PageSpec>, routes: string[]): string[] {
  const grouped = new Set(SPEC_GROUPS.flatMap((group) => group.tabs.map((tab) => tab.path)))
  return routes.filter((path) => !grouped.has(path))
}
