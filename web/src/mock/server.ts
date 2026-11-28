/**
 * Mock API 服务：与真实后端同构的 REST 契约（/api/v1）。
 * 前端只调 api 层；VITE_DATA_MODE=mock 时请求进入这里，切到 real 时同一份代码改用后端。
 */
import { nextId, now, store, type Row } from './db'
import { GATE_ACTIONS, PROJECT_GOVERNANCE_ACTIONS, allowedActions, permissionsOf, progressOf, stageChain } from './state'
import {
  modelProfileCreateBlockReason,
  providerTestBlockReason,
  routeEditBlockReason,
  routeImpactTasks,
} from '../composables/modelGate'

export interface Envelope<T = unknown> {
  data: T
  meta?: Record<string, unknown>
}

export class MockHttpError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type Handler = (ctx: {
  id: string
  body: Row
  query: URLSearchParams
  method: string
  parts: string[]
}) => Envelope | unknown

const LATENCY = 60
const BATCH_SIZE = 6

const QUALITY_PROFILES: Row[] = [
  {
    id: 'QC-SUB',
    name: '字幕与口型',
    dim: '字幕与口型',
    level: '高',
    where: 'E{ep} / S01 / SH-01 · 00:03',
    action: '退回 E5 校对字幕并重做口型；复检通过后再确认 QC',
    desc: '字幕错字、断句或口型偏移。',
  },
  {
    id: 'QC-AV',
    name: '音画同步',
    dim: '音画同步',
    level: '高',
    where: 'E{ep} / S02 / SH-04 · 00:12',
    action: '退回 E4 对齐画面或退回 E5 重排音轨；复检通过后再确认 QC',
    desc: '对白与画面对不上，或环境声提前/滞后。',
  },
  {
    id: 'QC-TIME',
    name: '时长与节奏',
    dim: '时长与节奏',
    level: '中',
    where: 'E{ep} / 全片 · 结尾 00:08',
    action: '退回 E4 重剪结尾节奏，保证单集时长与钩子',
    desc: '单集超时、结尾拖沓或钩子不成立。',
  },
  {
    id: 'QC-SAFE',
    name: '安全区与越界',
    dim: '安全区',
    level: '中',
    where: 'E{ep} / S03 / SH-07 · 00:21',
    action: '退回 E4 调整字幕安全区或画面构图',
    desc: '字幕越界、人物关键部位出画。',
  },
]

function ensureQualityProfiles(): Row[] {
  const profiles = rows('qualityProfiles')
  if (!profiles.length) {
    profiles.push(...QUALITY_PROFILES.map((profile) => ({ ...profile })))
    store.persist()
  }
  return profiles
}

function ok<T>(data: T, meta?: Record<string, unknown>): Envelope<T> {
  return meta ? { data, meta } : { data }
}

function rows(table: string): Row[] {
  return store.table(table)
}

function byId(table: string, id: string, field = 'id'): Row {
  const row = rows(table).find((item) => String(item[field]) === id)
  if (!row) throw new MockHttpError(404, 'not_found', `未找到 ${table} / ${id}`)
  return row
}

function currentIdentity(): Row {
  const identity = rows('identities').find((item) => item.id === store.identityId)
  return identity ?? rows('identities')[0]
}

function currentPermissions(): string[] {
  return permissionsOf(store.identityId)
}

function projectOf(id: string): Row {
  return byId('projects', id, 'id')
}

/* ------------------------------------------------------------------ *
 * 单集状态：在旧数据上补齐 E0–E7、批次、模型基线与 take 的最小契约
 * ------------------------------------------------------------------ */

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function episodeStateKey(projectId: string, ep: number): string {
  return `ES-${projectId}-${pad2(ep)}`
}

function seconds(value: unknown): number {
  const digits = String(value ?? '').replace(/[^\d]/g, '')
  return digits ? Number(digits) : 0
}

