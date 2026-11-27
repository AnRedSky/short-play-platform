/**
 * Mock API 服务：与真实后端同构的 REST 契约（/api/v1）。
 * 前端只调 api 层；VITE_DATA_MODE=mock 时请求进入这里，切到 real 时同一份代码改用后端。
 */
import { nextId, now, store, type Row } from './db'
import { GATE_ACTIONS, allowedActions, permissionsOf, progressOf, stageChain } from './state'
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
    batch: Math.ceil(ep / 6),
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
  } else if (action === 'lockAssets') {
    if (!state.scriptLocked) throw new MockHttpError(409, 'episode_script_gate', '请先锁定 E1 剧本')
    if (state.assetsLocked) return ok({ state, message: '资产已锁定' })
    requireStep('E2')
    state.assetsLocked = true
    state.modelBaseline = String(body.model ?? state.modelBaseline ?? '视频模型 A')
    touch('E3', '生产中', reason || `镜头契约与资产已锁定；模型基线 ${state.modelBaseline}`)
  } else if (action === 'startProduction') {
    if (!state.assetsLocked) throw new MockHttpError(409, 'episode_asset_gate', '请先锁定 E2 镜头与资产')
    const shots = rows('shots').filter((row) => row.project === projectId && Number(row.ep) === ep)
    if (!shots.length) throw new MockHttpError(409, 'episode_shot_empty', '本集没有可生产的镜头')
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
      note: reason || '单集 QC 阻断：字幕错字与口型偏移',
    }
    rows('qualityReports').unshift(report)
    rows('qualityIssues').unshift({
      id: nextId('QI', 'qualityIssues'),
      report: report.id,
      dim: '字幕与口型',
      where: `E${pad2(ep)} / S01 / SH-01 · 00:03`,
      level: '高',
      action: '退回 E5 校对字幕并重做口型；复检通过后再确认 QC',
      auto: '是',
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
  if (!currentPermissions().includes(action.permission)) {
    throw new MockHttpError(403, 'forbidden', `当前身份缺少权限 ${action.permission}`)
  }
  if (action.needReason && !String(body.reason ?? '').trim()) {
    throw new MockHttpError(422, 'reason_required', '该动作必须填写原因')
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

function scriptReview(id: string, body: Row): Envelope {
  const script = byId('scripts', id)
  const result = String(body.result ?? '通过')
  const project = rows('projects').find((row) => row.id === script.project)
  script.status = result === '通过' ? '已通过 · 正式版本' : '已退回'
  script.locked = result === '通过'
  script.updatedAt = now()
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
  { method: 'POST', pattern: /^\/providers\/test-all$/, handler: () => testAllProviders() },
  { method: 'POST', pattern: /^\/providers\/([^/]+)\/test$/, handler: ({ id }) => testProvider(decodeURIComponent(id)) },
  { method: 'POST', pattern: /^\/model-profiles$/, handler: ({ body }) => createModelProfile(body) },
  { method: 'GET', pattern: /^\/capabilities\/([^/]+)\/impact$/, handler: ({ id }) => routeImpact(decodeURIComponent(id)) },
  { method: 'POST', pattern: /^\/capabilities\/([^/]+)\/route$/, handler: ({ id, body }) => updateCapabilityRoute(decodeURIComponent(id), body) },
  { method: 'GET', pattern: /^\/projects\/([^/]+)\/workflow$/, handler: ({ id }) => workflow(id) },
  { method: 'POST', pattern: /^\/projects\/([^/]+)\/transitions$/, handler: ({ id, body }) => transition(id, body) },
  { method: 'GET', pattern: /^\/projects\/([^/]+)\/timeline$/, handler: ({ id }) => projectTimeline(id) },
  { method: 'POST', pattern: /^\/projects\/([^/]+)\/episodes\/([^/]+)\/actions$/, handler: ({ id, parts, body }) => episodeAction(id, Number(parts[3]), body) },
  { method: 'GET', pattern: /^\/projects\/([^/]+)\/members$/, handler: ({ id }) => ok(projectOf(id).members ?? []) },
  { method: 'GET', pattern: /^\/projects\/([^/]+)\/summary$/, handler: ({ id }) => {
    const project = projectOf(id)
    const reports = rows('qualityReports').filter(
      (row) => row.project === id || String(row.object ?? '').includes(id),
    )
    const timelines = rows('timelines').filter((row) => row.project === id)
    for (const timeline of timelines) ensureTimelineClips(id, Number(timeline.ep), String(timeline.version))
    const projectCode = id.split('-')[1] ?? id
    return ok({
      project,
      stages: stageChain(project),
      episodeStates: ensureEpisodeStates(id).sort((a, b) => Number(a.ep) - Number(b.ep)),
      episodeEvents: rows('episodeEvents').filter((row) => row.project === id).slice(0, 40),
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
      qualityMatrix: rows('qualityMatrix'),
      rework: rows('reworkLedger').filter((row) => row.project === id),
      deliveryChecklist: rows('deliveryChecklist'),
    })
  } },
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
