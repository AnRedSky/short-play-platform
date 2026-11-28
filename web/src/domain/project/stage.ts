import {
  EPISODE_STAGE_DEFINITIONS,
  type EpisodeFacts,
  type EpisodeStageKey,
  type Project,
  type StageStepView,
} from './types'

export type EpisodeActionKey =
  | 'confirmInput'
  | 'lockScript'
  | 'lockAssets'
  | 'startProduction'
  | 'completeProduction'
  | 'completeEditing'
  | 'markAudioReady'
  | 'approveSubtitle'
  | 'passQc'
  | 'deliver'

export interface EpisodeAction {
  key: EpisodeActionKey
  label: string
  description: string
}

export interface EpisodeStageView {
  current: StageStepView
  steps: StageStepView[]
  done: boolean
  progress: number
  tone: 'done' | 'active' | 'wait' | 'blocked'
  nextAction: EpisodeAction | null
}

export interface ProjectPhaseView {
  stage: StageStepView
  done: boolean
  progress: number
  tone: 'done' | 'active' | 'wait' | 'blocked'
  activeEpisodeNumber: number | null
  deliveredCount: number
  totalCount: number
}

const STAGE_BY_KEY = new Map<EpisodeStageKey, StageStepView>(
  EPISODE_STAGE_DEFINITIONS.map((stage) => [
    stage.key,
    { key: stage.key, name: stage.name, short: stage.short, order: stage.order, state: 'pending' },
  ]),
)

const ACTION_BY_STAGE: Record<EpisodeStageKey, EpisodeAction> = {
  input: { key: 'confirmInput', label: '确认输入', description: '确认分集任务单与前后集衔接后进入剧本阶段。' },
  script: { key: 'lockScript', label: '锁定剧本', description: '单集剧本定稿并完成审核后进入镜头与资产阶段。' },
  shot_assets: { key: 'lockAssets', label: '锁定镜头与资产', description: '锁定镜头计划、人物场景道具与模型基线。' },
  production: { key: 'startProduction', label: '开始素材生产', description: '按当前镜头计划版本派发生产任务。' },
  editing: { key: 'completeEditing', label: '完成剪辑', description: '画面锁定后进入声音字幕阶段。' },
  sound: { key: 'markAudioReady', label: '完成声音制作', description: '对白、音效与混音完成后进入字幕确认。' },
  qc: { key: 'passQc', label: '质检通过', description: '人物、场景、道具、技术与内容检查通过。' },
  delivery: { key: 'deliver', label: '终审入库', description: '终审通过后生成交付包并标记单集已交付。' },
}

export function stageByKey(key: EpisodeStageKey): StageStepView {
  const stage = STAGE_BY_KEY.get(key)
  if (!stage) throw new Error(`未知的单集阶段：${key}`)
  return { ...stage }
}

export function deriveCurrentStageKey(facts: EpisodeFacts): EpisodeStageKey {
  if (facts.delivered) return 'delivery'
  if (facts.qcPassed) return 'delivery'
  if (facts.subtitleApproved) return 'qc'
  if (facts.audioReady) return 'sound'
  if (facts.editingCompleted) return 'sound'
  if (facts.productionCompleted) return 'editing'
  if (facts.productionStarted) return 'production'
  if (facts.assetsLocked) return 'production'
  if (facts.scriptLocked) return 'shot_assets'
  if (facts.inputConfirmed) return 'script'
  return 'input'
}

export function nextEpisodeAction(facts: EpisodeFacts): EpisodeAction | null {
  if (facts.blocked) return null
  const stageKey = deriveCurrentStageKey(facts)
  if (stageKey === 'production' && facts.productionStarted) {
    return {
      key: 'completeProduction',
      label: '完成素材生产',
      description: '全部镜头候选版本通过后进入剪辑阶段。',
    }
  }
  if (stageKey === 'sound' && facts.audioReady) {
    return {
      key: 'approveSubtitle',
      label: '确认字幕',
      description: '字幕、口型与混音检查通过后进入单集质检。',
    }
  }
  if (stageKey === 'delivery' && facts.delivered) return null
  return { ...ACTION_BY_STAGE[stageKey] }
}

export function deriveEpisodeStage(facts: EpisodeFacts): EpisodeStageView {
  const currentKey = deriveCurrentStageKey(facts)
  const current = stageByKey(currentKey)
  const done = facts.delivered
  const blocked = facts.blocked
  const steps: StageStepView[] = EPISODE_STAGE_DEFINITIONS.map((stage) => {
    const state = done
      ? 'done'
      : blocked && stage.order === current.order
        ? 'blocked'
        : stage.order < current.order
          ? 'done'
          : stage.order === current.order
            ? 'current'
            : 'pending'
    return { ...stage, state }
  })
  return {
    current,
    steps,
    done,
    progress: done ? 100 : Math.round((current.order / EPISODE_STAGE_DEFINITIONS.length) * 100),
    tone: done ? 'done' : blocked ? 'blocked' : current.order === 0 ? 'wait' : 'active',
    nextAction: nextEpisodeAction(facts),
  }
}

export function deriveProjectPhase(project: Project): ProjectPhaseView {
  const episodes = [...project.episodes].sort((a, b) => a.number - b.number)
  if (episodes.length === 0) {
    return {
      stage: stageByKey('input'),
      done: false,
      progress: 0,
      tone: 'wait',
      activeEpisodeNumber: null,
      deliveredCount: 0,
      totalCount: 0,
    }
  }
  const deliveredCount = episodes.filter((episode) => episode.facts.delivered).length
  if (deliveredCount === episodes.length) {
    return {
      stage: stageByKey('delivery'),
      done: true,
      progress: 100,
      tone: 'done',
      activeEpisodeNumber: null,
      deliveredCount,
      totalCount: episodes.length,
    }
  }
  const pending = episodes
    .filter((episode) => !episode.facts.delivered)
    .sort((a, b) => {
      const orderA = deriveEpisodeStage(a.facts).current.order
      const orderB = deriveEpisodeStage(b.facts).current.order
      return orderA - orderB || a.number - b.number
    })
  const active = pending[0]
  const stage = deriveEpisodeStage(active.facts).current
  const progress = Math.round(episodes.reduce((sum, episode) => sum + deriveEpisodeStage(episode.facts).progress, 0) / episodes.length)
  return {
    stage,
    done: false,
    progress,
    tone: episodes.some((episode) => episode.facts.blocked) ? 'blocked' : 'active',
    activeEpisodeNumber: active.number,
    deliveredCount,
    totalCount: episodes.length,
  }
}

export function applyEpisodeAction(facts: EpisodeFacts, actionKey: EpisodeActionKey): EpisodeFacts {
  const next = nextEpisodeAction(facts)
  if (!next || next.key !== actionKey) {
    throw new Error(`当前状态不允许执行该动作：${actionKey}`)
  }
  const updated: EpisodeFacts = { ...facts }
  switch (actionKey) {
    case 'confirmInput':
      updated.inputConfirmed = true
      break
    case 'lockScript':
      updated.scriptLocked = true
      break
    case 'lockAssets':
      updated.assetsLocked = true
      break
    case 'startProduction':
      updated.productionStarted = true
      break
    case 'completeProduction':
      updated.productionCompleted = true
      break
    case 'completeEditing':
      updated.editingCompleted = true
      break
    case 'markAudioReady':
      updated.audioReady = true
      break
    case 'approveSubtitle':
      updated.subtitleApproved = true
      break
    case 'passQc':
      updated.qcPassed = true
      break
    case 'deliver':
      updated.delivered = true
      break
  }
  return updated
}
