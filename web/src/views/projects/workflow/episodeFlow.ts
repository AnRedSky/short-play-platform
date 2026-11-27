import type { Row } from '../../../mock/db'

export const BATCH_SIZE = 6

export const EPISODE_STEPS = [
  { key: 'E0', name: '输入确认', short: '输入', hint: '分集任务单与前后集衔接' },
  { key: 'E1', name: '剧本锁定', short: '剧本', hint: '单集剧本定稿与审核锁版' },
  { key: 'E2', name: '镜头与资产', short: '预演', hint: '镜头契约、资产与模型基线' },
  { key: 'E3', name: '素材生产', short: '生产', hint: '镜头生成、审片与重试' },
  { key: 'E4', name: '剪辑', short: '剪辑', hint: '粗剪、精剪与画面锁定' },
  { key: 'E5', name: '声音字幕', short: '音字', hint: '对白、音效、混音与字幕' },
  { key: 'E6', name: '单集 QC', short: '质检', hint: '全维质检、问题与复验' },
  { key: 'E7', name: '终审入库', short: '交付', hint: '终审、打包与单集入库' },
] as const

export type EpisodeStepKey = (typeof EPISODE_STEPS)[number]['key']
type StepVisualState = 'done' | 'current' | 'pending' | 'blocked'
type FlowTone = 'done' | 'active' | 'wait' | 'blocked'

export interface EpisodeStepState {
  key: EpisodeStepKey
  name: string
  short: string
  hint: string
  state: StepVisualState
}

export interface EpisodeFlow {
  currentStep: EpisodeStepKey
  steps: EpisodeStepState[]
  done: boolean
  inferred: boolean
  tone: FlowTone
  progress: number
  note: string
}

export interface EpisodeCard {
  row: Row
  no: number
  flow: EpisodeFlow
}

export interface BatchGroup {
  index: number
  label: string
  range: string
  episodes: EpisodeCard[]
  doneCount: number
  qcCount: number
  activeCount: number
  progress: number
  status: string
  tone: FlowTone
}

const STEP_INDEX = new Map<string, number>(EPISODE_STEPS.map((step, index) => [step.key, index]))

export function isEpisodeStep(value: string): value is EpisodeStepKey {
  return EPISODE_STEPS.some((step) => step.key === value)
}

export function stepIndex(key: string): number {
  return STEP_INDEX.get(key) ?? 0
}

export function padEpisode(no: number): string {
  return String(no).padStart(2, '0')
}

export function inferEpisodeFlow(episode: Row): EpisodeFlow {
  const status = String(episode.status ?? '')
  const qc = String(episode.qc ?? '')
  let currentStep: EpisodeStepKey = 'E0'
  let done = false
  let tone: FlowTone = 'wait'
  let note = '按现有状态推断'

  if (status.includes('已交付')) {
    currentStep = 'E7'
    done = true
    tone = 'done'
    note = '已交付'
  } else if (status.includes('已输出')) {
    currentStep = 'E7'
    tone = 'active'
    note = '已输出，待入库'
  } else if (status.includes('已通过质检') || qc === 'PASS') {
    currentStep = 'E7'
    tone = 'active'
    note = '质检通过，待终审入库'
  } else if (status.includes('异常') || status.includes('失败')) {
    currentStep = 'E3'
    tone = 'blocked'
    note = '生产异常或阻塞'
  } else if (status.includes('生产中') || status.includes('制作中')) {
    currentStep = 'E3'
    tone = 'active'
    note = '素材生产中'
  } else if (status.includes('待生产')) {
    currentStep = 'E2'
    tone = 'wait'
    note = '待进入素材生产'
  } else if (status.includes('后期')) {
    currentStep = 'E4'
    tone = 'active'
    note = '后期制作中'
  } else if (status.includes('质量') || status.includes('质检')) {
    currentStep = 'E6'
    tone = 'active'
    note = '质量检测中'
  } else if (status.includes('审核')) {
    currentStep = 'E1'
    tone = 'wait'
    note = '剧本审核中'
  }

  const currentIndex = stepIndex(currentStep)
  const steps = EPISODE_STEPS.map((step, index) => ({
    ...step,
    state: (done
      ? 'done'
      : index < currentIndex
        ? 'done'
        : index === currentIndex
          ? tone === 'blocked'
            ? 'blocked'
            : 'current'
          : 'pending') as StepVisualState,
  }))

  return {
    currentStep,
    steps,
    done,
    inferred: true,
    tone,
    progress: done ? 100 : Math.round((currentIndex / EPISODE_STEPS.length) * 100),
    note,
  }
}

export function buildBatchGroups(summary: Row, batchSize = BATCH_SIZE): BatchGroup[] {
  const episodes = ((summary.episodes as Row[] | undefined) ?? [])
    .slice()
    .sort((a, b) => Number(a.no ?? 0) - Number(b.no ?? 0))
  const groups = new Map<number, Row[]>()

  for (const episode of episodes) {
    const no = Number(episode.no ?? 0)
    if (!no) continue
    const index = Math.ceil(no / batchSize)
    const rows = groups.get(index) ?? []
    rows.push(episode)
    groups.set(index, rows)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, rows]) => {
      const cards: EpisodeCard[] = rows.map((row) => ({
        row,
        no: Number(row.no),
        flow: inferEpisodeFlow(row),
      }))
      const doneCount = cards.filter((item) => item.flow.done).length
      const qcCount = cards.filter((item) => item.flow.steps[6]?.state === 'done').length
      const activeCount = cards.filter(
        (item) => !item.flow.done && ['E3', 'E4', 'E5', 'E6'].includes(item.flow.currentStep),
      ).length
      const progress = cards.length
        ? Math.round(cards.reduce((sum, item) => sum + item.flow.progress, 0) / cards.length)
        : 0
      const status = doneCount === cards.length
        ? '已交付'
        : qcCount === cards.length
          ? '待终审'
          : activeCount > 0
            ? '生产中'
            : '准备中'
      const tone: FlowTone = doneCount === cards.length
        ? 'done'
        : activeCount > 0
          ? 'active'
          : 'wait'

      return {
        index,
        label: `B${index}`,
        range: `E${padEpisode(cards[0]?.no ?? 1)}–E${padEpisode(cards[cards.length - 1]?.no ?? 1)}`,
        episodes: cards,
        doneCount,
        qcCount,
        activeCount,
        progress,
        status,
        tone,
      }
    })
}