function timecode(total: number): string {
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${pad2(minutes)}:${pad2(secs)}`
}

function ensureTimelineClips(projectId: string, ep: number, version: string): Row[] {
  const existing = rows('timelineClips').filter(
    (row) => row.project === projectId && Number(row.ep) === ep && row.timeline === version,
  )
  if (existing.length) return existing
  const shots = rows('shots').filter((row) => row.project === projectId && Number(row.ep) === ep)
  const accepted = rows('tasks').filter(
    (row) => row.project === projectId && Number(row.ep) === ep && String(row.status) === '已通过',
  )
  let cursor = 0
  for (const shot of shots) {
    const duration = seconds(shot.duration) || 5
    const task = accepted
      .filter((row) => row.shotId === shot.id || Number(row.shot) === Number(shot.no))
      .sort((a, b) => Number(b.take ?? 1) - Number(a.take ?? 1))[0]
    rows('timelineClips').push({
      id: `CL-${version}-${String(shot.no ?? '').padStart(2, '0')}`,
      project: projectId,
      ep,
      timeline: version,
      shotId: shot.id,
      shot: shot.no,
      scene: shot.scene,
      in: timecode(cursor),
      out: timecode(cursor + duration),
      duration: `${duration} 秒`,
      source: task ? `T${task.take ?? 1} · ${task.model}` : '待补',
      status: task ? '已对齐' : '待补',
      stale: false,
      createdAt: now(),
    })
    cursor += duration
  }
  return rows('timelineClips').filter(
    (row) => row.project === projectId && Number(row.ep) === ep && row.timeline === version,
  )
}

function defaultEpisodeState(project: Row, episode: Row): Row {
  const ep = Number(episode.no ?? 0)
  const status = String(episode.status ?? '')
  const qc = String(episode.qc ?? '')
  const shot = rows('shots').find((row) => row.project === project.id && Number(row.ep) === ep)
  const timeline = rows('timelines').find((row) => row.project === project.id && Number(row.ep) === ep)
  const dialogues = rows('dialogues').filter((row) => row.project === project.id && Number(row.ep) === ep)
  const subtitles = rows('subtitles').filter((row) => row.project === project.id && Number(row.ep) === ep)
  const lipSync = rows('lipSync').filter((row) => dialogues.some((line) => row.line === line.id))
  let currentStep = 'E0'
  let inputConfirmed = false
  let scriptLocked = false
  let assetsLocked = false
  let productionStarted = false
  let timelineLocked = timeline ? String(timeline.status) === '已输出' : false
  let audioGenerated = dialogues.length > 0 && dialogues.every((row) => String(row.audio ?? '').startsWith('已生成'))
  let subtitleApproved = subtitles.some((row) => String(row.status) === '已通过')
  let lipSyncPassed = lipSync.length > 0 && lipSync.every((row) => String(row.status) === '已通过')
  let mixPassed = false
  let qcPassed = false
  let finalApproved = false
  let delivered = false
  let blocked = false

  if (status.includes('已交付')) {
    currentStep = 'E7'
    inputConfirmed = scriptLocked = assetsLocked = productionStarted = true
    timelineLocked = audioGenerated = subtitleApproved = lipSyncPassed = mixPassed = qcPassed = finalApproved = delivered = true
  } else if (status.includes('已输出')) {
    currentStep = 'E7'
    inputConfirmed = scriptLocked = assetsLocked = productionStarted = true
    timelineLocked = audioGenerated = subtitleApproved = lipSyncPassed = mixPassed = qcPassed = finalApproved = true
  } else if (status.includes('已通过质检') || qc === 'PASS') {
    currentStep = 'E7'
    inputConfirmed = scriptLocked = assetsLocked = productionStarted = true
    timelineLocked = audioGenerated = subtitleApproved = lipSyncPassed = mixPassed = qcPassed = true
  } else if (status.includes('异常') || status.includes('失败')) {
    currentStep = 'E3'
    inputConfirmed = scriptLocked = assetsLocked = productionStarted = true
    blocked = true
  } else if (status.includes('生产中') || status.includes('制作中') || status.includes('后期')) {
    currentStep = status.includes('后期') ? 'E4' : 'E3'
    inputConfirmed = scriptLocked = assetsLocked = productionStarted = true
  } else if (status.includes('待生产')) {
    currentStep = 'E2'
    inputConfirmed = scriptLocked = true
  } else if (status.includes('质量') || status.includes('质检')) {
    currentStep = 'E6'
    inputConfirmed = scriptLocked = assetsLocked = productionStarted = true
    timelineLocked = audioGenerated = subtitleApproved = lipSyncPassed = mixPassed = true
  } else if (status.includes('审核')) {
    currentStep = 'E1'
    inputConfirmed = true
  }

  if (currentStep === 'E5') timelineLocked = true
  if (currentStep === 'E6' || currentStep === 'E7') {
    timelineLocked = audioGenerated = subtitleApproved = lipSyncPassed = mixPassed = true
  }

  return {
    id: episodeStateKey(project.id, ep),
    project: project.id,
    ep,
    batch: Math.ceil(ep / BATCH_SIZE),
    currentStep,
    status: status || '待生产',
    blocked,
    inputConfirmed,
    scriptLocked,
    assetsLocked,
    productionStarted,
    timelineLocked,
    audioGenerated,
    subtitleApproved,
    lipSyncPassed,
    mixPassed,
    qcPassed,
    finalApproved,
    delivered,
    modelBaseline: String(shot?.model ?? '视频模型 A'),
    owner: project.owner ?? '',
    updated: episode.updatedAt ?? now(),
  }
}

/** 新集合缺失时从现有分集状态派生；只补不改，保证旧缓存也能升级。 */
function ensureEpisodeStates(projectId: string): Row[] {
  const project = projectOf(projectId)
  const episodes = rows('episodes').filter((row) => row.project === projectId)
  const states = rows('episodeStates')
  let changed = false
  for (const episode of episodes) {
    const ep = Number(episode.no ?? 0)
    if (!ep) continue
    if (states.some((row) => row.project === projectId && Number(row.ep) === ep)) continue
    states.push(defaultEpisodeState(project, episode))
    changed = true
  }
  if (changed) store.persist()
  return states.filter((row) => row.project === projectId)
}

const AUTO_PROJECT_STATUSES = new Set([
  '生产准备中',
  '生产中',
  '后期制作中',
  '质量检测中',
  '待最终审核',
  '已完成',
  '已交付',
  '已归档',
])

const STEP_STAGE_STATUS: Record<string, string> = {
  E0: '生产准备中',
  E1: '生产准备中',
  E2: '生产准备中',
  E3: '生产中',
  E4: '后期制作中',
  E5: '后期制作中',
  E6: '质量检测中',
  E7: '待最终审核',
}

const STAGE_STATUS_RANK: Record<string, number> = {
  生产准备中: 0,
  生产中: 1,
  后期制作中: 2,
  质量检测中: 3,
  待最终审核: 4,
  已完成: 5,
  已交付: 6,
}

function deriveProjectStatus(project: Row, states: Row[]): string | null {
  if (!states.length) return null
  const episodes = Number(project.episodes ?? 0)
  const status = String(project.status ?? '')
  const deliveredAll = states.every((state) => Boolean(state.delivered))
  const deliveredEnough = episodes > 0 && Number(project.delivered ?? 0) >= episodes
  const pending = states.filter((state) => !state.delivered && !state.finalApproved)
  const onlyFinalPending = pending.every((state) => String(state.currentStep) === 'E7')
  const trustDelivery = deliveredAll || (deliveredEnough && onlyFinalPending)
  if (status === '已归档' && trustDelivery) return '已归档'
  if (deliveredAll) return '已交付'
  if (deliveredEnough && onlyFinalPending) return '已交付'
  if (!pending.length) return '已完成'
  const stage = pending
    .map((state) => STEP_STAGE_STATUS[String(state.currentStep ?? 'E0')] ?? '生产准备中')
    .sort((a, b) => (STAGE_STATUS_RANK[a] ?? 0) - (STAGE_STATUS_RANK[b] ?? 0))[0]
  return stage ?? '生产准备中'
}

function syncProjectStatus(project: Row, states: Row[]): void {
  const status = String(project.status ?? '')
  if (!AUTO_PROJECT_STATUSES.has(status)) return
  const next = deriveProjectStatus(project, states)
  if (!next || next === status) return
  project.status = next
  project.phase = stageChain(project).find((stage) => stage.state === 'now')?.name ?? project.phase
  project.updated = now()
  store.persist()
}

function episodeEvent(projectId: string, ep: number, action: string, note: string, step: string) {
  rows('episodeEvents').unshift({
    id: nextId('EE', 'episodeEvents'),
    project: projectId,
    ep,
    action,
    actor: String(currentIdentity().name ?? '').split(' · ')[0],
    at: now(),
    note,
    step,
  })
}

/**
 * 批次 3 集试跑：只建立门禁预检单，不自动推进任何单集。
 * 单集仍是执行单位，试跑单用于提前暴露剧本、资产与模型基线缺口。
 */
function batchTrial(projectId: string, batch: number, body: Row): Envelope {
  const project = projectOf(projectId)
  const states = ensureEpisodeStates(projectId)
  const episodes = rows('episodes')
    .filter((row) => row.project === projectId)
    .filter((row) => Math.ceil(Number(row.no ?? 0) / BATCH_SIZE) === batch)
    .sort((a, b) => Number(a.no) - Number(b.no))
  if (!episodes.length) throw new MockHttpError(404, 'batch_not_found', `项目 ${projectId} 没有 B${batch}`)
  const size = Math.max(1, Math.min(3, Number(body.size ?? 3)))
  const delivered = episodes.filter((row) => {
    const state = states.find((item) => Number(item.ep) === Number(row.no))
    return Boolean(state?.delivered)
  })
  const pending = episodes.filter((row) => !delivered.includes(row))
  const selected = (pending.length >= size ? pending : episodes).slice(0, size)
  const selectedStates = selected
    .map((row) => states.find((item) => Number(item.ep) === Number(row.no)))
    .filter(Boolean) as Row[]
  const models = [...new Set(selectedStates.map((state) => String(state.modelBaseline ?? '')).filter(Boolean))]
  const model = models[0] ?? ''
  const locked = selectedStates.filter((state) => state.scriptLocked).length
  const assets = selectedStates.filter((state) => state.assetsLocked).length
  const packages = selectedStates.filter((state) => state.delivered).length
  const gatePass = locked === selected.length && assets === selected.length && Boolean(model)
  const checks = [
    { key: 'script', label: '剧本锁定', pass: locked === selected.length, detail: `${locked}/${selected.length}` },
    { key: 'assets', label: '镜头/资产锁定', pass: assets === selected.length, detail: `${assets}/${selected.length}` },
    { key: 'model', label: '模型基线', pass: Boolean(model), detail: model || '未记录' },
    { key: 'delivery', label: '单集包', pass: packages === selected.length, detail: `${packages}/${selected.length}` },
  ]
  const id = `BT-${String(projectId).split('-')[1] ?? projectId}-B${batch}`
  const existing = rows('batchTrials').find((row) => row.id === id)
  const trial: Row = {
    id,
    project: projectId,
    batch,
    size: selected.length,
    episodes: selected.map((row) => Number(row.no)),
    range: `E${pad2(Number(selected[0]?.no ?? 0))}–E${pad2(Number(selected[selected.length - 1]?.no ?? 0))}`,
    status: gatePass ? '可开工' : '待补齐',
    gate: `${checks.slice(0, 3).filter((check) => check.pass).length}/3 开工项通过`,
    deliveryGate: `${packages}/${selected.length} 集已交付`,
    model: model || '未记录',
    checks,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
    note: String(body.note ?? '批次 3 集试跑门禁预检；不自动推进单集。'),
  }
  if (existing) Object.assign(existing, trial)
  else rows('batchTrials').unshift(trial)
  project.updated = now()
  store.persist()
  return ok(trial)
}

function batchPackage(projectId: string, batch: number, body: Row): Envelope {
  const project = projectOf(projectId)
  const states = ensureEpisodeStates(projectId)
  const episodes = rows('episodes')
    .filter((row) => row.project === projectId)
    .filter((row) => Math.ceil(Number(row.no ?? 0) / BATCH_SIZE) === batch)
    .sort((a, b) => Number(a.no) - Number(b.no))
  if (!episodes.length) throw new MockHttpError(404, 'batch_not_found', `项目 ${projectId} 没有 B${batch}`)
  const missing = episodes.filter((episode) => {
    const state = states.find((row) => Number(row.ep) === Number(episode.no))
    return !state?.delivered
  })
  if (missing.length) {
    return ok(
      {
        id: `BP-${String(projectId).split('-')[1] ?? projectId}-B${batch}`,
        project: projectId,
        kind: '批次包',
        batch,
        status: '待补齐',
        episodes: episodes.length,
        delivered: episodes.length - missing.length,
        missing: missing.map((episode) => `E${pad2(Number(episode.no))}`),
      },
      { created: false, ready: false },
    )
  }
  const id = `BP-${String(projectId).split('-')[1] ?? projectId}-B${batch}`
  const existing = rows('deliveries').find((row) => row.id === id)
  if (existing) return ok(existing, { created: false })
  const delivery: Row = {
    id,
    project: projectId,
    kind: '批次包',
    batch,
    version: `B${batch}`,
    episodes: episodes.length,
    files: episodes.length,
    size: `${(episodes.length * 0.42).toFixed(1)} GB`,
    checksum: `sha256:${String(projectId).toLowerCase()}-b${batch}…mock`,
    reviewer: String(currentIdentity().name ?? '').split(' · ')[0],
    at: now(),
    status: '已交付',
    receiver: String(body.receiver ?? '企业内容库'),
    frozen: true,
  }
  rows('deliveries').unshift(delivery)
  project.delivered = states.filter((state) => state.delivered).length
  syncProjectStatus(project, states)
  project.updated = now()
  store.persist()
  return ok(delivery, { created: true })
}

function episodeAction(projectId: string, ep: number, body: Row): Envelope {
  const project = projectOf(projectId)
  const episode = rows('episodes').find((row) => row.project === projectId && Number(row.no) === ep)
  if (!episode) throw new MockHttpError(404, 'episode_not_found', `项目 ${projectId} 没有第 ${ep} 集`)
  const states = ensureEpisodeStates(projectId)
  const state = states.find((row) => Number(row.ep) === ep)
  if (!state) throw new MockHttpError(404, 'episode_state_not_found', `第 ${ep} 集缺少状态记录`)
  const action = String(body.action ?? '')
  const reason = String(body.reason ?? '').trim()

  const requireStep = (step: string) => {
    if (String(state.currentStep) !== step) {
      throw new MockHttpError(409, 'episode_step_conflict', `第 ${ep} 集当前在 ${state.currentStep}，不能执行 ${action}`)
    }
  }
  const touch = (step: string, status: string, note: string) => {
    state.currentStep = step
    state.status = status
    state.updated = now()
    episode.status = status
    episode.updatedAt = now()
    project.updated = now()
    episodeEvent(projectId, ep, action, note, step)
  }

  if (action === 'confirmInput') {
    if (state.inputConfirmed) return ok({ state, message: '输入已确认' })
    requireStep('E0')
    state.inputConfirmed = true
    touch('E1', '待剧本审核', reason || '分集任务单与前后集衔接已确认')
  } else if (action === 'lockScript') {
    if (!state.inputConfirmed) throw new MockHttpError(409, 'episode_input_gate', '请先确认 E0 输入')
    if (state.scriptLocked) return ok({ state, message: '剧本已锁定' })
    requireStep('E1')
    state.scriptLocked = true
    touch('E2', '待生产', reason || '单集剧本定稿并锁定')
  } else if (action === 'generateShots') {
    if (!state.scriptLocked) throw new MockHttpError(409, 'episode_script_gate', '请先锁定 E1 剧本')
    if (state.assetsLocked) throw new MockHttpError(409, 'episode_assets_locked', '镜头与资产已锁定，不能再重建镜头契约')
    requireStep('E2')
    const existing = rows('shots').filter((row) => row.project === projectId && Number(row.ep) === ep)
    if (existing.length) throw new MockHttpError(409, 'episode_shots_exists', `第 ${ep} 集已有 ${existing.length} 个镜头，不能重复生成`)
    const versions = rows('scripts')
      .filter((row) => row.project === projectId)
      .sort((left, right) => Number(String(right.version ?? '').replace(/\D/g, '')) - Number(String(left.version ?? '').replace(/\D/g, '')))
    const script = versions.find((row) => Boolean(row.locked)) ?? versions[0]
    const drafts = Array.isArray(script?.episodeDrafts) ? script!.episodeDrafts as DraftEpisode[] : []
    const draft = drafts.find((row) => Number(row.no) === ep)
    if (!draft) throw new MockHttpError(422, 'episode_script_missing', `第 ${ep} 集还没有分集稿，不能生成镜头契约`)
    const model = String(body.model ?? state.modelBaseline ?? '视频模型 A')
    const generated = buildEpisodeShots(project, draft, model)
    rows('shots').unshift(...generated)
    episode.scenes = draft.scenes.length
    episode.shots = generated.length
    episode.duration = `${generated.reduce((sum, shot) => sum + seconds(shot.duration), 0)} 秒`
    episode.logline = draft.logline
    episode.hook = draft.hook
    script!.shots = Number(script!.shots ?? 0) + generated.length
    state.modelBaseline = model
    touch('E2', '待生产', reason || `由分集稿生成 ${generated.length} 个镜头契约；模型 ${model}`)
  } else if (action === 'updateShots') {
    if (!state.scriptLocked) throw new MockHttpError(409, 'episode_script_gate', '请先锁定 E1 剧本')
    if (state.assetsLocked) throw new MockHttpError(409, 'episode_assets_locked', '镜头契约已固化，修改需新建版本')
    requireStep('E2')
    const incoming = Array.isArray(body.shots) ? body.shots as Row[] : []
    if (!incoming.length) throw new MockHttpError(422, 'episode_shots_empty', '镜头契约至少保留 1 个镜头')
    if (incoming.length > 100) throw new MockHttpError(422, 'episode_shots_overflow', '单集镜头不能超过 100 个')
    const projectCode = String(project.id).split('-')[1] ?? String(project.id)
    const existingIds = new Set(
      rows('shots')
        .filter((row) => String(row.project) === String(project.id) && Number(row.ep) === ep)
        .map((row) => String(row.id)),
    )
    const model = String(incoming[0]?.model ?? state.modelBaseline ?? '视频模型 A')
    const usedIds = new Set<string>()
    const updated = incoming.map((item, index) => {
      const baseId = String(item.id ?? '').trim()
      const fallbackId = `SH-${projectCode}-E${pad2(ep)}-${pad2(index + 1)}`
      const id = baseId && existingIds.has(baseId) && !usedIds.has(baseId) ? baseId : fallbackId
      usedIds.add(id)
      const duration = seconds(item.duration)
      return {
        id,
        project: projectId,
        ep,
        scene: String(item.scene ?? '01').trim() || '01',
        no: `SH-${pad2(index + 1)}`,
        order: index + 1,
        frame: String(item.frame ?? '中景').trim() || '中景',
        angle: String(item.angle ?? '平视').trim() || '平视',
        move: String(item.move ?? '固定').trim() || '固定',
        lens: String(item.lens ?? '').trim(),
        desc: String(item.desc ?? '').trim(),
        chars: String(item.chars ?? '').trim(),
        emotion: String(item.emotion ?? '').trim(),
        line: String(item.line ?? '').trim(),
        voice: String(item.voice ?? '').trim(),
        duration: `${duration || 8} 秒`,
        refs: String(item.refs ?? '').trim(),
        model: String(item.model ?? model).trim() || model,
        quality: String(item.quality ?? '人物一致性 / 画面异常 / 时长').trim(),
        status: '待生成',
        version: '待生成',
      }
    })
    const table = rows('shots')
    for (let index = table.length - 1; index >= 0; index -= 1) {
      if (String(table[index].project) === String(project.id) && Number(table[index].ep) === ep) table.splice(index, 1)
    }
    table.unshift(...updated)
    episode.shots = updated.length
    episode.duration = `${updated.reduce((sum, shot) => sum + seconds(shot.duration), 0)} 秒`
    state.modelBaseline = model
    touch('E2', '待生产', reason || `镜头契约已更新为 ${updated.length} 镜；模型 ${model}`)
  } else if (action === 'lockAssets') {
    if (!state.scriptLocked) throw new MockHttpError(409, 'episode_script_gate', '请先锁定 E1 剧本')
    if (state.assetsLocked) return ok({ state, message: '资产已锁定' })
    requireStep('E2')
    const shots = rows('shots').filter((row) => row.project === projectId && Number(row.ep) === ep)
    if (!shots.length) throw new MockHttpError(409, 'episode_shot_empty', '请先生成镜头契约')
    const incomplete = shots.filter(
      (shot) => !String(shot.desc ?? '').trim() || !String(shot.chars ?? '').trim() || !String(shot.duration ?? '').trim(),
    )
    if (incomplete.length) throw new MockHttpError(422, 'episode_shot_incomplete', `${incomplete.length} 个镜头缺少画面、人物或时长`)
    state.assetsLocked = true
    state.modelBaseline = String(body.model ?? state.modelBaseline ?? '视频模型 A')
    state.planVersion = freezeEpisodePlan(project, ep, shots, state.modelBaseline).id
    touch('E3', '生产中', reason || `镜头契约与资产已锁定；模型基线 ${state.modelBaseline}`)
  } else if (action === 'rollbackPlan') {
    const planId = String(body.planId ?? '').trim()
    const plan = rows('plans').find((row) => row.id === planId)
    if (!plan || String(plan.project) !== projectId || String(plan.scope) !== `第 ${ep} 集`) {
      throw new MockHttpError(404, 'episode_plan_not_found', `未找到第 ${ep} 集的镜头计划 ${planId}`)
    }
    if (!['E2', 'E3'].includes(String(state.currentStep))) {
      throw new MockHttpError(409, 'episode_plan_step', '只在导演规划或素材生产阶段允许返工镜头计划')
    }
    const activeTasks = rows('tasks').filter(
      (row) => row.project === projectId && Number(row.ep) === ep && !['已替代', '已取消'].includes(String(row.status)),
    )
    if (state.productionStarted || activeTasks.length) {
      throw new MockHttpError(409, 'episode_plan_in_production', '本集已派发生产任务，请先走返工流程再修改计划版本')
    }
    const snapshot = Array.isArray(plan.snapshot) ? plan.snapshot as Row[] : []
    if (!snapshot.length) throw new MockHttpError(422, 'episode_plan_snapshot', '该版本没有镜头快照，不能返工')
    const projectCode = String(project.id).split('-')[1] ?? String(project.id)
    const restored = snapshot.map((item, index) => ({
      ...item,
      id: String(item.id ?? `SH-${projectCode}-E${pad2(ep)}-${pad2(index + 1)}`),
      project: projectId,
      ep,
      no: `SH-${pad2(index + 1)}`,
      order: index + 1,
      duration: `${seconds(item.duration) || 8} 秒`,
      status: '待生成',
      version: '待生成',
    }))
    const table = rows('shots')
    for (let index = table.length - 1; index >= 0; index -= 1) {
      if (String(table[index].project) === projectId && Number(table[index].ep) === ep) table.splice(index, 1)
    }
    table.unshift(...restored)
    episode.shots = restored.length
    episode.duration = `${restored.reduce((sum, shot) => sum + seconds(shot.duration), 0)} 秒`
    state.assetsLocked = false
    state.productionStarted = false
    state.planVersion = ''
    state.modelBaseline = String(plan.model ?? state.modelBaseline)
    touch('E2', '待生产', reason || `返工到 ${plan.id}；镜头契约恢复为草稿`)
  } else if (action === 'startProduction') {
    if (!state.assetsLocked) throw new MockHttpError(409, 'episode_asset_gate', '请先锁定 E2 镜头与资产')
    const shots = rows('shots').filter((row) => row.project === projectId && Number(row.ep) === ep)
    if (!shots.length) throw new MockHttpError(409, 'episode_shot_empty', '本集没有可生产的镜头')
    const currentPlan = rows('plans').find(
      (row) => String(row.id) === String(state.planVersion) && String(row.project) === projectId,
    )
    const planVersion = String(currentPlan?.id ?? state.planVersion ?? '')
    const activeTasks = rows('tasks').filter(
      (row) => row.project === projectId && Number(row.ep) === ep && !['已替代', '已取消'].includes(String(row.status)),
    )
    if (!activeTasks.length) {
      for (const shot of shots) {
        rows('tasks').unshift({
          id: nextId('T', 'tasks'),
          project: projectId,
          ep,
          shotId: shot.id,
          scene: shot.scene,
          shot: shot.no,
          kind: '视频生成',
          stage: '视频生产',
          status: '排队中',
          priority: '中',
          deps: [],
          parallelGroup: `E${pad2(ep)}-A`,
          input: shot.refs ?? '—',
          output: 'MP4 1080×1920',
          model: state.modelBaseline,
          planVersion,
          config: 'PRV-01',
          executor: project.owner ?? '林知远',
          resourceOwner: project.owner ?? '林知远',
          attempt: 1,
          maxAttempts: 3,
          take: 1,
          parentTask: '',
          est: 30,
          actual: 0,
          failedCost: 0,
          submitAt: now().slice(11),
          failReason: '—',
          qc: '待检',
        })
      }
    }
    state.productionStarted = true
    touch('E3', '生产中', reason || `已按 ${shots.length} 个镜头派发素材生产任务`)
  } else if (action === 'retryTask') {
    const taskId = String(body.taskId ?? '')
    if (!taskId) throw new MockHttpError(422, 'task_required', '缺少任务 ID')
    taskAction(taskId, 'retry')
    touch('E3', '生产中', reason || `重试任务 ${taskId}`)
  } else if (action === 'changeModel') {
    const task = byId('tasks', String(body.taskId ?? ''))
    if (task.project !== projectId || Number(task.ep) !== ep) {
      throw new MockHttpError(409, 'task_episode_mismatch', '任务不属于当前集')
    }
    const model = String(body.model ?? '').trim()
    if (!model) throw new MockHttpError(422, 'model_required', '请选择新的模型')
    const takes = rows('tasks').filter((row) => row.project === projectId && Number(row.ep) === ep && row.shot === task.shot)
    const nextTake = Math.max(...takes.map((row) => Number(row.take ?? 1)), 1) + 1
    const previousStatus = String(task.status ?? '')
    task.status = '已替代'
    task.updatedAt = now()
    const newTask = {
      ...task,
      id: nextId('T', 'tasks'),
      status: '排队中',
      model,
      attempt: 1,
      take: nextTake,
      parentTask: String(task.id),
      failReason: '—',
      submitAt: now().slice(11),
      updatedAt: now(),
    }
    rows('tasks').unshift(newTask)
    state.productionStarted = true
    touch('E3', '生产中', reason || `镜头 ${task.shot} 从「${previousStatus}」换模型为「${model}」，生成 take ${nextTake}`)
  } else if (action === 'acceptTake') {
    const task = byId('tasks', String(body.taskId ?? ''))
    if (task.project !== projectId || Number(task.ep) !== ep) {
      throw new MockHttpError(409, 'task_episode_mismatch', '任务不属于当前集')
    }
    task.status = '已通过'
    task.qc = 'PASS'
    task.updatedAt = now()
    const shot = rows('shots').find((row) => row.id === task.shotId || (row.project === projectId && Number(row.ep) === ep && row.no === task.shot))
    if (shot) {
      shot.status = '已通过'
      shot.version = `take ${task.take ?? 1}`
    }
    const shots = rows('shots').filter((row) => row.project === projectId && Number(row.ep) === ep)
    const allAccepted = shots.length > 0 && shots.every((row) => String(row.status) === '已通过')
    if (allAccepted) {
      touch('E4', '后期', reason || '本集镜头素材已全部接受，进入剪辑')
    } else {
      touch('E3', '生产中', reason || `接受镜头 ${task.shot} take ${task.take ?? 1}`)
    }
  } else if (action === 'advanceQueue') {
    if (!state.productionStarted) throw new MockHttpError(409, 'episode_production_gate', '请先启动本集素材生产')
    const tasks = rows('tasks').filter(
      (row) => row.project === projectId && Number(row.ep) === ep && !['已替代', '已取消'].includes(String(row.status)),
    )
    if (!tasks.length) throw new MockHttpError(409, 'episode_task_empty', '本集没有可推进的任务')
    let accepted = 0
    for (const task of tasks) {
      if (String(task.status) === '已通过') continue
      task.status = '已通过'
      task.qc = 'PASS'
      task.updatedAt = now()
      const shot = rows('shots').find(
        (row) => row.id === task.shotId || (row.project === projectId && Number(row.ep) === ep && row.no === task.shot),
      )
      if (shot) {
        shot.status = '已通过'
        shot.version = `take ${task.take ?? 1}`
      }
      accepted += 1
    }
    touch('E4', '后期', reason || `本集队列已推进 ${accepted} 个任务，镜头素材齐备，进入 E4`)
  } else if (action === 'buildTimeline') {
    requireStep('E4')
    const existing = rows('timelines').find((row) => row.project === projectId && Number(row.ep) === ep)
    if (existing) {
      state.timelineLocked = false
      ensureTimelineClips(projectId, ep, existing.version)
      touch('E4', '后期', reason || `复用已有时间线 ${existing.version}`)
    } else {
      const shots = rows('shots').filter((row) => row.project === projectId && Number(row.ep) === ep)
      const accepted = rows('tasks').filter(
        (row) => row.project === projectId && Number(row.ep) === ep && String(row.status) === '已通过',
      )
      const version = `TL-${project.id.replace(/^SP-/, '')}-E${pad2(ep)}-V1`
      rows('timelines').unshift({
        project: projectId,
        ep,
        version,
        tracks: 6,
        clips: accepted.length || shots.length,
        duration: episode.duration ?? `${shots.reduce((sum, row) => sum + Number(String(row.duration ?? '').replace(/[^\d]/g, '')), 0)} 秒`,
        timebase: 'PTS + 1/25 时基',
        status: '已输出',
        stale: 0,
        locked: false,
        builtAt: now(),
      })
      ensureTimelineClips(projectId, ep, version)
      state.timelineLocked = false
      touch('E4', '后期', reason || `按 ${shots.length} 镜建立单集时间线 ${version}`)
    }
  } else if (action === 'replaceClip') {
    requireStep('E4')
    const timeline = rows('timelines').find((row) => row.project === projectId && Number(row.ep) === ep)
    if (!timeline) throw new MockHttpError(409, 'episode_timeline_missing', '请先生成时间线')
    const clip = rows('timelineClips').find(
      (row) => row.project === projectId && Number(row.ep) === ep && String(row.id) === String(body.clipId ?? ''),
    )
    if (!clip) throw new MockHttpError(404, 'episode_clip_missing', '时间线片段不存在')
    const model = String(body.model ?? state.modelBaseline ?? '视频模型 A')
    const shot = rows('shots').find((row) => row.id === clip.shotId)
    const latestTask = rows('tasks')
      .filter((row) => row.project === projectId && Number(row.ep) === ep && row.shotId === clip.shotId)
      .sort((a, b) => Number(b.take ?? 1) - Number(a.take ?? 1))[0]
    const take = Number(latestTask?.take ?? 1) + 1
    rows('tasks').unshift({
      ...(latestTask ?? {}),
      id: nextId('T', 'tasks'),
      project: projectId,
      ep,
      shotId: clip.shotId,
      scene: shot?.scene ?? clip.scene,
      shot: shot?.no ?? clip.shot,
      kind: '视频生成',
      stage: '视频生产',
      status: '已通过',
      qc: 'PASS',
      model,
      take,
      parentTask: latestTask?.id ?? '',
      attempt: 1,
      actual: Number(shot?.duration ?? clip.duration ?? '5').toString().replace(/[^\d]/g, '') || 5,
      failReason: '—',
      updatedAt: now(),
    })
    clip.source = `T${take} · ${model}`
    clip.status = '待重建'
    clip.stale = true
    clip.replacedAt = now()
    timeline.stale = rows('timelineClips').filter((row) => row.timeline === timeline.version && row.stale).length
    timeline.status = '待重建'
    timeline.locked = false
    state.timelineLocked = false
    touch('E4', '后期', reason || `片段 ${clip.shot} 替换为 T${take} · ${model}，时间线待重建`)
  } else if (action === 'rebuildTimeline') {
    requireStep('E4')
    const timeline = rows('timelines').find((row) => row.project === projectId && Number(row.ep) === ep)
    if (!timeline) throw new MockHttpError(409, 'episode_timeline_missing', '请先生成时间线')
    const clips = rows('timelineClips').filter((row) => row.timeline === timeline.version && row.stale)
    if (!clips.length) return ok({ state, message: '时间线没有待重建片段' })
    for (const clip of clips) {
      clip.status = '已对齐'
      clip.stale = false
      clip.rebuiltAt = now()
    }
    timeline.stale = 0
    timeline.status = '已输出'
    timeline.rebuilds = Number(timeline.rebuilds ?? 0) + 1
    timeline.rebuiltAt = now()
    timeline.locked = false
    state.timelineLocked = false
    touch('E4', '后期', reason || `重建时间线 ${timeline.version}，${clips.length} 个片段已对齐`)
  } else if (action === 'lockTimeline') {
    requireStep('E4')
    const timeline = rows('timelines').find((row) => row.project === projectId && Number(row.ep) === ep)
    if (!timeline) throw new MockHttpError(409, 'episode_timeline_missing', '请先生成时间线')
    timeline.status = '已输出'
    timeline.stale = 0
    timeline.locked = true
    timeline.lockedAt = now()
    state.timelineLocked = true
    touch('E5', '声音字幕', reason || `时间线 ${timeline.version} 已锁定，进入声音字幕`)
  } else if (action === 'generateAudio') {
    requireStep('E5')
    const shots = rows('shots').filter((row) => row.project === projectId && Number(row.ep) === ep)
    const lines = shots.filter((row) => String(row.line ?? '').trim() && String(row.line) !== '—')
    let created = 0
    for (const shot of lines) {
      const text = String(shot.line)
      const exists = rows('dialogues').find((row) => row.project === projectId && Number(row.ep) === ep && String(row.text) === text)
      if (exists) {
        exists.audio = '已生成 v1'
        exists.status = '已通过'
        exists.asr = '回听一致'
        continue
      }
      const dialogue = {
        id: nextId('DL', 'dialogues'),
        project: projectId,
        ep,
        char: shot.chars ?? '角色',
        text,
        voice: `${shot.chars ?? '角色'} · 声音档案`,
        emotion: shot.emotion ?? '克制',
        audio: '已生成 v1',
        asr: '回听一致',
        status: '已通过',
        cost: 3.2,
      }
      rows('dialogues').unshift(dialogue)
      created += 1
    }
    const epDialogues = rows('dialogues').filter((row) => row.project === projectId && Number(row.ep) === ep)
    if (!epDialogues.length) throw new MockHttpError(409, 'episode_dialogue_empty', '本集没有可配音的对白')
    let subtitle = rows('subtitles').find((row) => row.project === projectId && Number(row.ep) === ep)
    if (!subtitle) {
      subtitle = {
        project: projectId,
        ep,
        version: `SUB-${pad2(ep)} v1`,
        lines: epDialogues.length,
        timeline: '整数毫秒 · 待校对',
        asr: '待校对',
        style: '字号 34 / 安全区 12% / 单行 14 字',
        status: '待校对',
      }
      rows('subtitles').unshift(subtitle)
    }
    state.audioGenerated = true
    state.subtitleApproved = false
    state.lipSyncPassed = false
    touch('E5', '声音字幕', reason || `生成 ${epDialogues.length} 条对白音频与字幕初稿${created ? `，新建 ${created} 条` : ''}`)
  } else if (action === 'approveSubtitle') {
    requireStep('E5')
    if (!state.audioGenerated) throw new MockHttpError(409, 'episode_audio_gate', '请先生成对白音频与字幕')
    const subtitle = rows('subtitles').find((row) => row.project === projectId && Number(row.ep) === ep)
    if (!subtitle) throw new MockHttpError(409, 'episode_subtitle_missing', '本集没有字幕版本')
    subtitle.status = '已通过'
    subtitle.asr = '错字 0 · 校对完成'
    subtitle.timeline = '整数毫秒 · 无累计漂移'
    state.subtitleApproved = true
    touch('E5', '声音字幕', reason || `字幕 ${subtitle.version} 校对通过`)
  } else if (action === 'runLipSync') {
    requireStep('E5')
    if (!state.audioGenerated) throw new MockHttpError(409, 'episode_audio_gate', '请先生成对白音频')
    const epDialogues = rows('dialogues').filter((row) => row.project === projectId && Number(row.ep) === ep)
    if (!epDialogues.length) throw new MockHttpError(409, 'episode_dialogue_empty', '本集没有可校验的对白')
    let created = 0
    for (const line of epDialogues) {
      const exists = rows('lipSync').find((row) => row.line === line.id)
      if (exists) {
        exists.status = '已通过'
        exists.match = '96% 帧对齐'
        continue
      }
      const shot = rows('shots').find((row) => row.project === projectId && Number(row.ep) === ep && String(row.line) === String(line.text))
      rows('lipSync').unshift({
        id: nextId('LS', 'lipSync'),
        line: line.id,
        shot: shot?.id ?? '',
        model: 'Lip Model L1',
        match: '96% 帧对齐',
        duration: shot?.duration ?? '—',
        status: '已通过',
        cost: 4.1,
      })
      created += 1
    }
    state.lipSyncPassed = true
    touch('E5', '声音字幕', reason || `口型同步 ${epDialogues.length} 条通过${created ? `，新建 ${created} 条` : ''}`)
  } else if (action === 'checkMix') {
    requireStep('E5')
    if (!state.audioGenerated || !state.subtitleApproved || !state.lipSyncPassed) {
      throw new MockHttpError(409, 'episode_audio_gate', '对白、字幕与口型未全部就绪，不能混音')
    }
    state.mixPassed = true
    rows('audioAssets').unshift({
      id: nextId('AU', 'audioAssets'),
      project: projectId,
      type: '混音',
      name: `第 ${ep} 集混音母版`,
      source: '单集混音检查',
      rights: '项目内使用',
      used: `第 ${ep} 集`,
      mix: '对白 −16 LUFS / 音乐 −18 LUFS',
      status: '已通过',
      validUntil: '2027-12-31',
    })
    touch('E6', '质检', reason || '混音检查通过，进入单集 QC')
  } else if (action === 'runEpisodeQc') {
    requireStep('E6')
    if (!state.mixPassed) throw new MockHttpError(409, 'episode_mix_gate', '请先完成混音检查')
    const result = 'PASS'
    const report = {
      id: nextId('QR', 'qualityReports'),
      project: projectId,
      object: `第 ${ep} 集成片`,
      level: '单集级',
      version: `EP${pad2(ep)} v1`,
      result,
      items: 42,
      issues: 0,
      review: 0,
      fail: 0,
      engine: '质检模型 Q1（独立检测能力）',
      at: now(),
      note: reason || '单集 QC 执行完成；音画、字幕、时长与安全区通过',
    }
    rows('qualityReports').unshift(report)
    episode.qc = 'PASS'
    touch('E6', '质检', reason || `单集 QC ${report.id} 通过，待确认`)
  } else if (action === 'failEpisodeQc') {
    requireStep('E6')
    if (!state.mixPassed) throw new MockHttpError(409, 'episode_mix_gate', '请先完成混音检查')
    const profiles = ensureQualityProfiles()
    const profile = profiles.find((item) => item.id === String(body.profile ?? '')) ?? profiles[0]
    const report = {
      id: nextId('QR', 'qualityReports'),
      project: projectId,
      ep,
      object: `${project.id} / 第 ${ep} 集成片`,
      level: '单集级',
      version: `EP${pad2(ep)} v1`,
      result: 'FAIL',
      items: 42,
      issues: 1,
      review: 0,
      fail: 1,
      engine: '质检模型 Q1（独立检测能力）',
      at: now(),
      note: reason || `单集 QC 阻断：${String(profile.name ?? '字幕与口型')}`,
    }
    rows('qualityReports').unshift(report)
    rows('qualityIssues').unshift({
      id: nextId('QI', 'qualityIssues'),
      report: report.id,
      dim: String(profile.dim ?? '字幕与口型'),
      where: String(profile.where ?? `E${pad2(ep)} / S01 / SH-01 · 00:03`).replace('{ep}', pad2(ep)),
      level: String(profile.level ?? '高'),
      action: String(profile.action ?? '退回 E5 校对字幕并重做口型；复检通过后再确认 QC'),
      auto: '是',
      profile: String(profile.id ?? ''),
    })
    state.qcPassed = false
    episode.qc = 'FAIL'
    touch('E6', '质检', reason || `单集 QC ${report.id} 阻断，等待退回返工`)
  } else if (action === 'acceptEpisodeQc') {
    requireStep('E6')
    const report = rows('qualityReports').find(
      (row) => row.project === projectId && String(row.object ?? '').includes(`第 ${ep} 集`) && !row.archived,
    )
    if (!report) throw new MockHttpError(409, 'episode_qc_missing', '请先执行单集 QC')
    if (String(report.result) === 'FAIL') throw new MockHttpError(409, 'episode_qc_failed', 'QC 存在阻断项，需返工后再确认')
    state.qcPassed = true
    episode.qc = 'PASS'
    touch('E7', '已通过质检', reason || `单集 QC ${report.id} 已确认通过，进入终审入库`)
  } else if (action === 'reworkEpisode') {
    const target = String(body.target ?? 'E5')
    if (!['E4', 'E5'].includes(target)) throw new MockHttpError(422, 'episode_rework_target', '返工目标只能是 E4 或 E5')
    const latestReport = rows('qualityReports').find(
      (row) => row.project === projectId && String(row.object ?? '').includes(`第 ${ep} 集`) && !row.archived,
    )
    if (latestReport) {
      latestReport.archived = true
      latestReport.archivedAt = now()
    }
    rows('reworkLedger').unshift({
      id: nextId('RW', 'reworkLedger'),
      project: projectId,
      ep,
      target: target === 'E4' ? '单集时间线 / 剪辑' : '声音字幕',
      type: target === 'E4' ? '剪辑返工' : '音频字幕返工',
      round: 1,
      cost: target === 'E4' ? 18 : 12,
      old: '上一版本保留',
      report: body.report ? String(body.report) : '',
      note: reason || '单集 QC 退回返工',
      status: '进行中',
      at: now(),
      createdAt: now(),
    })
    state.qcPassed = false
    state.mixPassed = false
    if (target === 'E4') {
      state.timelineLocked = false
      const timeline = rows('timelines').find((row) => row.project === projectId && Number(row.ep) === ep)
      if (timeline) {
        timeline.locked = false
        timeline.stale = Math.max(1, Number(timeline.stale ?? 0))
        timeline.status = '待重建'
        const clip = rows('timelineClips').find(
          (row) => row.timeline === timeline.version && Number(row.ep) === ep,
        )
        if (clip) {
          clip.stale = true
          clip.status = '待重建'
        }
      }
    } else {
      state.subtitleApproved = false
      state.lipSyncPassed = false
    }
    touch(target, target === 'E4' ? '后期' : '声音字幕', reason || `单集 QC 退回 ${target} 返工`)
  } else if (action === 'approveEpisode') {
    requireStep('E7')
    if (!state.qcPassed) throw new MockHttpError(409, 'episode_qc_gate', '单集 QC 未通过，不能终审')
    rows('reviews').unshift({
      id: nextId('RV', 'reviews'),
      project: projectId,
      node: '单集终审',
      object: `第 ${ep} 集成片`,
      version: `EP${pad2(ep)}`,
      auditor: String(currentIdentity().name ?? '').split(' · ')[0],
      role: '终审人',
      at: now(),
      result: '通过',
      note: reason || '单集终审通过',
      positions: '本集全篇',
      tasks: '生成单集交付包',
      follow: '入库',
    })
    state.finalApproved = true
    episode.status = '已输出'
    touch('E7', '已输出', reason || '单集终审通过')
  } else if (action === 'packageEpisode') {
    requireStep('E7')
    if (!state.finalApproved) throw new MockHttpError(409, 'episode_final_gate', '请先完成单集终审')
    const delivery = {
      id: `DP-${project.id.replace(/^SP-/, '')}-EP${pad2(ep)}`,
      project: projectId,
      ep,
      kind: '单集包',
      version: `EP${pad2(ep)}`,
      episodes: 1,
      files: 1,
      size: '0.42 GB',
      checksum: `sha256:${project.id.toLowerCase()}-ep${pad2(ep)}…mock`,
      reviewer: String(currentIdentity().name ?? '').split(' · ')[0],
      at: now(),
      status: '已交付',
      receiver: String(body.receiver ?? '企业内容库'),
      frozen: true,
    }
    rows('deliveries').unshift(delivery)
    state.delivered = true
    episode.status = '已交付'
    touch('E7', '已交付', reason || `单集包 ${delivery.id} 已冻结并入库`)
  } else {
    throw new MockHttpError(422, 'episode_action_unknown', `未知的单集动作 ${action}`)
  }

  syncProjectStatus(project, ensureEpisodeStates(projectId))
  store.persist()
  return ok({ state, episode, message: `${action} 已完成` })
}

/* ------------------------------------------------------------------ *
 * 通用集合路由
 * ------------------------------------------------------------------ */

interface Collection {
  path: string
  table: string
  field?: string
  prefix?: string
  search?: string[]
  defaults?: Row
  /** 列表默认条数，宽表必须限流，避免把 650 条镜头一次塞给前端 */
  limit?: number
}

const COLLECTIONS: Collection[] = [
  { path: '/projects', table: 'projects', prefix: 'SP', search: ['name', 'id', 'genre', 'owner'] },
  { path: '/project-states', table: 'projectStates', field: 'name' },
  { path: '/stage-pipeline', table: 'stagePipeline', field: 'key' },
  { path: '/briefs', table: 'briefs', prefix: 'BR' },
  { path: '/brief-modes', table: 'briefModes', field: 'key' },
  { path: '/creative-plans', table: 'creativePlans', prefix: 'CP' },
  { path: '/scripts', table: 'scripts', prefix: 'SCR' },
  { path: '/script-diffs', table: 'scriptDiff', field: 'id' },
  { path: '/episodes', table: 'episodes', field: 'no', limit: 40 },
  { path: '/scenes', table: 'scenes', prefix: 'SC' },
  { path: '/characters', table: 'characters', prefix: 'CH' },
  { path: '/locations', table: 'locations', prefix: 'LC' },
  { path: '/props', table: 'props', prefix: 'PR' },
  { path: '/storyboard-plans', table: 'plans', prefix: 'PP' },
  { path: '/shots', table: 'shots', limit: 60 },
  { path: '/dialogues', table: 'dialogues', prefix: 'DL' },
  { path: '/voice-profiles', table: 'voiceProfiles', prefix: 'VO' },
  { path: '/audio-assets', table: 'audioAssets', prefix: 'AU' },
  { path: '/subtitles', table: 'subtitles', limit: 40 },
  { path: '/lip-sync', table: 'lipSync', prefix: 'LS' },
  { path: '/generation-tasks', table: 'tasks', prefix: 'T', limit: 80 },
  { path: '/task-attempts', table: 'attempts', prefix: 'AT' },
  { path: '/invocations', table: 'invocations', prefix: 'IV' },
  { path: '/quality-levels', table: 'qualityLevels', field: 'level' },
  { path: '/quality-matrix', table: 'qualityMatrix', field: 'item' },
  { path: '/quality-reports', table: 'qualityReports', prefix: 'QR' },
  { path: '/quality-issues', table: 'qualityIssues', prefix: 'QI' },
  { path: '/rework', table: 'reworkLedger', prefix: 'RW' },
  { path: '/reviews', table: 'reviews', prefix: 'RV' },
  { path: '/review-checklist', table: 'reviewChecklist', field: 'item' },
  { path: '/timelines', table: 'timelines', field: 'version' },
  { path: '/tracks', table: 'tracks', field: 'name' },
  { path: '/deliveries', table: 'deliveries', prefix: 'DP' },
  { path: '/delivery-checklist', table: 'deliveryChecklist', field: 'item' },
  { path: '/works', table: 'works', prefix: 'WK' },
  { path: '/asset-categories', table: 'assetCategories', field: 'name' },
  { path: '/assets', table: 'assets', prefix: 'A', search: ['name', 'id', 'cat', 'type'] },
  { path: '/usage', table: 'usage', prefix: 'US' },
  { path: '/budgets', table: 'budgets', field: 'scope' },
  { path: '/budget-rules', table: 'budgetRules', field: 'item' },
  { path: '/costs', table: 'costs', prefix: 'CR', search: ['project', 'task', 'cap'] },
  { path: '/cost-dimensions', table: 'costDimensions', field: 'name' },
  { path: '/providers', table: 'providers', prefix: 'PRV', search: ['name', 'kind'] },
  { path: '/model-profiles', table: 'modelProfiles', prefix: 'MP' },
  { path: '/call-logs', table: 'callLogs', prefix: 'CL' },
  { path: '/capabilities', table: 'capabilities', field: 'cap' },
  { path: '/video-capabilities', table: 'videoCapabilities', field: 'item' },
  { path: '/post-capabilities', table: 'postCapabilities', field: 'item' },
  { path: '/rights', table: 'rights', prefix: 'RT' },
  { path: '/risks', table: 'risks', prefix: 'RK' },
  { path: '/audit-logs', table: 'audits', field: 'time', search: ['object', 'action', 'actor'] },
  { path: '/notifications', table: 'notifications', prefix: 'N', search: ['title', 'project', 'type'] },
  { path: '/incidents', table: 'incidents', prefix: 'IN' },
  { path: '/departments', table: 'departments', field: 'id' },
  { path: '/users', table: 'users', field: 'id' },
  { path: '/members', table: 'users', field: 'id' },
  { path: '/roles', table: 'roles', field: 'code' },
  { path: '/identities', table: 'identities', field: 'id' },
]

const collectionByPath = new Map(COLLECTIONS.map((item) => [item.path, item]))

function listRows(collection: Collection, query: URLSearchParams): Envelope {
  let list = rows(collection.table)
  const reserved = new Set(['q', 'limit', 'page', 'page_size', 'project_id', 'projectId', 'all'])

  query.forEach((value, key) => {
    if (reserved.has(key) || !value) return
    const normalized = key.replace(/_([a-z])/g, (_, c) => String(c).toUpperCase())
    if (!(normalized in (list[0] ?? {})) && !rows(collection.table).some((row) => normalized in row)) return
    list = list.filter((row) => String(row[normalized] ?? '') === value)
  })

  const project = query.get('project') ?? query.get('project_id') ?? query.get('projectId')
  if (project) list = list.filter((row) => String(row.project ?? '') === project)

  const q = (query.get('q') ?? '').trim().toLowerCase()
  if (q) {
    const fields = collection.search ?? ['id', 'name', 'title']
    list = list.filter((row) => fields.some((field) => String(row[field] ?? '').toLowerCase().includes(q)))
  }

  const limit = Number(query.get('limit') ?? query.get('page_size') ?? collection.limit ?? 200)
  const page = Math.max(1, Number(query.get('page') ?? 1))
  const total = list.length
  const sliced = list.slice((page - 1) * limit, page * limit)
  return ok(sliceRows(collection.table, sliced), { page, page_size: limit, total })
}

/** tracks/subtitles/timelines 这些行没有 id，真实 API 也会返回稳定 id，这里补一个只读 id。 */
function sliceRows(table: string, list: Row[]): Row[] {
  return list.map((row) => {
    if (row.id) return row
    const composite = [table, row.project, row.ep ?? row.no ?? row.version ?? row.name ?? row.scope].filter(Boolean).join(':')
    return { ...row, id: composite }
  })
}

function createRow(collection: Collection, body: Row): Envelope {
  const defaults = collection.defaults ?? {}
  const row: Row = {
    ...defaults,
    ...body,
    id: body.id ?? nextId(collection.prefix ?? 'X', collection.table),
    createdAt: now(),
  }
  rows(collection.table).unshift(row)
  store.persist()
  return ok(row)
}

function patchRow(collection: Collection, id: string, body: Row): Envelope {
  const field = collection.field ?? 'id'
  const row = byId(collection.table, id, field)
  Object.assign(row, body, { updatedAt: now() })
  store.persist()
  return ok(row)
}

function deleteRow(collection: Collection, id: string): Envelope {
  const field = collection.field ?? 'id'
  const list = rows(collection.table)
  const index = list.findIndex((row) => String(row[field]) === id)
  if (index >= 0) list.splice(index, 1)
  store.persist()
  return ok({ id, deleted: index >= 0 })
}

/* ------------------------------------------------------------------ *
 * 领域动作
 * ------------------------------------------------------------------ */

function assetReferenceKind(asset: Row): string {
  const cat = String(asset.cat ?? '')
  if (cat.includes('成片')) return '成片引用'
  if (cat.includes('字幕')) return '字幕轨引用'
  if (cat.includes('创意')) return '剧本引用'
  if (cat.includes('音频')) return '音频轨引用'
  if (cat.includes('分镜')) return '镜头参考'
  return '镜头参考'
}

/** 资产引用关系：有镜头数据时返回真实镜头对象，其余按资产类型补项目/分集/交付引用。 */
function assetReferences(id: string): Envelope {
  const asset = byId('assets', id)
  const total = Math.max(0, Number(asset.refs ?? 0))
  if (!total) return ok([], { total: 0 })

  const project = rows('projects').find((row) => row.id === asset.project)
  const projectName = String(project?.name ?? asset.project ?? '未归属项目')
  const useShots = !['成片', '字幕', '创意'].some((token) => String(asset.cat ?? '').includes(token))
  const shots = useShots
    ? rows('shots').filter((row) => row.project === asset.project).slice(0, Math.min(total, 3))
    : []
  const result: Row[] = shots.map((shot) => ({
    asset: asset.id,
    project: asset.project,
    projectName,
    object: shot.id,
    kind: assetReferenceKind(asset),
    detail: shot.desc ?? '镜头契约引用',
    status: shot.status ?? '—',
    at: asset.at ?? '—',
  }))
  const fallback = [
    { object: `${projectName} / 项目资产库`, kind: '项目引用', detail: '项目级资产登记与共享引用' },
    { object: `${projectName} / 第 ${Number(project?.done ?? 0) + 1} 集`, kind: assetReferenceKind(asset), detail: '当前制作集引用' },
    { object: `${projectName} / 交付包`, kind: '交付引用', detail: '交付清单与回查引用' },
  ]
  while (result.length < Math.min(total, 3)) {
    const item = fallback[result.length]
    result.push({
      asset: asset.id,
      project: asset.project,
      projectName,
      object: item.object,
      kind: item.kind,
      detail: item.detail,
      status: asset.status ?? '—',
      at: asset.at ?? '—',
    })
  }
  return ok(result, { total })
}

function createAsset(body: Row): Envelope {
  const name = String(body.name ?? '').trim()
  const cat = String(body.cat ?? '').trim()
  const type = String(body.type ?? '').trim()
  const origin = String(body.origin ?? '').trim()
  const rights = String(body.rights ?? '').trim()
  if (!name) throw new MockHttpError(422, 'asset_name_required', '请填写资产名')
  if (!cat) throw new MockHttpError(422, 'asset_category_required', '请选择资产分类')
  if (!type) throw new MockHttpError(422, 'asset_type_required', '请填写资产类型')
  if (!origin) throw new MockHttpError(422, 'asset_origin_required', '请填写资产来源或生成方式')
  if (!rights) throw new MockHttpError(422, 'asset_rights_required', '请填写授权标记')
  const expiry = String(body.rightsExpiry ?? '').trim()
  if (expiry && expiry < now().slice(0, 10)) {
    throw new MockHttpError(422, 'asset_rights_expired', `授权到期日 ${expiry} 早于今天`)
  }

  const row: Row = {
    ...body,
    id: String(body.id ?? nextId('A', 'assets')),
    name,
    cat,
    type,
    origin,
    rights,
    version: String(body.version ?? 'v1'),
    versions: Number(body.versions ?? 1),
    qc: String(body.qc ?? '待检'),
    status: String(body.status ?? '待检'),
    refs: Number(body.refs ?? 0),
    formal: Boolean(body.formal ?? false),
    creator: String(body.creator ?? currentIdentity().name ?? '当前用户'),
    executor: String(body.executor ?? currentIdentity().name ?? '当前用户'),
    checksum: String(body.checksum ?? `sha256:${Math.random().toString(16).slice(2, 10)}`),
    at: String(body.at ?? now()),
    createdAt: now(),
  }
  rows('assets').unshift(row)
  store.persist()
  return ok(row)
}

function providerVerified(provider: Row): Row {
  provider.test = `已验证 · ${now()}`
  provider.testedAt = now()
  return provider
}

function providerAudit(provider: Row, action: string): void {
  rows('audits').unshift({
    id: nextId('AUD', 'audits'),
    time: now(),
    actor: String(currentIdentity().name ?? '').split(' · ')[0],
    object: `供应商 ${provider.id}`,
    action,
    result: '成功',
    src: '本地 mock · 桌面端',
    link: String(provider.id),
  })
}

function testProvider(id: string): Envelope {
  const provider = byId('providers', id)
  const blocked = providerTestBlockReason(provider)
  if (blocked) throw new MockHttpError(409, 'provider_test_blocked', blocked)
  providerVerified(provider)
  providerAudit(provider, '测试连通性')
  store.persist()
  return ok(provider)
}

function testAllProviders(): Envelope {
  const tested: Row[] = []
  const skipped: Row[] = []
  for (const provider of rows('providers')) {
    if (providerTestBlockReason(provider)) {
      skipped.push(provider)
      continue
    }
    providerVerified(provider)
    tested.push(provider)
  }
  if (tested.length) {
    rows('audits').unshift({
      id: nextId('AUD', 'audits'),
      time: now(),
      actor: String(currentIdentity().name ?? '').split(' · ')[0],
      object: '供应商批量测试',
      action: `测试连通性（${tested.length} 个成功，${skipped.length} 个跳过）`,
      result: '成功',
      src: '本地 mock · 桌面端',
      link: 'models/providers',
      reason: skipped.length ? `已停用跳过：${skipped.map((row) => row.name).join('、')}` : '',
    })
  }
  store.persist()
  return ok({ tested: tested.length, skipped: skipped.length, skippedNames: skipped.map((row) => row.name) })
}

function createModelProfile(body: Row): Envelope {
  const blocked = modelProfileCreateBlockReason(body, rows('providers'), rows('modelProfiles'), rows('capabilities'))
  if (blocked) throw new MockHttpError(422, 'model_profile_blocked', blocked)
  const provider = rows('providers').find((row) => String(row.id) === String(body.provider))
  const row: Row = {
    ...body,
    id: String(body.id ?? nextId('MP', 'modelProfiles', 2)),
    provider: String(body.provider),
    providerName: provider?.name ?? body.provider,
    model: String(body.model).trim(),
    cap: String(body.cap).trim(),
    status: String(body.status ?? '启用'),
    updatedAt: now(),
    note: String(body.note ?? '新增模型档案；已完成必填与供应商状态校验'),
  }
  rows('modelProfiles').unshift(row)
  rows('audits').unshift({
    id: nextId('AUD', 'audits'),
    time: now(),
    actor: String(currentIdentity().name ?? '').split(' · ')[0],
    object: `模型 ${row.id}`,
    action: `新增档案（${row.providerName} · ${row.model} · ${row.cap}）`,
    result: '成功',
    src: '本地 mock · 桌面端',
    link: String(row.id),
    reason: body.reason ?? '',
  })
  store.persist()
  return ok(row)
}

function routeImpact(capName: string): Envelope {
  const cap = byId('capabilities', capName, 'cap')
  const impacted = routeImpactTasks(rows('tasks'), capName)
  return ok({
    cap: cap.cap,
    total: impacted.length,
    running: impacted.filter((task) => task.status === '执行中').length,
    queued: impacted.filter((task) => ['待执行', '排队中'].includes(String(task.status))).length,
    manual: impacted.filter((task) => task.status === '待人工处理').length,
    tasks: impacted.map((task) => ({ id: task.id, project: task.project, status: task.status, kind: task.kind })),
  })
}

function updateCapabilityRoute(capName: string, body: Row): Envelope {
  const cap = byId('capabilities', capName, 'cap')
  const draft = {
    primaryId: String(body.primaryId ?? ''),
    backupId: String(body.backupId ?? ''),
    fallback: String(body.fallback ?? ''),
    reason: String(body.reason ?? ''),
  }
  const blocked = routeEditBlockReason(capName, draft, rows('modelProfiles'), rows('providers'))
  if (blocked) throw new MockHttpError(422, 'route_blocked', blocked)
  const primary = rows('modelProfiles').find((row) => String(row.id) === draft.primaryId)!
  const backup = draft.backupId ? rows('modelProfiles').find((row) => String(row.id) === draft.backupId) : undefined
  const previous = `${cap.routePrimary || '未配置'}${cap.routeBackup ? ` / ${cap.routeBackup}` : ''}`
  cap.routePrimaryId = primary.id
  cap.routePrimary = `${primary.id} · ${primary.model}`
  cap.routeBackupId = backup?.id ?? ''
  cap.routeBackup = backup ? `${backup.id} · ${backup.model}` : ''
  cap.routeFallback = draft.fallback
  cap.routeMode = backup ? '自动降级' : '单模型'
  cap.routeReason = draft.reason
  cap.routeUpdatedAt = now()
  cap.routeChangedBy = String(currentIdentity().name ?? '').split(' · ')[0]
  rows('audits').unshift({
    id: nextId('AUD', 'audits'),
    time: now(),
    actor: cap.routeChangedBy,
    object: `能力 ${cap.cap}`,
    action: `调整路由（${previous} → ${cap.routePrimary}${backup ? ` / ${backup.id}` : ' / 无备选'}）`,
    result: '成功',
    src: '本地 mock · 桌面端',
    link: String(cap.cap),
    reason: draft.reason,
  })
  store.persist()
  return ok(cap)
}

function workflow(id: string): Envelope {
  const project = projectOf(id)
  const states = ensureEpisodeStates(id)
  syncProjectStatus(project, states)
  const permissions = currentPermissions()
  return ok({
    project,
    stages: stageChain(project),
    allowed_actions: allowedActions(project, permissions),
    progress: progressOf(project),
    kpis: [
      { label: '集数', value: `${project.done ?? 0} / ${project.episodes ?? 0}` },
      { label: '预算占用', value: `¥${Number(project.actual ?? 0).toLocaleString('zh-CN')}` },
      { label: '预算总额', value: `¥${Number(project.budget ?? 0).toLocaleString('zh-CN')}` },
      { label: '质量', value: project.quality ?? '—' },
    ],
  })
}

function transition(id: string, body: Row): Envelope {
  const project = projectOf(id)
  const actionKey = String(body.action ?? '')
  const action = (GATE_ACTIONS[project.status] ?? []).find((item) => item.key === actionKey)
  if (!action) throw new MockHttpError(409, 'illegal_transition', `状态「${project.status}」不允许动作 ${actionKey}`)
  if (!PROJECT_GOVERNANCE_ACTIONS.has(actionKey)) {
    throw new MockHttpError(409, 'project_stage_derived', '制作阶段由单集与批次进度自动推导，不再手动推进')
  }
  if (actionKey === 'archive') {
    const states = ensureEpisodeStates(id)
    const deliveredAll = states.length > 0 && states.every((state) => Boolean(state.delivered))
    const deliveredEnough = Number(project.delivered ?? 0) >= Number(project.episodes ?? 0)
    if (!deliveredAll && !deliveredEnough) {
      throw new MockHttpError(409, 'archive_requires_delivery', '项目尚有未交付单集，不能归档')
    }
  }
  if (!currentPermissions().includes(action.permission)) {
    throw new MockHttpError(403, 'forbidden', `当前身份缺少权限 ${action.permission}`)
  }
  if (action.needReason && !String(body.reason ?? '').trim()) {
    throw new MockHttpError(422, 'reason_required', '该动作必须填写原因')
  }
  if (actionKey === 'submitScript') {
    const versions = rows('scripts')
      .filter((row) => row.project === id)
      .sort((left, right) => Number(String(right.version ?? '').replace(/\D/g, '')) - Number(String(left.version ?? '').replace(/\D/g, '')))
    const script = versions.find((row) => !row.locked) ?? versions[0]
    if (!script) throw new MockHttpError(422, 'script_missing', '尚未建立剧本版本，不能提交审核')
    if (script.locked) throw new MockHttpError(409, 'script_locked', '正式版本已锁定，不能再提交审核')
    const drafts = Array.isArray(script.episodeDrafts) ? script.episodeDrafts as DraftEpisode[] : []
    if (drafts.length < Number(project.episodes ?? 1)) {
      throw new MockHttpError(422, 'script_incomplete', `分集稿 ${drafts.length} / ${project.episodes} 集，补齐后才可提交审核`)
    }
    if (drafts.some((episode) => !episode.scenes?.length || episode.scenes.some((scene) => !scene.lines?.length))) {
      throw new MockHttpError(422, 'script_scene_incomplete', '存在无场次或无台词的集，补齐后才可提交审核')
    }
    script.status = '待审核'
    script.updatedAt = now()
    script.note = `${String(body.reason ?? script.note ?? '')} · 已提交审核`.trim()
  }

  if (actionKey === 'approveScript') {
    const versions = rows('scripts')
      .filter((row) => row.project === id)
      .sort((left, right) => Number(String(right.version ?? '').replace(/\D/g, '')) - Number(String(left.version ?? '').replace(/\D/g, '')))
    const script = versions.find((row) => !row.locked) ?? versions[0]
    if (!script) throw new MockHttpError(422, 'script_missing', '尚未建立剧本版本，不能通过审核')
    script.status = '已通过 · 正式版本'
    script.locked = true
    script.updatedAt = now()
    materializeEpisodes(project, script)
  }

  const from = project.status
  const next = action.next === '__prev__' ? String(project._prevStatus ?? '生产中') : action.next
  project._prevStatus = from
  project.status = next
  project.phase = stageChain(project).find((stage) => stage.state === 'now')?.name ?? project.phase
  project.updated = now()

  if (next === '已交付') {
    const placeholder = rows('deliveries').findIndex(
      (row) => row.project === project.id && String(row.status).startsWith('未生成'),
    )
    if (placeholder >= 0) rows('deliveries').splice(placeholder, 1)
    rows('deliveries').unshift(buildDelivery(project, { version: 'V1' }))
    project.delivered = project.episodes
  }

  rows('audits').unshift({
    id: nextId('AUD', 'audits'),
    time: now(),
    actor: String(currentIdentity().name ?? '').split(' · ')[0],
    object: `项目 ${project.id}`,
    action: `${action.label}（${from} → ${next}）`,
    result: '成功',
    src: '本地 mock · 桌面端',
    link: project.id,
    reason: body.reason ?? '',
  })
  rows('notifications').unshift({
    id: nextId('N', 'notifications'),
    type: next,
    project: project.id,
    title: `《${project.name}》${action.label}`,
    reason: body.reason ? String(body.reason) : `${from} → ${next}`,
    impact: '下游节点按新状态继续',
    state: '待处理',
    action: '查看流水线',
    owner: project.owner,
    link: 'projects/workflow',
    unread: true,
    at: now(),
  })
  store.persist()
  return ok({ project, allowed_actions: allowedActions(project, currentPermissions()), message: `${from} → ${next}` })
}

function projectTimeline(id: string): Envelope {
  const project = projectOf(id)
  const audits = rows('audits').filter((row) => row.object === `项目 ${project.id}` || row.link === project.id)
  const reviews = rows('reviews').filter((row) => row.project === id)
  const items = [
    ...audits.map((row) => ({ at: row.time, title: row.action, by: row.actor, kind: '动作', note: row.result })),
    ...reviews.map((row) => ({ at: row.at, title: `${row.node} · ${row.result}`, by: row.auditor, kind: '审核', note: row.note })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)))
  return ok(items)
}

function materializeEpisodes(project: Row, script: Row): number {
  const drafts = Array.isArray(script.episodeDrafts) ? script.episodeDrafts as DraftEpisode[] : []
  const existing = new Set(
    rows('episodes')
      .filter((row) => row.project === project.id)
      .map((row) => Number(row.no ?? 0)),
  )
  let created = 0
  const duration = String(project.duration ?? '80 秒 / 集').split('/')[0].trim()
  for (const draft of drafts) {
    const no = Number(draft.no ?? 0)
    if (!no || existing.has(no)) continue
    rows('episodes').push({
      project: project.id,
      no,
      batch: Math.ceil(no / BATCH_SIZE),
      title: draft.title,
      logline: draft.logline,
      hook: draft.hook,
      scenes: Array.isArray(draft.scenes) ? draft.scenes.length : 0,
      shots: 0,
      duration,
      status: '待生产',
      qc: '待检',
      timeline: '—',
      updatedAt: now(),
    })
    created += 1
  }
  if (created) ensureEpisodeStates(project.id)
  return created
}

function scriptReview(id: string, body: Row): Envelope {
  const script = byId('scripts', id)
  const result = String(body.result ?? '通过')
  const project = rows('projects').find((row) => row.id === script.project)
  script.status = result === '通过' ? '已通过 · 正式版本' : '已退回'
  script.locked = result === '通过'
  script.updatedAt = now()
  if (project && result === '通过') materializeEpisodes(project, script)
  rows('reviews').unshift({
    id: nextId('RV', 'reviews'),
    project: script.project,
    node: '剧本审核（节点 A）',
    object: script.id,
    version: script.version,
    auditor: String(currentIdentity().name ?? '').split(' · ')[0],
    role: currentIdentity().discriminator === 'admin' ? '企业管理员' : '项目负责人',
    at: now(),
    result,
    note: body.note ?? '',
    positions: '全篇',
    tasks: '下游按审核结论执行',
    follow: result === '通过' ? '进入导演规划' : '回退剧本修订',
  })
  if (project) {
    if (result === '通过' && project.status === '待剧本审核') {
      project._prevStatus = project.status
      project.status = '生产准备中'
      project.phase = '导演规划'
    } else if (result !== '通过' && project.status === '待剧本审核') {
      project._prevStatus = project.status
      project.status = '剧本创作中'
      project.phase = '剧本创作'
    }
  }
  store.persist()
  return ok({ script, project })
}

function createTask(body: Row): Envelope {
  const project = projectOf(String(body.project))
  const row: Row = {
    id: nextId('T', 'tasks'),
    project: project.id,
    ep: body.ep ?? 1,
    scene: body.scene ?? '01',
    shot: body.shot ?? 'SH-01',
    kind: body.kind ?? '视频生成',
    stage: body.stage ?? project.phase,
    status: '排队中',
    priority: body.priority ?? '中',
    deps: body.deps ?? [],
    parallelGroup: body.parallelGroup ?? `${project.id}-G1`,
    input: body.input ?? '—',
    output: body.output ?? 'MP4 1080×1920',
    model: body.model ?? (body.kind === '音频合成' ? '语音模型 V1' : body.kind === '口型校验' ? 'Lip Model L1' : '视频模型 A'),
    config: body.config ?? 'PRV-01',
    executor: body.executor ?? '林知远',
    resourceOwner: body.resourceOwner ?? '林知远',
    attempt: 1,
    maxAttempts: body.maxAttempts ?? 3,
    est: body.est ?? 30,
    actual: 0,
    failedCost: 0,
    submitAt: now().slice(11),
    failReason: '—',
    qc: '待检',
  }
  rows('tasks').unshift(row)
  rows('audits').unshift({
    id: nextId('AUD', 'audits'),
    time: now(),
    actor: '林知远',
    object: `项目 ${project.id} · ${row.shot}`,
    action: `提交任务 ${row.id}（${row.kind}）`,
    result: '成功',
    src: '本地 mock · 桌面端',
    link: row.id,
  })
  store.persist()
  return ok(row)
}

function taskAction(id: string, kind: 'retry' | 'cancel' | 'pause'): Envelope {
  const task = byId('tasks', id)
  if (kind === 'retry') {
    const status = String(task.status ?? '')
    if (!['失败', '待人工处理'].includes(status)) {
      throw new MockHttpError(409, 'task_retry_status', `任务 ${id} 当前为“${status || '未知'}”，只有失败或待人工处理任务可以重试`)
    }
    const attempt = Number(task.attempt ?? 1)
    const max = Math.max(1, Number(task.maxAttempts ?? 3))
    if (attempt >= max) {
      throw new MockHttpError(409, 'task_retry_limit', `任务 ${id} 已尝试 ${attempt}/${max} 次，达到上限`)
    }
    const reason = String(task.failReason ?? '')
    if (reason.includes('不可重试') || reason.includes('合规检测阻断')) {
      throw new MockHttpError(409, 'task_retry_blocked', `任务 ${id} 的失败原因不可直接重试，需修改输入或资产`)
    }
    task.attempt = attempt + 1
    task.status = '排队中'
    task.failReason = '—'
    rows('attempts').unshift({
      id: nextId('AT', 'attempts'),
      task: task.id,
      n: task.attempt,
      at: now(),
      status: '排队中',
      reason: '—',
      fail: '—',
      cost: 0,
      by: currentIdentity().name,
    })
  }
  if (kind === 'cancel') {
    if (['成功', '已完成', '已交付', '已取消'].includes(String(task.status ?? ''))) {
      throw new MockHttpError(409, 'task_cancel_status', `任务 ${id} 当前为“${task.status}”，不能取消`)
    }
    task.status = '已取消'
  }
  if (kind === 'pause') task.status = '已暂停'
  task.updatedAt = now()
  rows('audits').unshift({
    id: nextId('AUD', 'audits'),
    time: now(),
    actor: String(currentIdentity().name ?? '').split(' · ')[0],
    object: `任务 ${task.id}`,
    action: kind === 'retry' ? '重试任务' : kind === 'cancel' ? '取消任务' : '暂停任务',
    result: '成功',
    src: '本地 mock · 桌面端',
    link: String(task.id),
  })
  store.persist()
  return ok(task)
}

function runQuality(body: Row): Envelope {
  const project = projectOf(String(body.project ?? ''))
  const report: Row = {
    id: nextId('QR', 'qualityReports'),
    object: body.object ?? `${project.id} / 第 ${body.ep ?? 1} 集成片`,
    level: body.level ?? '单集级',
    version: body.version ?? `EP${body.ep ?? 1} v1`,
    result: body.result ?? 'PASS',
    items: 42,
    issues: Number(body.issues ?? 0),
    review: 1,
    fail: 0,
    engine: '质检模型 Q1（独立检测能力）',
    at: now(),
    note: body.note ?? '本地 mock 质检执行完成；阻断项 0。',
    project: project.id,
  }
  rows('qualityReports').unshift(report)
  store.persist()
  return ok(report)
}

function acceptQualityReport(id: string, body: Row): Envelope {
  const report = byId('qualityReports', id)
  if (String(report.result ?? '') === 'PASS') {
    throw new MockHttpError(409, 'report_already_passed', '该报告已通过，无需重复确认')
  }
  const issues = rows('qualityIssues').filter((row) => row.report === report.id)
  const high = issues.filter((row) => (
    String(row.level ?? '') === '高'
    && !['已修复', '已关闭', '已确认', '已豁免'].includes(String(row.status ?? '待处理'))
  ))
  if (high.length) {
    throw new MockHttpError(
      409,
      'high_risk_open',
      `报告仍有 ${high.length} 项高风险问题未关闭，请完成返工并重新质检后再通过`,
    )
  }
  if (!issues.length && Number(report.fail ?? 0) > 0) {
    throw new MockHttpError(409, 'issue_detail_missing', '报告有阻断项但问题明细未同步，暂不能通过')
  }
  report.result = 'PASS'
  report.review = 0
  report.fail = 0
  report.acceptedAt = now()
  report.acceptedBy = String(currentIdentity().name ?? '').split(' · ')[0]
  report.note = `${report.note ?? ''}｜人工确认通过：${body.note ?? '已核对问题项'}`
  store.persist()
  return ok(report)
}

function createRework(body: Row): Envelope {
  const project = projectOf(String(body.project ?? ''))
  const target = String(body.target ?? '').trim()
  const type = String(body.type ?? '').trim()
  if (!target) throw new MockHttpError(400, 'target_required', '请填写返工对象（镜头、分集或音频 ID）')
  if (!type) throw new MockHttpError(400, 'type_required', '请选择返工原因')
  const same = rows('reworkLedger').filter((row) => (
    row.project === project.id && String(row.target ?? '').trim() === target
  ))
  const active = same.find((row) => String(row.status ?? '') === '进行中')
  if (active) throw new MockHttpError(409, 'rework_active', `对象 ${target} 已有进行中的返工单 ${active.id}，完成或转人工后再创建`)
  const manual = same.find((row) => String(row.status ?? '') === '转人工')
  if (manual) throw new MockHttpError(409, 'rework_manual', `对象 ${target} 已有转人工返工单 ${manual.id}，需人工决策`)
  const maxRound = same.reduce((max, row) => Math.max(max, Number(row.round ?? 0)), 0)
  if (maxRound >= 3) throw new MockHttpError(409, 'rework_limit', `对象 ${target} 已返工 ${maxRound} 轮，达到 3 轮上限`)
  const budget = Number(project.budget ?? 0)
  const actual = Number(project.actual ?? 0)
  if (budget > 0 && actual >= budget) {
    throw new MockHttpError(409, 'budget_exhausted', `项目预算已用尽（¥${actual} / ¥${budget}），不能新建返工`)
  }
  const costByType: Record<string, number> = {
    人物不一致: 44,
    合规风险: 86.4,
    口型同步: 12,
    音频质量: 3.2,
    剪辑质量: 8,
  }
  const code = project.id.replace(/^SP-/, '')
  const maxSeq = rows('reworkLedger')
    .filter((row) => row.project === project.id)
    .reduce((max, row) => Math.max(max, Number(String(row.id ?? '').split('-').pop() ?? 0)), 0)
  const row: Row = {
    id: `RW-${code}-${String(maxSeq + 1).padStart(3, '0')}`,
    project: project.id,
    target,
    type,
    round: maxRound + 1,
    cost: costByType[type] ?? 20,
    old: '上一版本保留',
    report: body.report ? String(body.report) : '',
    note: body.note ? String(body.note) : '',
    status: '进行中',
    at: now(),
    createdAt: now(),
  }
  rows('reworkLedger').unshift(row)
  store.persist()
  return ok(row)
}

function outputEpisode(body: Row): Envelope {
  const project = projectOf(String(body.project ?? ''))
  const no = Number(body.episode ?? body.no ?? 0)
  const episode = rows('episodes').find((row) => row.project === project.id && Number(row.no) === no)
  if (!episode) throw new MockHttpError(404, 'episode_not_found', `未找到第 ${no} 集`)
  episode.status = '已输出'
  episode.updatedAt = now()
  store.persist()
  return ok(episode)
}

function rebuildTimeline(body: Row): Envelope {
  const project = projectOf(String(body.project ?? ''))
  const version = String(body.version ?? '')
  const timeline = rows('timelines').find((row) => row.project === project.id && String(row.version) === version)
  if (!timeline) throw new MockHttpError(404, 'timeline_not_found', `未找到时间线 ${version}`)
  timeline.stale = 0
  timeline.status = '已输出'
  timeline.rebuiltAt = now()
  store.persist()
  return ok(timeline)
}

function finalReview(body: Row): Envelope {
  const project = projectOf(String(body.project ?? ''))
  const result = String(body.result ?? '通过')
  rows('reviews').unshift({
    id: nextId('RV', 'reviews'),
    project: project.id,
    node: '最终成片审核（节点 B）',
    object: `DP-${project.id}-V1`,
    version: 'V1',
    auditor: String(currentIdentity().name ?? '').split(' · ')[0],
    role: '终审人',
    at: now(),
    result,
    note: body.note ?? '',
    positions: '全篇',
    tasks: result === '通过' ? '进入交付' : '退回后期',
    follow: result === '通过' ? '生成交付包' : '返工',
  })
  if (project.status === '待最终审核') {
    project._prevStatus = project.status
    project.status = result === '通过' ? '已完成' : '后期制作中'
    project.updated = now()
  }
  store.persist()
  return ok({ project })
}

function buildDelivery(project: Row, body: Row): Row {
  const seq = rows('deliveries').filter((row) => row.project === project.id && row.status === '已交付').length + 1
  return {
    id: `DP-${String(project.id).replace(/^SP-/, '')}-${String(seq).padStart(2, '0')}`,
    project: project.id,
    version: body.version ?? 'V1',
    episodes: body.episodes ?? project.episodes,
    files: body.files ?? project.episodes,
    size: body.size ?? `${(Number(project.episodes ?? 1) * 0.42).toFixed(1)} GB`,
    checksum: body.checksum ?? `sha256:${project.id.toLowerCase()}…mock`,
    reviewer: String(currentIdentity().name ?? '').split(' · ')[0],
    at: now(),
    status: '已交付',
    receiver: body.receiver ?? '企业内容库',
    frozen: true,
  }
}

function delivery(body: Row): Envelope {
  const project = projectOf(String(body.project ?? ''))
  const row = buildDelivery(project, body)
  rows('deliveries').unshift(row)
  if (project.status === '已完成') {
    project._prevStatus = project.status
    project.status = '已交付'
    project.delivered = project.episodes
    project.updated = now()
  }
  store.persist()
  return ok(row)
}

/* ------------------------------------------------------------------ *
 * 聚合视图
 * ------------------------------------------------------------------ */

function workspaceHome(): Envelope {
  const projects = rows('projects')
  const tasks = rows('tasks')
  const notifications = rows('notifications')
  const active = projects.filter((row) => !['已交付', '已归档', '已终止', '草稿'].includes(row.status))
  const running = tasks.filter((row) => ['执行中', '排队中'].includes(row.status))
  return ok({
    identity: currentIdentity(),
    permissions: currentPermissions(),
    metrics: [
      { label: '在制项目', value: active.length, hint: `共 ${projects.length} 个` },
      { label: '运行任务', value: running.length, hint: `失败 ${tasks.filter((row) => row.status === '失败').length}` },
      { label: '待处理', value: notifications.filter((row) => row.unread).length, hint: '待办与通知' },
      { label: '预算占用', value: `¥${projects.reduce((sum, row) => sum + Number(row.actual ?? 0), 0).toLocaleString('zh-CN')}`, hint: '全部项目' },
    ],
    pipeline: stageChain(active[0] ?? projects[0] ?? {}),
    projects: active.slice(0, 6),
    tasks: running.slice(0, 8),
    notifications: notifications.slice(0, 6),
    audits: rows('audits').slice(0, 6),
  })
}

function currentStageName(project: Row): string {
  const chain = stageChain(project)
  return chain.find((stage) => stage.state === 'now')?.name ?? chain[0]?.name ?? '待启动'
}

function analytics(scope: 'enterprise' | 'me'): Envelope {
  const projects = scope === 'me'
    ? rows('projects').filter((project) => String(project.owner ?? '').includes('林知远') || project.owner === currentIdentity().name)
    : rows('projects')
  const costs = rows('costs')
  const tasks = scope === 'me'
    ? rows('tasks').filter((task) => String(task.owner ?? '').includes('林知远'))
    : rows('tasks')
  const totalCost = costs.reduce((sum, row) => sum + Number(row.actual ?? 0), 0)
  const byProject = projects.map((project) => ({
    project: project.id,
    name: project.name,
    status: project.status,
    episodes: project.episodes,
    done: project.done,
    stage: currentStageName(project),
    budget: project.budget,
    actual: project.actual,
    quality: project.quality,
    cost: costs.filter((row) => row.project === project.id).reduce((sum, row) => sum + Number(row.actual ?? 0), 0),
  }))
  const stageNames = stageChain(projects[0] ?? {}).map((stage) => stage.name)
  const byStage = stageNames.map((name) => {
    const count = projects.filter((project) => currentStageName(project) === name).length
    const ratio = `${Math.round((count / Math.max(1, projects.length)) * 100)}%`
    return { stage: name, count, ratio }
  })
  const taskMix = tasks.reduce((acc: Row[], task) => {
    const hit = acc.find((row) => row.kind === task.kind)
    if (hit) {
      hit.count += 1
      if (task.status === '失败') hit.failed += 1
    } else {
      acc.push({ kind: task.kind, count: 1, failed: task.status === '失败' ? 1 : 0 })
    }
    return acc
  }, [])
  const passRate = Math.round((rows('qualityReports').filter((row) => row.result === 'PASS').length / Math.max(1, rows('qualityReports').length)) * 100)
  return ok({
    scope,
    kpis: {
      projects: projects.length,
      episodes: projects.reduce((sum, row) => sum + Number(row.done ?? 0), 0),
      onTime: `${Math.max(72, 96 - projects.filter((row) => row.status === '异常中').length * 8)}%`,
      cost: totalCost,
      reuse: `${passRate}%`,
    },
    by_project: byProject,
    by_stage: byStage,
    task_mix: taskMix,
    cost_by_cap: rows('costDimensions').map((dim) => ({
      name: dim.name,
      amount: costs.filter((row) => String(row.cap ?? '').includes(String(dim.name).slice(0, 2))).reduce((sum, row) => sum + Number(row.actual ?? 0), 0),
    })),
  })
}

function opsOverview(): Envelope {
  const tasks = rows('tasks')
  const providers = rows('providers')
  return ok({
    queues: providers.slice(0, 5).map((provider, index) => {
      const kinds = ['视频生成', '视频生成', '音频合成', '质检', '视频生成'][index] ?? '视频生成'
      const queue = tasks.filter((row) => row.kind === kinds)
      return {
        name: `${provider.name} 队列`,
        provider: provider.name,
        running: queue.filter((row) => row.status === '执行中').length,
        waiting: queue.filter((row) => row.status === '排队中').length,
        failed: queue.filter((row) => row.status === '失败').length,
        p95: 18 + index * 9,
        status: provider.status,
      }
    }),
    storage: {
      objects: '1.28 TB · 234,880 对象',
      db: '42 GB · Postgres 16',
      cache: '6.4 GB · Redis',
      level: '64%（告警阈值 75%）',
    },
    services: [
      { name: 'API', status: '正常', note: 'P95 128ms' },
      { name: 'Worker', status: '正常', note: '并发 6 / 8' },
      { name: 'Redis', status: '正常', note: '队列正常' },
      { name: 'Postgres', status: '正常', note: '连接 14 / 100' },
      { name: '对象存储', status: '告警', note: '用量 64%' },
      { name: 'Mock 网关', status: '正常', note: 'VITE_DATA_MODE=mock' },
    ],
    providers: providers.map((row) => ({ name: row.name, kind: row.kind, models: row.models ?? '—', sla: row.sla ?? '—', cost: row.cost ?? '—', status: row.status })),
    incidents: rows('incidents'),
  })
}

function opsQueues(): Envelope {
  return ok(rows('tasks').filter((row) => ['排队中', '执行中', '失败'].includes(row.status)))
}

function opsConfig(): Envelope {
  return ok(store.dicts.ops ?? {})
}

function costsSummary(): Envelope {
  const costs = rows('costs')
  const total = costs.reduce((sum, row) => sum + Number(row.actual ?? 0), 0)
  const failed = costs.reduce((sum, row) => sum + Number(row.failed ?? 0), 0)
  return ok({
    total,
    failed,
    count: costs.length,
    by_project: rows('projects').map((project) => ({
      project: project.id,
      name: project.name,
      amount: costs.filter((row) => row.project === project.id).reduce((sum, row) => sum + Number(row.actual ?? 0), 0),
      budget: project.budget,
    })),
    by_provider: rows('providers').map((provider) => ({
      provider: provider.name,
      amount: costs.filter((row) => String(row.provider ?? '').includes(String(provider.name).slice(0, 4))).reduce((sum, row) => sum + Number(row.actual ?? 0), 0),
    })),
  })
}

/* ------------------------------------------------------------------ *
 * 创意策划工作区
 * ------------------------------------------------------------------ */

function requireText(value: unknown, label: string): string {
  const text = String(value ?? '').trim()
  if (!text) throw new MockHttpError(422, 'missing_input', `${label}不能为空`)
  return text
}

function briefVersionNumber(value: unknown): number {
  const match = String(value ?? '').match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

function createBrief(body: Row): Envelope {
  const projectId = String(body.project ?? '')
  if (!projectId) throw new MockHttpError(422, 'missing_project', '缺少项目编号')
  const project = projectOf(projectId)
  const note = requireText(body.note, '创意说明')
  const constraints = requireText(body.constraints, '内容约束')
  const genre = requireText(body.genre, '题材')
  const audience = requireText(body.audience, '目标受众')
  const style = requireText(body.style, '影像风格')

  const versions = rows('briefs').filter((row) => row.project === projectId)
  const version = `v${versions.reduce((max, row) => Math.max(max, briefVersionNumber(row.version)), 0) + 1}`
  const projectCode = projectId.split('-')[1] ?? projectId
  const sequence = versions.reduce((max, row) => {
    const suffix = String(row.id).split('-').pop() ?? ''
    return Math.max(max, Number(suffix) || 0)
  }, 0) + 1
  const brief: Row = {
    id: `CB-${projectCode}-${String(sequence).padStart(2, '0')}`,
    project: projectId,
    version,
    genre,
    audience,
    duration: String(body.duration ?? project.duration ?? ''),
    ratio: String(body.ratio ?? project.ratio ?? ''),
    language: String(body.language ?? project.language ?? ''),
    style,
    constraints,
    note,
    mode: String(body.mode ?? '自由描述'),
    status: String(body.status ?? '草稿'),
    by: String(currentIdentity().name ?? '项目负责人').split('·')[0].trim(),
    at: now(),
  }
  rows('briefs').push(brief)

  if (body.applyProject !== false) {
    Object.assign(project, {
      genre,
      audience,
      duration: brief.duration,
      ratio: brief.ratio,
      language: brief.language,
      style,
      constraints,
    })
  }
  store.persist()
  return ok(brief)
}

function generateCreativePlans(body: Row): Envelope {
  const projectId = String(body.project ?? '')
  if (!projectId) throw new MockHttpError(422, 'missing_project', '缺少项目编号')
  projectOf(projectId)
  const idea = requireText(body.idea, '创意说明')
  const rawCount = Number(body.count ?? 3)
  const count = Math.min(4, Math.max(2, Number.isFinite(rawCount) ? Math.round(rawCount) : 3))
  const projectCode = projectId.split('-')[1] ?? projectId
  const existing = rows('creativePlans').filter((row) => row.project === projectId)
  const used = new Set(existing.map((row) => String(row.id).split('-').pop() ?? ''))
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  const parts = idea.split(/[，。；、,.;]/).map((part) => part.trim()).filter(Boolean)
  const seed = (parts[0]?.length && parts[0].length >= 4 ? parts[0] : parts.slice(0, 2).join(' · ')) || idea.slice(0, 12)
  const variants = [
    { tag: '冷叙事', theme: '用留白和克制替代解释，把情绪压到细节里', hook: '开场 3 秒只给一封信的落款，不给写信人正脸', risk: '前两集信息密度偏低，需要靠悬念镜头维持留存' },
    { tag: '强冲突', theme: '把错认与误会推到不可挽回，再用代价完成反转', hook: '主角当众读错信，第一句就改变两个人的关系', risk: '冲突强度高，需控制反派动机避免工具化' },
    { tag: '双线反转', theme: '两条时间线互相改写，让同一封信有两种真相', hook: '同一句台词在现在与过去之间产生完全相反的指向', risk: '时间线切换密集，剪辑与字幕需强提示' },
    { tag: '克制收束', theme: '把真相留到最后一封信，用余味替代强刺激', hook: '全场安静，只有拆信的声音和一次呼吸', risk: '收束偏慢，适合长剧集但不适合强节奏投放' },
  ]
  const group = Math.floor(existing.length / variants.length) + 1
  const created: Row[] = []
  for (let index = 0; index < count; index += 1) {
    const letter = letters.find((item) => !used.has(item))
    if (!letter) break
    used.add(letter)
    const variant = variants[index % variants.length]
    const plan: Row = {
      id: `CP-${projectCode}-${letter}`,
      project: projectId,
      title: `${seed} · ${variant.tag}${group > 1 ? ` ${group}` : ''}`,
      selling: `以「${idea.slice(0, 20)}」为内核，沿${variant.tag}路线组织前三集钩子与人物关系。`,
      theme: variant.theme,
      hook: variant.hook,
      score: 88 - index * 2 + (group - 1),
      chosen: false,
      risk: variant.risk,
      mode: String(body.mode ?? '自由描述'),
      idea,
      by: String(currentIdentity().name ?? '项目负责人').split('·')[0].trim(),
      at: now(),
    }
    rows('creativePlans').push(plan)
    created.push(plan)
  }
  store.persist()
  return ok(created)
}

function selectCreativePlan(id: string, body: Row): Envelope {
  const plan = byId('creativePlans', id)
  const projectId = String(body.project ?? plan.project ?? '')
  if (!projectId || plan.project !== projectId) {
    throw new MockHttpError(422, 'project_mismatch', '方案不属于当前项目')
  }
  rows('creativePlans')
    .filter((row) => row.project === projectId)
    .forEach((row) => { row.chosen = row.id === id })
  store.persist()
  return ok(plan)
}

/* ------------------------------------------------------------------ *
 * 剧本创作：模型生成初稿、逐集重写、提交审核
 * ------------------------------------------------------------------ */

interface DraftLine {
  char: string
  text: string
}

interface DraftScene {
  no: string
  location: string
  time: string
  chars: string
  action: string
  lines: DraftLine[]
}

interface DraftEpisode {
  no: number
  title: string
  logline: string
  hook: string
  scenes: DraftScene[]
  edited?: boolean
  editedAt?: string
}

function buildEpisodeShots(project: Row, draft: DraftEpisode, model: string): Row[] {
  const projectCode = String(project.id).split('-')[1] ?? String(project.id)
  const characters = rows('characters').filter((row) => row.project === project.id)
  const locations = rows('locations').filter((row) => row.project === project.id)
  const shots: Row[] = []
  let sequence = 0

  for (const scene of draft.scenes) {
    const lines = scene.lines ?? []
    const matchedChars = characters
      .filter((row) => scene.chars.includes(String(row.name ?? '')))
      .map((row) => `${String(row.id)} ${String(row.version ?? '')}`.trim())
    const matchedLocation = locations.find((row) => scene.location.includes(String(row.name ?? '')))
    const refs = [
      ...matchedChars,
      matchedLocation ? `${String(matchedLocation.id)} ${String(matchedLocation.version ?? '')}`.trim() : '',
    ].filter(Boolean).join(' · ') || `人物：${scene.chars} · 场景：${scene.location}`
    const specs = [
      {
        frame: '全景',
        angle: '平视',
        move: '缓慢推近',
        lens: '24mm 倾向',
        line: '—',
        voice: '环境声',
        duration: 9,
        emotion: '建立空间',
        desc: `${scene.location} · ${scene.time}；${scene.action}`,
      },
      {
        frame: '中景',
        angle: '平视',
        move: '手持轻微跟随',
        lens: '35mm 倾向',
        line: lines[0]?.text ?? '—',
        voice: '对白 + 环境声',
        duration: 10,
        emotion: '推进动作',
        desc: `围绕 ${scene.chars}：${scene.action}`,
      },
      {
        frame: '特写',
        angle: '略仰',
        move: '固定',
        lens: '85mm 倾向',
        line: lines[1]?.text ?? '—',
        voice: lines[1] ? '对白 + 环境声' : '环境声 + 呼吸',
        duration: 8,
        emotion: '情绪落点',
        desc: `${scene.chars} 的情绪落点；${draft.hook || scene.action}`,
      },
    ]

    for (const spec of specs) {
      sequence += 1
      shots.push({
        id: `SH-${projectCode}-E${pad2(draft.no)}-${pad2(sequence)}`,
        project: project.id,
        ep: draft.no,
        scene: scene.no,
        no: `SH-${pad2(sequence)}`,
        order: sequence,
        frame: spec.frame,
        angle: spec.angle,
        move: spec.move,
        lens: spec.lens,
        desc: spec.desc,
        chars: scene.chars,
        emotion: spec.emotion,
        line: spec.line,
        voice: spec.voice,
        duration: `${spec.duration} 秒`,
        refs,
        model,
        quality: '人物一致性 / 画面异常 / 时长',
        status: '待生成',
        version: '待生成',
      })
    }
  }
  return shots
}

function freezeEpisodePlan(project: Row, ep: number, shots: Row[], model: string): Row {
  const projectCode = String(project.id).split('-')[1] ?? String(project.id)
  const existing = rows('plans').filter((row) => String(row.project) === String(project.id) && String(row.scope) === `第 ${ep} 集`)
  const version = existing.reduce((max, row) => Math.max(max, Number(String(row.version ?? '').replace(/\D/g, '')) || 0), 0) + 1
  const plan = {
    id: `PP-${projectCode}-E${pad2(ep)}-V${version}`,
    project: project.id,
    version: `v${version}`,
    scope: `第 ${ep} 集`,
    shots: shots.length,
    tasks: shots.length,
    frozen: now(),
    status: '已固化',
    model,
    note: `E${pad2(ep)} 镜头契约固化；模型基线 ${model}`,
    snapshot: shots.map((shot) => ({ ...shot })),
  }
  rows('plans').unshift(plan)
  return plan
}

const SCRIPT_MODELS = ['剧本模型 A · 长篇结构', '剧本模型 B · 快节奏短剧', '剧本模型 C · 对话打磨']

function scriptTitles(project: Row): string[] {
  const genre = String(project.genre ?? '')
  if (genre.includes('青春')) {
    return ['开学第一天', '被退回的申请表', '靠窗的座位', '天台上的耳机', '雨里的两杯豆浆', '最后一次点名', '没有寄出的信', '操场的灯', '毕业照空位', '夏夜的长跑', '广播里的名字', '校门关闭之前', '一张旧车票', '跑道尽头', '说好不回头', '边界之外']
  }
  if (genre.includes('家庭') || genre.includes('美食')) {
    return ['一桌冷掉的饭', '灶台上的信', '失传的那道汤', '咸淡之间', '阿婆的旧围裙', '菜市场清晨', '多摆的一双筷子', '汤滚的时候', '巷口的灯', '一张欠条', '年夜饭之前', '厨房里的争吵', '一碗长寿面', '灶火熄灭', '留给谁的位置', '饭后散步', '旧锅新火', '团圆之前']
  }
  return ['雾里的地址', '第一封信', '没有寄件人', '旧城区的雨', '门后的声音', '空房间', '迟到的访客', '无人接听', '第二把钥匙', '雨停之前', '天台的风', '最后一班车', '回信', '邮戳之下', '灯灭之后', '一封旧信', '错位的门牌', '终点之前', '真相的重量', '最后一封信', '雾散', '回声', '归途', '交付']
}

function scriptSceneSets(project: Row): Array<Array<Omit<DraftScene, 'no'>>> {
  const genre = String(project.genre ?? '')
  if (genre.includes('青春')) {
    return [
      [
        { location: '校门口 · 清晨', time: '晨 / 外', chars: '林夏、周野', action: '林夏把被退回的申请表折成四折，周野隔着马路举起两杯豆浆。', lines: [{ char: '周野', text: '你又一个人去交了？' }, { char: '林夏', text: '这次我想自己签。' }] },
        { location: '高三教室 · 午后', time: '日 / 内', chars: '林夏、许知遥', action: '许知遥把最后一排的座位牌换到窗边，假装只是顺手。', lines: [{ char: '许知遥', text: '靠窗能看见操场。' }, { char: '林夏', text: '也能看见谁没来。' }] },
        { location: '旧教学楼天台 · 黄昏', time: '黄昏 / 外', chars: '林夏、周野', action: '两人隔着栏杆分一副耳机，远处广播开始点名。', lines: [{ char: '周野', text: '毕业以后，你还跑吗？' }, { char: '林夏', text: '跑，但会回来。' }] },
      ],
      [
        { location: '便利店门口 · 雨夜', time: '夜 / 外', chars: '林夏、周野', action: '雨把招牌灯打碎成一片橙色，林夏把没送出去的信塞回书包。', lines: [{ char: '周野', text: '信都湿了。' }, { char: '林夏', text: '字还在。' }] },
        { location: '篮球场 · 傍晚', time: '傍晚 / 外', chars: '周野、许知遥', action: '球停在脚边，周野盯着看台上空掉的位置。', lines: [{ char: '许知遥', text: '她今天没来。' }, { char: '周野', text: '我知道。' }] },
        { location: '公交末班 · 夜', time: '夜 / 内', chars: '林夏、周野', action: '车厢只剩两个人，林夏把座位让给一束被雨打湿的花。', lines: [{ char: '林夏', text: '下一站我就下。' }, { char: '周野', text: '那我再坐一站。' }] },
      ],
      [
        { location: '教室走廊 · 清晨', time: '晨 / 内', chars: '林夏、许知遥', action: '值日表上两个人的名字被并排写在一起，粉笔灰落在窗台。', lines: [{ char: '许知遥', text: '今天轮到我们锁门。' }, { char: '林夏', text: '那就晚一点走。' }] },
        { location: '图书馆 · 午后', time: '日 / 内', chars: '林夏、周野', action: '周野把一本翻旧的志愿手册推过来，书页停在最远的那一页。', lines: [{ char: '周野', text: '这个城市也有海。' }, { char: '林夏', text: '先看完这一章。' }] },
        { location: '天台 · 夜', time: '夜 / 外', chars: '林夏、周野、许知遥', action: '三个人坐在天台边缘，谁都没有先提明天。', lines: [{ char: '许知遥', text: '灯灭了就回去吧。' }, { char: '林夏', text: '再等一分钟。' }] },
      ],
    ]
  }
  if (genre.includes('家庭') || genre.includes('美食')) {
    return [
      [
        { location: '厨房 · 夜', time: '夜 / 内', chars: '周远、小满', action: '灶上汤滚了第三遍，周远仍把火调小，等一个不会回来的人。', lines: [{ char: '小满', text: '爸，汤要干了。' }, { char: '周远', text: '再煨一会儿。' }] },
        { location: '餐桌 · 夜', time: '夜 / 内', chars: '周远、小满、阿婆', action: '桌上多摆了一双筷子，阿婆把它悄悄收进围裙口袋。', lines: [{ char: '阿婆', text: '人没到，碗先留着。' }, { char: '小满', text: '他会来的。' }] },
        { location: '巷口 · 清晨', time: '晨 / 外', chars: '小满、阿婆', action: '早点摊刚支起来，小满把昨晚剩下的汤装进保温桶。', lines: [{ char: '阿婆', text: '给谁送？' }, { char: '小满', text: '给那个总说下次的人。' }] },
      ],
      [
        { location: '菜市场 · 清晨', time: '晨 / 外', chars: '周远、小满', action: '周远在一堆青菜前挑了很久，只买了够两个人吃的量。', lines: [{ char: '小满', text: '今天有人来？' }, { char: '周远', text: '先按三个人备。' }] },
        { location: '老屋灶台 · 午后', time: '日 / 内', chars: '阿婆、小满', action: '阿婆从柜底翻出一口旧锅，锅底还留着上一顿饭的焦痕。', lines: [{ char: '阿婆', text: '这锅只做那道汤。' }, { char: '小满', text: '那今天做给我。' }] },
        { location: '阳台 · 夜', time: '夜 / 外', chars: '周远、小满', action: '父子俩隔着晾衣杆站着，楼下传来别人家的电视声。', lines: [{ char: '周远', text: '你妈走那年，也是这个味。' }, { char: '小满', text: '那就别让它断。' }] },
      ],
      [
        { location: '面馆后厨 · 夜', time: '夜 / 内', chars: '周远、小满', action: '最后一碗面出锅，周远把围裙解下来，第一次让小满掌勺。', lines: [{ char: '周远', text: '火候你看着。' }, { char: '小满', text: '糊了算我的。' }] },
        { location: '饭桌 · 夜', time: '夜 / 内', chars: '周远、小满、阿婆', action: '三个人终于同时坐下，谁都没有先动筷子。', lines: [{ char: '阿婆', text: '开饭吧。' }, { char: '小满', text: '等人齐。' }] },
        { location: '医院走廊 · 日', time: '日 / 内', chars: '周远、小满', action: '走廊尽头的窗开着，周远把保温桶放在长椅上。', lines: [{ char: '小满', text: '还热着。' }, { char: '周远', text: '她闻得到。' }] },
      ],
    ]
  }
  return [
    [
      { location: '旧城区街口 · 雨夜', time: '夜 / 雨', chars: '顾沉、苏眠', action: '顾沉在邮筒里摸到一封没有邮戳的信，信封上只写着苏眠的名字。', lines: [{ char: '苏眠', text: '这不是我写的。' }, { char: '顾沉', text: '但字迹是你的。' }] },
      { location: '邮局旧址 · 夜内', time: '夜 / 内', chars: '顾沉、老周', action: '老周把最后一盏灯关掉，柜台下压着一枚二十年前的邮戳。', lines: [{ char: '老周', text: '这封信不该送到。' }, { char: '顾沉', text: '可它已经到了。' }] },
      { location: '旧城区天台 · 黄昏', time: '黄昏 / 外', chars: '顾沉、苏眠', action: '两人隔着水箱站着，远处教堂钟声盖住了翻信纸的声音。', lines: [{ char: '苏眠', text: '你信里面写的吗？' }, { char: '顾沉', text: '我只信你现在的样子。' }] },
    ],
    [
      { location: '出租屋 · 夜内', time: '夜 / 内', chars: '苏眠、顾沉', action: '台灯下摊着七封信，每一封的落款都停在同一天。', lines: [{ char: '苏眠', text: '同一天寄出七封？' }, { char: '顾沉', text: '不，是同一天被退回。' }] },
      { location: '巷口 · 凌晨', time: '凌晨 / 外', chars: '顾沉、老周', action: '清扫车经过，老周从湿垃圾里捡出一枚被踩扁的钥匙。', lines: [{ char: '老周', text: '这是旧邮局后门的。' }, { char: '顾沉', text: '门还在吗？' }] },
      { location: '旧邮局 · 午后', time: '日 / 内', chars: '顾沉、苏眠', action: '阳光切开灰尘，墙缝里露出一排没有寄出的信。', lines: [{ char: '苏眠', text: '都是给我的。' }, { char: '顾沉', text: '也许只是没送到。' }] },
    ],
    [
      { location: '警局走廊 · 日', time: '日 / 内', chars: '顾沉、苏眠', action: '长椅上的两人隔着一个空位，墙上时钟停在整点前两分钟。', lines: [{ char: '苏眠', text: '你要现在说吗？' }, { char: '顾沉', text: '等钟响。' }] },
      { location: '废弃站台 · 夜', time: '夜 / 外', chars: '顾沉、老周', action: '末班车早已停运，站牌下却有人用粉笔写下明天的日期。', lines: [{ char: '老周', text: '她来过了。' }, { char: '顾沉', text: '她一直没走。' }] },
      { location: '公寓 · 深夜', time: '深夜 / 内', chars: '顾沉、苏眠', action: '最后一封信被拆开，里面只有一张旧城区改造前的地图。', lines: [{ char: '苏眠', text: '地址被划掉了。' }, { char: '顾沉', text: '那就按记忆找。' }] },
    ],
  ]
}

const SCRIPT_HOOKS: Record<string, string[]> = {
  青春: ['结尾停在广播喊出名字的瞬间，林夏没有回头。', '雨停之前，周野把那封信重新塞回邮筒。', '天台灯灭，三个人谁都没有先走。'],
  家庭: ['汤终于滚开，门外却没有人敲门。', '多摆的那双筷子，被阿婆收进了围裙口袋。', '最后一碗面端上桌，座位仍空着一个。'],
  悬疑: ['信纸背面还有一行被水洇开的字。', '钥匙插进旧邮局后门，门从里面反锁。', '地图上被划掉的地址，正是他们站的地方。'],
}

function scriptThemeKey(project: Row): keyof typeof SCRIPT_HOOKS {
  const genre = String(project.genre ?? '')
  if (genre.includes('青春')) return '青春'
  if (genre.includes('家庭') || genre.includes('美食')) return '家庭'
  return '悬疑'
}

function buildEpisodeDraft(project: Row, ep: number, prompt: string): DraftEpisode {
  const theme = scriptThemeKey(project)
  const sets = scriptSceneSets(project)
  const titles = scriptTitles(project)
  const set = sets[(ep - 1) % sets.length]
  const title = titles[(ep - 1) % titles.length]
  const hooks = SCRIPT_HOOKS[theme]
  return {
    no: ep,
    title,
    logline: `第 ${ep} 集《${title}》：${prompt.slice(0, 56)}${prompt.length > 56 ? '…' : ''}`,
    hook: hooks[(ep - 1) % hooks.length],
    scenes: set.map((scene, index) => ({
      no: pad2(index + 1),
      ...scene,
      lines: scene.lines.map((line) => ({ ...line })),
    })),
  }
}

function scriptCounts(drafts: DraftEpisode[]) {
  const scenes = drafts.reduce((sum, episode) => sum + episode.scenes.length, 0)
  const lines = drafts.reduce(
    (sum, episode) => sum + episode.scenes.reduce((lineSum, scene) => lineSum + scene.lines.length, 0),
    0,
  )
  return { scenes, lines }
}

function createBlankScript(body: Row): Envelope {
  const projectId = String(body.project ?? '')
  if (!projectId) throw new MockHttpError(422, 'missing_project', '缺少项目编号')
  const project = projectOf(projectId)
  const projectCode = projectId.split('-')[1] ?? projectId
  const versions = rows('scripts').filter((row) => row.project === projectId)
  const versionNo = versions.reduce((max, row) => Math.max(max, Number(String(row.version ?? '').replace(/\D/g, '')) || 0), 0) + 1
  const source = body.source && typeof body.source === 'object' ? body.source as Row : { kind: 'manual', label: '自主编写' }
  const drafts = Array.isArray(body.episodeDrafts) ? body.episodeDrafts as DraftEpisode[] : []
  const counts = scriptCounts(drafts)
  const script: Row = {
    id: `SCR-${projectCode}-V${versionNo}`,
    project: projectId,
    version: `v${versionNo}`,
    status: '草稿',
    episodes: Math.max(1, Number(project.episodes ?? 1)),
    writtenEpisodes: drafts.length,
    scenes: counts.scenes,
    lines: counts.lines,
    shots: 0,
    by: String(currentIdentity().name ?? '项目负责人').split('·')[0].trim(),
    at: now(),
    note: String(body.note ?? '新建空白剧本'),
    locked: false,
    revision: 1,
    updatedAt: now(),
    source,
    episodeDrafts: drafts,
  }
  rows('scripts').unshift(script)
  rows('audits').unshift({
    id: nextId('AUD', 'audits'),
    time: now(),
    actor: String(currentIdentity().name ?? '').split('·')[0].trim(),
    object: `剧本 ${script.id}`,
    action: `新建剧本版本（${String(source.label ?? source.kind ?? '自主编写')}）`,
    result: '成功',
    src: '本地 mock · 剧本创作台',
    link: projectId,
    reason: String(body.note ?? ''),
  })
  store.persist()
  return ok(script)
}

interface NovelChapterInput {
  no: number
  title: string
  words?: number
  content: string
}

interface ChapterMappingInput {
  chapterNo: number
  fromEpisode: number
  episodeCount: number
  episodeNo?: number
}

interface NovelSegment {
  chapter: NovelChapterInput
  part: number
  total: number
  content: string
}

function splitNovelContent(text: string, count: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return Array.from({ length: count }, () => '')
  const units = clean.split(/(?<=[。！？!?；;])/).map((item) => item.trim()).filter(Boolean)
  if (units.length >= count) {
    return Array.from({ length: count }, (_, index) => {
      const start = Math.floor(index * units.length / count)
      const end = Math.floor((index + 1) * units.length / count)
      return units.slice(start, Math.max(start + 1, end)).join('')
    })
  }
  const size = Math.max(1, Math.ceil(clean.length / count))
  return Array.from({ length: count }, (_, index) => clean.slice(index * size, (index + 1) * size).trim())
}

function novelSceneChunks(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ['', '', '']
  const units = clean.split(/(?<=[。！？!?；;])/).map((item) => item.trim()).filter(Boolean)
  if (units.length >= 3) {
    return [0, 1, 2].map((index) => {
      const start = Math.floor(index * units.length / 3)
      const end = Math.floor((index + 1) * units.length / 3)
      return units.slice(start, Math.max(start + 1, end)).join('')
    })
  }
  const size = Math.max(1, Math.ceil(clean.length / 3))
  return [0, 1, 2].map((index) => clean.slice(index * size, (index + 1) * size).trim())
}

function buildNovelEpisode(segments: NovelSegment[], ep: number, strength: string): DraftEpisode {
  const first = segments[0]
  const baseTitle = first?.chapter.title || `第 ${ep} 集`
  const episodeTitle = first.total > 1 && segments.length === 1
    ? `${baseTitle}（${first.part}/${first.total}）`
    : baseTitle
  const sceneText = segments.map((segment) => segment.content).join(' ').trim()
  const clean = sceneText.replace(/\s+/g, ' ').trim()
  const chunks = novelSceneChunks(clean)
  const hookSource = clean.split(/(?<=[。！？!?])/).filter(Boolean).pop() ?? clean
  const mode = segments.length > 1 ? `合章改编 · ${segments.length} 章` : first.total > 1 ? `拆章改编 · ${first.part}/${first.total}` : '单章改编'
  return {
    no: ep,
    title: episodeTitle.slice(0, 28),
    logline: `${mode}｜${clean.slice(0, 72)}${clean.length > 72 ? '…' : ''}`,
    hook: hookSource.slice(-48),
    scenes: chunks.map((chunk, index) => ({
      no: pad2(index + 1),
      location: `${baseTitle.slice(0, 12)} · 场景 ${index + 1}`,
      time: '日 / 内',
      chars: '原著人物',
      action: `原著画面：${chunk.slice(0, 62)}${chunk.length > 62 ? '…' : ''}`,
      lines: [{ char: '旁白', text: chunk || `（${strength}）第 ${ep} 集场景 ${index + 1}` }],
    })),
  }
}

function adaptNovel(body: Row): Envelope {
  const projectId = String(body.project ?? '')
  if (!projectId) throw new MockHttpError(422, 'missing_project', '缺少项目编号')
  const project = projectOf(projectId)
  const model = requireText(body.model, '改编模型')
  if (!SCRIPT_MODELS.includes(model)) {
    throw new MockHttpError(422, 'script_model_unknown', `未登记的剧本模型：${model}`)
  }
  const strength = String(body.strength ?? '标准改编')
  const totalEpisodes = Math.max(1, Number(project.episodes ?? 1))
  const mergeId = String(body.scriptId ?? '')
  let script: Row | null = null
  if (mergeId) {
    const found = byId('scripts', mergeId)
    if (found.project !== projectId) throw new MockHttpError(422, 'project_mismatch', '剧本版本不属于当前项目')
    if (!found.locked) script = found
  }

  const rawChapters = (body.chapters ?? script?.source?.chapters ?? []) as NovelChapterInput[]
  const chapters = Array.isArray(rawChapters) ? rawChapters.filter((chapter) => chapter && chapter.title) : []
  if (!chapters.length) throw new MockHttpError(422, 'novel_chapters_empty', '没有可改编的章节')
  if (chapters.some((chapter) => !String(chapter.content ?? '').trim())) {
    throw new MockHttpError(422, 'novel_content_missing', '章节缺少正文；请重新导入小说全文')
  }

  const rawMapping = (body.mapping ?? []) as ChapterMappingInput[]
  const mapping = Array.isArray(rawMapping) ? rawMapping.map((item) => {
    const fromEpisode = Math.round(Number(item.fromEpisode ?? item.episodeNo ?? 1))
    return {
      chapterNo: Math.round(Number(item.chapterNo)),
      fromEpisode,
      episodeCount: Math.max(1, Math.round(Number(item.episodeCount ?? 1))),
    }
  }) : []
  if (!mapping.length) throw new MockHttpError(422, 'novel_mapping_empty', '请先完成章节映射')
  const chapterNos = new Set(chapters.map((chapter) => chapter.no))
  const missing = chapters.filter((chapter) => !mapping.some((item) => item.chapterNo === chapter.no))
  if (missing.length) throw new MockHttpError(422, 'novel_mapping_incomplete', `还有 ${missing.length} 章未映射`)
  if (mapping.some((item) =>
    !chapterNos.has(item.chapterNo)
    || item.fromEpisode < 1
    || item.fromEpisode + item.episodeCount - 1 > totalEpisodes,
  )) {
    throw new MockHttpError(422, 'novel_mapping_invalid', `映射区间必须在 1–${totalEpisodes} 集内`)
  }

  const grouped = new Map<number, NovelSegment[]>()
  for (const item of mapping) {
    const chapter = chapters.find((row) => row.no === item.chapterNo)
    if (!chapter) continue
    const pieces = splitNovelContent(chapter.content, item.episodeCount)
    pieces.forEach((content, index) => {
      const episodeNo = item.fromEpisode + index
      const list = grouped.get(episodeNo) ?? []
      list.push({ chapter, part: index + 1, total: item.episodeCount, content })
      grouped.set(episodeNo, list)
    })
  }
  const drafts = [...grouped.entries()]
    .map(([episodeNo, list]) => buildNovelEpisode(list.sort((a, b) => a.chapter.no - b.chapter.no || a.part - b.part), episodeNo, strength))
    .sort((left, right) => left.no - right.no)
  if (!drafts.length) throw new MockHttpError(422, 'novel_mapping_empty', '没有生成任何分集稿')

  if (!script) {
    const projectCode = projectId.split('-')[1] ?? projectId
    const versions = rows('scripts').filter((row) => row.project === projectId)
    const versionNo = versions.reduce((max, row) => Math.max(max, Number(String(row.version ?? '').replace(/\D/g, '')) || 0), 0) + 1
    script = {
      id: `SCR-${projectCode}-V${versionNo}`,
      project: projectId,
      version: `v${versionNo}`,
      status: '草稿',
      episodes: totalEpisodes,
      scenes: 0,
      lines: 0,
      shots: 0,
      by: String(currentIdentity().name ?? '项目负责人').split('·')[0].trim(),
      at: now(),
      note: '',
      locked: false,
      revision: 0,
      source: { kind: 'novel', label: '小说改编' },
    }
    rows('scripts').unshift(script)
  }

  const counts = scriptCounts(drafts)
  const bodySource = body.source && typeof body.source === 'object' ? body.source as Row : {}
  const source = {
    ...(script.source && typeof script.source === 'object' ? script.source as Row : {}),
    ...bodySource,
    kind: 'novel',
    label: '小说改编',
    model,
    chapters: chapters.map((chapter) => ({
      no: chapter.no,
      title: chapter.title,
      words: Number(chapter.words ?? chapter.content.replace(/\s/g, '').length),
      content: chapter.content,
    })),
    mapping,
    adaptedAt: now(),
    note: `已改编 ${drafts.length} 集 / ${chapters.length} 章`,
  }
  Object.assign(script, {
    status: '草稿',
    episodes: totalEpisodes,
    writtenEpisodes: drafts.length,
    scenes: counts.scenes,
    lines: counts.lines,
    shots: 0,
    episodeDrafts: drafts,
    revision: Number(script.revision ?? 0) + 1,
    updatedAt: now(),
    note: `小说改编 ${drafts.length} 集 · ${strength} · ${chapters.length} 章映射`,
    source,
    generation: {
      model,
      prompt: '按小说章节映射改编分集稿',
      strength,
      scope: 'novel',
      from: drafts[0].no,
      count: drafts.length,
      elapsed: `${(drafts.length * 2.6 + 1.8).toFixed(1)}s`,
      tokens: Math.round(chapters.reduce((sum, chapter) => sum + chapter.content.length, 0) / 2),
      cost: Number((drafts.length * 0.11).toFixed(2)),
      at: now(),
    },
  })

  rows('audits').unshift({
    id: nextId('AUD', 'audits'),
    time: now(),
    actor: String(currentIdentity().name ?? '').split('·')[0].trim(),
    object: `剧本 ${script.id}`,
    action: `小说改编 ${drafts.length} 集（${chapters.length} 章 · ${model}）`,
    result: '成功',
    src: '本地 mock · 剧本创作台',
    link: projectId,
    reason: `章节映射：${mapping.map((item) => `${item.chapterNo}→E${pad2(item.fromEpisode)}–E${pad2(item.fromEpisode + item.episodeCount - 1)}`).join('，')}`,
  })
  store.persist()
  return ok(script)
}

function generateScript(body: Row): Envelope {
  const projectId = String(body.project ?? '')
  if (!projectId) throw new MockHttpError(422, 'missing_project', '缺少项目编号')
  const project = projectOf(projectId)
  const prompt = requireText(body.prompt, '生成要求')
  const model = requireText(body.model, '生成模型')
  if (!SCRIPT_MODELS.includes(model)) {
    throw new MockHttpError(422, 'script_model_unknown', `未登记的剧本模型：${model}`)
  }
  const strength = String(body.strength ?? '标准改编')
  const totalEpisodes = Math.max(1, Number(project.episodes ?? 1))
  const scope = String(body.scope ?? 'pilot')
  let from = Math.max(1, Math.round(Number(body.from ?? 1)))
  let count = Math.max(1, Math.round(Number(body.count ?? 3)))
  if (scope === 'pilot') count = Math.min(3, totalEpisodes)
  if (scope === 'full') {
    from = 1
    count = totalEpisodes
  }
  if (from + count - 1 > totalEpisodes) {
    throw new MockHttpError(422, 'script_range_invalid', `生成范围超出全剧 ${totalEpisodes} 集`)
  }

  const mergeId = String(body.scriptId ?? '')
  let script: Row
  if (mergeId) {
    script = byId('scripts', mergeId)
    if (script.project !== projectId) throw new MockHttpError(422, 'project_mismatch', '剧本版本不属于当前项目')
    if (script.locked) throw new MockHttpError(409, 'script_locked', '正式版本已锁定，不能直接覆盖；请另起一版')
  } else {
    const projectCode = projectId.split('-')[1] ?? projectId
    const versions = rows('scripts').filter((row) => row.project === projectId)
    const versionNo = versions.reduce((max, row) => Math.max(max, Number(String(row.version ?? '').replace(/\D/g, '')) || 0), 0) + 1
    script = {
      id: `SCR-${projectCode}-V${versionNo}`,
      project: projectId,
      version: `v${versionNo}`,
      status: '草稿',
      episodes: totalEpisodes,
      scenes: 0,
      shots: 0,
      lines: 0,
      by: String(currentIdentity().name ?? '项目负责人').split('·')[0].trim(),
      at: now(),
      note: '',
      locked: false,
      revision: 0,
      source: { kind: 'model', label: '模型生成', model, at: now() },
    }
    rows('scripts').unshift(script)
  }

  const generated: DraftEpisode[] = []
  for (let index = 0; index < count; index += 1) {
    generated.push(buildEpisodeDraft(project, from + index, prompt))
  }
  const existingDrafts = Array.isArray(script.episodeDrafts) ? script.episodeDrafts as DraftEpisode[] : []
  const protectedEdits = body.overwrite ? [] : existingDrafts.filter((episode) => episode.edited && generated.some((item) => item.no === episode.no))
  const replaced = new Set(generated.map((episode) => episode.no))
  const kept = existingDrafts.filter((episode) => !replaced.has(episode.no))
  const applied = generated.filter((episode) => !protectedEdits.some((edit) => edit.no === episode.no))
  const drafts = kept.concat(applied, protectedEdits)
  drafts.sort((left, right) => left.no - right.no)

  const counts = scriptCounts(drafts)
  Object.assign(script, {
    status: '草稿',
    episodes: totalEpisodes,
    writtenEpisodes: drafts.length,
    scenes: counts.scenes,
    lines: counts.lines,
    shots: 0,
    episodeDrafts: drafts,
    revision: Number(script.revision ?? 0) + 1,
    updatedAt: now(),
    note: `模型生成 ${count} 集初稿 · ${strength}${count > 1 ? ` · 第 ${from}–${from + count - 1} 集` : ` · 第 ${from} 集`}`,
    source: { kind: 'model', label: '模型生成', model, at: now() },
    generation: {
      model,
      prompt,
      strength,
      scope,
      from,
      count,
      elapsed: `${(count * 4.2 + 2.8).toFixed(1)}s`,
      tokens: count * 1460,
      cost: Number((count * 0.24).toFixed(2)),
      at: now(),
    },
  })

  rows('audits').unshift({
    id: nextId('AUD', 'audits'),
    time: now(),
    actor: String(currentIdentity().name ?? '').split('·')[0].trim(),
    object: `剧本 ${script.id}`,
    action: `${mergeId ? '模型重写' : '模型生成'} ${count} 集（${model} · ${strength}）`,
    result: '成功',
    src: '本地 mock · 剧本创作台',
    link: projectId,
    reason: prompt,
  })
  store.persist()
  return ok(script)
}

/* ------------------------------------------------------------------ *
 * 鉴权
 * ------------------------------------------------------------------ */

function login(body: Row): Envelope {
  const identities = rows('identities')
  const target = identities.find((row) => row.id === body.identity_id) ?? identities[0]
  store.identityId = String(target.id)
  const user = rows('users').find((row) => row.id === target.userId) ?? rows('users')[0]
  return ok({
    access_token: `mock.${target.id}.${Date.now()}`,
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: 'mock-refresh',
    user: { id: user?.id ?? 'u-01', email: `${target.id}@studio.local`, full_name: target.name, is_active: true },
    identity: target,
    identity_id: target.id,
    permissions: permissionsOf(String(target.id)),
  })
}

function me(): Envelope {
  const identity = currentIdentity()
  const user = rows('users').find((row) => row.id === identity.userId) ?? rows('users')[0]
  return ok({
    user: { id: user?.id ?? 'u-01', email: `${identity.id}@studio.local`, full_name: identity.name, is_active: true },
    identity,
    identity_id: identity.id,
    permissions: currentPermissions(),
  })
}

/* ------------------------------------------------------------------ *
 * 路由分发
 * ------------------------------------------------------------------ */

const CUSTOM: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  { method: 'POST', pattern: /^\/auth\/login$/, handler: ({ body }) => login(body) },
  { method: 'POST', pattern: /^\/auth\/logout$/, handler: () => ok({ ok: true }) },
  { method: 'GET', pattern: /^\/auth\/me$/, handler: () => me() },
  { method: 'POST', pattern: /^\/mock\/identity$/, handler: ({ body }) => login({ identity_id: body.identity_id }) },
  { method: 'POST', pattern: /^\/mock\/reset$/, handler: () => { store.reset(); return ok({ reset: true }) } },
  { method: 'GET', pattern: /^\/workspace\/home$/, handler: () => workspaceHome() },
  { method: 'GET', pattern: /^\/assets\/([^/]+)\/references$/, handler: ({ id }) => assetReferences(decodeURIComponent(id)) },
  { method: 'POST', pattern: /^\/assets$/, handler: ({ body }) => createAsset(body) },
  { method: 'POST', pattern: /^\/briefs$/, handler: ({ body }) => createBrief(body) },
  { method: 'POST', pattern: /^\/creative-plans\/generate$/, handler: ({ body }) => generateCreativePlans(body) },
  { method: 'POST', pattern: /^\/creative-plans\/([^/]+)\/select$/, handler: ({ id, body }) => selectCreativePlan(decodeURIComponent(id), body) },
  { method: 'POST', pattern: /^\/scripts\/blank$/, handler: ({ body }) => createBlankScript(body) },
  { method: 'POST', pattern: /^\/scripts\/adapt$/, handler: ({ body }) => adaptNovel(body) },
  { method: 'POST', pattern: /^\/providers\/test-all$/, handler: () => testAllProviders() },
  { method: 'POST', pattern: /^\/providers\/([^/]+)\/test$/, handler: ({ id }) => testProvider(decodeURIComponent(id)) },
  { method: 'POST', pattern: /^\/model-profiles$/, handler: ({ body }) => createModelProfile(body) },
  { method: 'GET', pattern: /^\/capabilities\/([^/]+)\/impact$/, handler: ({ id }) => routeImpact(decodeURIComponent(id)) },
  { method: 'POST', pattern: /^\/capabilities\/([^/]+)\/route$/, handler: ({ id, body }) => updateCapabilityRoute(decodeURIComponent(id), body) },
  { method: 'GET', pattern: /^\/projects\/([^/]+)\/workflow$/, handler: ({ id }) => workflow(id) },
  { method: 'POST', pattern: /^\/projects\/([^/]+)\/transitions$/, handler: ({ id, body }) => transition(id, body) },
  { method: 'GET', pattern: /^\/projects\/([^/]+)\/timeline$/, handler: ({ id }) => projectTimeline(id) },
  { method: 'POST', pattern: /^\/projects\/([^/]+)\/episodes\/([^/]+)\/actions$/, handler: ({ id, parts, body }) => episodeAction(id, Number(parts[3]), body) },
  { method: 'POST', pattern: /^\/projects\/([^/]+)\/batches\/([^/]+)\/trial$/, handler: ({ id, parts, body }) => batchTrial(id, Number(parts[3]), body) },
  { method: 'POST', pattern: /^\/projects\/([^/]+)\/batches\/([^/]+)\/package$/, handler: ({ id, parts, body }) => batchPackage(id, Number(parts[3]), body) },
  { method: 'GET', pattern: /^\/projects\/([^/]+)\/members$/, handler: ({ id }) => ok(projectOf(id).members ?? []) },
  { method: 'GET', pattern: /^\/projects\/([^/]+)\/summary$/, handler: ({ id }) => {
    const project = projectOf(id)
    const reports = rows('qualityReports').filter(
      (row) => row.project === id || String(row.object ?? '').includes(id),
    )
    const timelines = rows('timelines').filter((row) => row.project === id)
    for (const timeline of timelines) ensureTimelineClips(id, Number(timeline.ep), String(timeline.version))
    const projectCode = id.split('-')[1] ?? id
    const states = ensureEpisodeStates(id).sort((a, b) => Number(a.ep) - Number(b.ep))
    syncProjectStatus(project, states)
    return ok({
      project,
      stages: stageChain(project),
      episodeStates: states,
      episodeEvents: rows('episodeEvents').filter((row) => row.project === id).slice(0, 40),
      batchTrials: rows('batchTrials').filter((row) => row.project === id),
      scripts: rows('scripts').filter((row) => row.project === id),
      episodes: rows('episodes').filter((row) => row.project === id).slice(0, 30),
      assets: rows('assets').filter((row) => row.project === id),
      costs: rows('costs').filter((row) => row.project === id),
      tasks: rows('tasks').filter((row) => row.project === id),
      reviews: rows('reviews').filter((row) => row.project === id),
      notifications: rows('notifications').filter((row) => row.project === id),
      briefs: rows('briefs').filter((row) => row.project === id),
      plans: rows('plans').filter((row) => row.project === id),
      deliveries: rows('deliveries').filter((row) => row.project === id),
      qualityReports: reports,
      creativePlans: rows('creativePlans').filter((row) => row.project === id),
      briefModes: rows('briefModes'),
      scriptDiffs: rows('scriptDiff'),
      reviewChecklist: rows('reviewChecklist'),
      shots: rows('shots').filter((row) => row.project === id),
      characters: rows('characters').filter((row) => row.project === id),
      locations: rows('locations').filter((row) => row.project === id),
      props: rows('props').filter((row) => row.project === id),
      dialogues: rows('dialogues').filter((row) => row.project === id),
      voiceProfiles: rows('voiceProfiles').filter((row) => row.project === id),
      audioAssets: rows('audioAssets').filter((row) => row.project === id),
      subtitles: rows('subtitles').filter((row) => row.project === id).slice(0, 30),
      lipSync: rows('lipSync').filter((row) => String(row.line ?? '').includes(projectCode) || String(row.shot ?? '').includes(projectCode)),
      timelines,
      timelineClips: rows('timelineClips').filter((row) => row.project === id),
      qualityIssues: rows('qualityIssues').filter((row) => reports.some((report) => report.id === row.report)),
      qualityLevels: rows('qualityLevels'),
      qualityProfiles: ensureQualityProfiles(),
      qualityMatrix: rows('qualityMatrix'),
      rework: rows('reworkLedger').filter((row) => row.project === id),
      deliveryChecklist: rows('deliveryChecklist'),
    })
  } },
  { method: 'POST', pattern: /^\/scripts\/generate$/, handler: ({ body }) => generateScript(body) },
  { method: 'POST', pattern: /^\/scripts\/([^/]+)\/review$/, handler: ({ id, body }) => scriptReview(id, body) },
  { method: 'POST', pattern: /^\/generation\/tasks$/, handler: ({ body }) => createTask(body) },
  { method: 'POST', pattern: /^\/generation\/tasks\/([^/]+)\/(retry|cancel|pause)$/, handler: ({ id, parts }) => taskAction(id, parts[3] as 'retry' | 'cancel' | 'pause') },
  { method: 'GET', pattern: /^\/generation\/tasks\/([^/]+)\/attempts$/, handler: ({ id }) => ok(rows('attempts').filter((row) => row.task === id).map((row, index) => ({
    ...row,
    n: row.n ?? row.attempt ?? index + 1,
    fail: row.fail ?? row.reason ?? '—',
  }))) },
  { method: 'POST', pattern: /^\/quality\/run$/, handler: ({ body }) => runQuality(body) },
  { method: 'POST', pattern: /^\/quality-reports\/([^/]+)\/accept$/, handler: ({ id, body }) => acceptQualityReport(id, body) },
  { method: 'POST', pattern: /^\/rework$/, handler: ({ body }) => createRework(body) },
  { method: 'POST', pattern: /^\/reviews\/([^/]+)\/recheck$/, handler: ({ id, body }) => {
    const issue = byId('qualityIssues', id)
    issue.status = body.status ?? '已修复'
    store.persist()
    return ok(issue)
  } },
  { method: 'POST', pattern: /^\/episodes\/([^/]+)\/output$/, handler: ({ id, body }) => outputEpisode({ ...body, no: decodeURIComponent(id) }) },
  { method: 'POST', pattern: /^\/timelines\/([^/]+)\/rebuild$/, handler: ({ id, body }) => rebuildTimeline({ ...body, version: decodeURIComponent(id) }) },
  { method: 'POST', pattern: /^\/reviews$/, handler: ({ body }) => finalReview(body) },
  { method: 'POST', pattern: /^\/deliveries$/, handler: ({ body }) => delivery(body) },
  { method: 'POST', pattern: /^\/notifications\/([^/]+)\/read$/, handler: ({ id }) => {
    const row = byId('notifications', id)
    row.unread = false
    row.state = '已处理'
    store.persist()
    return ok(row)
  } },
  { method: 'POST', pattern: /^\/notifications\/read-all$/, handler: () => {
    rows('notifications').forEach((row) => { row.unread = false; row.state = '已处理' })
    store.persist()
    return ok({ ok: true })
  } },
  { method: 'GET', pattern: /^\/analytics\/(enterprise|me)$/, handler: ({ parts }) => analytics(parts[2] as 'enterprise' | 'me') },
  { method: 'GET', pattern: /^\/ops\/overview$/, handler: () => opsOverview() },
  { method: 'GET', pattern: /^\/ops\/queues$/, handler: () => opsQueues() },
  { method: 'GET', pattern: /^\/ops\/logs$/, handler: () => ok(rows('audits')) },
  { method: 'GET', pattern: /^\/ops\/config$/, handler: () => opsConfig() },
  { method: 'GET', pattern: /^\/costs\/summary$/, handler: () => costsSummary() },
  { method: 'GET', pattern: /^\/orgs\/grants$/, handler: () => ok(rows('projects').flatMap((project) => (project.members ?? []).map((member: Row) => ({ project: project.id, projectName: project.name, ...member })))) },
  { method: 'GET', pattern: /^\/identities$/, handler: () => ok(rows('identities').map((identity) => ({ ...identity, permissions: permissionsOf(String(identity.id)) }))) },
  { method: 'GET', pattern: /^\/orgs\/enterprise$/, handler: () => ok(store.dicts.enterprise ?? {}) },
  { method: 'GET', pattern: /^\/orgs\/handovers$/, handler: () => ok([]) },
  { method: 'GET', pattern: /^\/permissions$/, handler: () => ok(Object.entries(store.dicts.permissions ?? {}).map(([code, name]) => ({ code, name }))) },
]

export async function handleMock(path: string, init: RequestInit = {}): Promise<Envelope> {
  const url = new URL(path, 'http://mock.local')
  const method = (init.method ?? 'GET').toUpperCase()
  const body = init.body ? (JSON.parse(String(init.body)) as Row) : {}
  const pathname = url.pathname.replace(/^\/api\/v1/, '') || '/'
  const parts = pathname.split('/').filter(Boolean)

  await new Promise((resolve) => setTimeout(resolve, LATENCY))

  for (const route of CUSTOM) {
    if (route.method !== method) continue
    const match = route.pattern.exec(pathname)
    if (!match) continue
    const result = route.handler({ id: match[1] ?? '', body, query: url.searchParams, method, parts })
    return result as Envelope
  }

  const collection = collectionByPath.get(`/${parts[0]}`)
  if (collection) {
    if (parts.length === 1) {
      if (method === 'GET') return listRows(collection, url.searchParams)
      if (method === 'POST') return createRow(collection, body)
    }
    if (parts.length >= 2) {
      const id = decodeURIComponent(parts[1])
      if (method === 'GET') return ok(sliceRows(collection.table, [byId(collection.table, id, collection.field ?? 'id')])[0])
      if (method === 'PATCH' || method === 'PUT') return patchRow(collection, id, body)
      if (method === 'DELETE') return deleteRow(collection, id)
    }
  }

  throw new MockHttpError(404, 'mock_route_missing', `mock 未实现接口 ${method} ${pathname}`)
}

export const mockRuntime = {
  identity: currentIdentity,
  permissions: currentPermissions,
}
