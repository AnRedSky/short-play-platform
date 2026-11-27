/**
 * 业务口径层：状态机、阶段管线、关卡动作与权限。
 * 这三个东西在真实系统里必须由服务端裁决，前端只消费 allowedActions。
 */
import { store, type Row } from './db'

export type Tone = 'primary' | 'default' | 'ghost'

export interface GateAction {
  key: string
  label: string
  tone?: Tone
  permission: string
  next: string
  needReason?: boolean
  hint?: string
}

/** 状态迁移：新项目从剧本创作开始；创意状态仅保留旧项目兼容。 */
export const GATE_ACTIONS: Record<string, GateAction[]> = {
  草稿: [
    { key: 'start', label: '开始剧本创作', tone: 'primary', permission: 'creation.write', next: '剧本创作中' },
    { key: 'terminate', label: '终止项目', permission: 'project.manage', next: '已终止', needReason: true },
  ],
  创意策划中: [
    { key: 'confirmBrief', label: '确认历史创意并进入剧本', tone: 'primary', permission: 'creation.write', next: '剧本创作中' },
    { key: 'terminate', label: '终止项目', permission: 'project.manage', next: '已终止', needReason: true },
  ],
  剧本创作中: [
    { key: 'submitScript', label: '提交剧本审核', tone: 'primary', permission: 'creation.write', next: '待剧本审核' },
    { key: 'terminate', label: '终止项目', permission: 'project.manage', next: '已终止', needReason: true },
  ],
  待剧本审核: [
    { key: 'approveScript', label: '审核通过并锁定', tone: 'primary', permission: 'script.review', next: '生产准备中' },
    { key: 'rejectScript', label: '退回修订', permission: 'script.review', next: '剧本创作中', needReason: true },
  ],
  生产准备中: [
    { key: 'confirmPlan', label: '固化镜头计划', tone: 'primary', permission: 'director.write', next: '生产中' },
    { key: 'terminate', label: '终止项目', permission: 'project.manage', next: '已终止', needReason: true },
  ],
  生产中: [
    { key: 'toPost', label: '转入后期', tone: 'primary', permission: 'production.write', next: '后期制作中' },
    { key: 'pause', label: '暂停派发', permission: 'project.manage', next: '已暂停', needReason: true },
    { key: 'terminate', label: '终止项目', permission: 'project.manage', next: '已终止', needReason: true },
  ],
  后期制作中: [
    { key: 'submitQc', label: '提交质量检测', tone: 'primary', permission: 'post.write', next: '质量检测中' },
    { key: 'pause', label: '暂停派发', permission: 'project.manage', next: '已暂停', needReason: true },
  ],
  质量检测中: [
    { key: 'passQc', label: '检测通过', tone: 'primary', permission: 'quality.operate', next: '待最终审核' },
    { key: 'failQc', label: '存在阻断项 · 退回后期', permission: 'quality.operate', next: '后期制作中', needReason: true },
  ],
  待最终审核: [
    { key: 'finalApprove', label: '终审通过', tone: 'primary', permission: 'final.review', next: '已完成' },
    { key: 'finalReject', label: '终审退回', permission: 'final.review', next: '后期制作中', needReason: true },
  ],
  已完成: [
    { key: 'deliver', label: '生成并交付', tone: 'primary', permission: 'delivery.execute', next: '已交付' },
    { key: 'finalReject', label: '退回返工', permission: 'final.review', next: '后期制作中', needReason: true },
  ],
  已交付: [{ key: 'archive', label: '归档资产', tone: 'primary', permission: 'project.manage', next: '已归档' }],
  已归档: [],
  已暂停: [{ key: 'resume', label: '恢复生产', tone: 'primary', permission: 'project.manage', next: '__prev__' }],
  异常中: [
    { key: 'resume', label: '恢复生产', tone: 'primary', permission: 'project.manage', next: '__prev__' },
    { key: 'terminate', label: '终止项目', permission: 'project.manage', next: '已终止', needReason: true },
  ],
  已终止: [],
}

const PHASE_TO_STAGE: Record<string, string> = {
  草稿: 'script',
  创意策划中: 'script',
  剧本创作中: 'script',
  待剧本审核: 'script',
  生产准备中: 'plan',
  生产中: 'video',
  后期制作中: 'post',
  质量检测中: 'qc',
  待最终审核: 'delivery',
  已完成: 'delivery',
  已交付: 'delivery',
  已归档: 'delivery',
  已暂停: 'video',
  异常中: 'video',
  已终止: 'script',
}

export interface StageRow {
  key: string
  name: string
  owner: string
  gate: string
  out: string
  state: 'overview' | 'done' | 'now' | 'blocked' | 'todo'
}

const STAGE_ORDER = ['script', 'plan', 'video', 'post', 'audio', 'qc', 'delivery']

export function stageChain(project: Row): StageRow[] {
  const pipeline = store
    .table('stagePipeline')
    .filter((stage) => stage.key !== 'brief')
    .slice()
    .sort((a, b) => {
      const left = STAGE_ORDER.indexOf(String(a.key ?? ''))
      const right = STAGE_ORDER.indexOf(String(b.key ?? ''))
      return (left < 0 ? STAGE_ORDER.length : left) - (right < 0 ? STAGE_ORDER.length : right)
    })
  const current = PHASE_TO_STAGE[project.status] ?? 'script'
  const currentIndex = Math.max(0, pipeline.findIndex((stage) => stage.key === current))
  return pipeline.map((stage, index) => ({
    key: stage.key,
    name: stage.name,
    owner: stage.owner,
    gate: stage.gate,
    out: stage.out,
    state:
      index < currentIndex
        ? 'done'
        : index === currentIndex
          ? project.status === '异常中' || project.status === '已暂停'
            ? 'blocked'
            : 'now'
          : 'todo',
  }))
}

export function permissionsOf(identityId: string): string[] {
  const identity = store.table('identities').find((row) => row.id === identityId)
  if (!identity) return []
  const role = store.table('roles').find((row) => row.code === identity.role)
  return (role?.perms ?? []) as string[]
}

export function identityOf(identityId: string): Row | undefined {
  return store.table('identities').find((row) => row.id === identityId)
}

export const PROJECT_GOVERNANCE_ACTIONS = new Set([
  'start',
  'confirmBrief',
  'submitScript',
  'approveScript',
  'rejectScript',
  'pause',
  'resume',
  'terminate',
  'archive',
])

export function allowedActions(project: Row, permissions: string[]): GateAction[] {
  const actions = GATE_ACTIONS[project.status] ?? []
  return actions.filter(
    (action) => permissions.includes(action.permission) && PROJECT_GOVERNANCE_ACTIONS.has(action.key),
  )
}

export function progressOf(project: Row): number {
  if (project.status === '已归档' || project.status === '已交付') return 100
  const chain = stageChain(project)
  const index = chain.findIndex((stage) => stage.state === 'now' || stage.state === 'blocked')
  if (index < 0) return project.status === '已终止' ? 0 : 100
  return Math.round(((index + Math.max(0, Math.min(0.95, (project.done ?? 0) / Math.max(1, project.episodes ?? 1)))) / chain.length) * 100)
}
