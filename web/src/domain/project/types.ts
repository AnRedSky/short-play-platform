export const EPISODE_STAGE_DEFINITIONS = [
  { key: 'input', name: '输入确认', short: '输入', order: 0 },
  { key: 'script', name: '剧本锁定', short: '剧本', order: 1 },
  { key: 'shot_assets', name: '镜头与资产', short: '预演', order: 2 },
  { key: 'production', name: '素材生产', short: '生产', order: 3 },
  { key: 'editing', name: '剪辑', short: '剪辑', order: 4 },
  { key: 'sound', name: '声音字幕', short: '音字', order: 5 },
  { key: 'qc', name: '单集质检', short: '质检', order: 6 },
  { key: 'delivery', name: '终审入库', short: '交付', order: 7 },
] as const

export type EpisodeStageKey = (typeof EPISODE_STAGE_DEFINITIONS)[number]['key']

export type StageStepState = 'done' | 'current' | 'pending' | 'blocked'

export interface StageStepView {
  key: EpisodeStageKey
  name: string
  short: string
  order: number
  state: StageStepState
}

export interface EpisodeFacts {
  inputConfirmed: boolean
  scriptLocked: boolean
  assetsLocked: boolean
  productionStarted: boolean
  productionCompleted: boolean
  editingCompleted: boolean
  audioReady: boolean
  subtitleApproved: boolean
  qcPassed: boolean
  delivered: boolean
  blocked: boolean
  blockedReason?: string
}

export interface Episode {
  id: string
  projectId: string
  number: number
  title: string
  facts: EpisodeFacts
  scriptVersion?: string
  planVersion?: string
  baselineVersion?: string
  updatedAt: string
}

export interface Batch {
  id: string
  index: number
  label: string
  episodeNumbers: number[]
}

export type ProjectLifecycle = 'active' | 'paused' | 'terminated' | 'archived'

export interface Project {
  id: string
  name: string
  synopsis: string
  lifecycle: ProjectLifecycle
  batches: Batch[]
  episodes: Episode[]
  createdAt: string
  updatedAt: string
}
