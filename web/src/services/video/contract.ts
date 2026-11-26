import type { Row } from '../../mock/db'

export interface GenerationTaskDto {
  id: string
  project_id: string
  capability: string
  provider_code: string
  model_code: string
  status: string
  attempt_count: number
  max_attempts: number
  error_message?: string | null
  request_payload: Record<string, unknown>
  result_payload: Record<string, unknown>
  created_at?: string | null
}

export interface TaskAttemptDto {
  attempt_number: number
  status: string
  error_code?: string | null
  started_at?: string | null
  finished_at?: string | null
}

const PAGE_STATUS: Record<string, string> = {
  pending: '排队中',
  queued: '排队中',
  retry_wait: '排队中',
  paused: '排队中',
  running: '执行中',
  cancel_requested: '执行中',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '失败',
}

const CAPABILITY_LABEL: Record<string, string> = {
  text_generation: '文本生成',
  image_generation: '图片生成',
  video_generation: '视频生成',
  tts: '音频合成',
  asr: '语音识别',
  music_generation: '音乐生成',
}

const KIND_CAPABILITY: Record<string, string> = {
  '视频生成': 'video_generation',
  '音频合成': 'tts',
  '语音合成': 'tts',
  '口型校验': 'video_generation',
  '参考资产校验': 'image_generation',
  '视觉理解': 'image_generation',
  '推理': 'text_generation',
  '媒体转码': 'video_generation',
}

const MODEL_BY_CAPABILITY: Record<string, string> = {
  text_generation: 'mock-text-1',
  image_generation: 'mock-image-1',
  video_generation: 'mock-video-1',
  tts: 'mock-tts-1',
  asr: 'mock-asr-1',
  music_generation: 'mock-music-1',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const taskIds = new Map<string, string>()

function paramsOf(task: GenerationTaskDto): Record<string, unknown> {
  const payload = task.request_payload ?? {}
  const params = payload.parameters
  return params && typeof params === 'object' ? (params as Record<string, unknown>) : {}
}

function numberOr(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clock(iso?: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function toTaskRow(task: GenerationTaskDto, projectCode: string): Row {
  const params = paramsOf(task)
  const displayId = `T-${task.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
  taskIds.set(displayId, task.id)
  const kind = String(params.kind_label ?? CAPABILITY_LABEL[task.capability] ?? task.capability)
  const result = task.result_payload ?? {}
  return {
    id: displayId,
    taskId: task.id,
    project: projectCode,
    ep: numberOr(params.episode_number, 0),
    scene: String(params.scene_label ?? '—'),
    shot: String(params.shot_label ?? '—'),
    kind,
    stage: String(params.stage ?? '视频生产'),
    status: PAGE_STATUS[task.status] ?? task.status,
    priority: String(params.priority ?? '中'),
    deps: [],
    parallelGroup: String(params.parallel_group ?? ''),
    input: String(params.input ?? `${projectCode} · ${kind}`),
    output: String(params.output ?? result.kind ?? '—'),
    model: task.model_code,
    config: task.provider_code,
    executor: String(params.executor ?? '—'),
    resourceOwner: String(params.resource_owner ?? '—'),
    attempt: task.attempt_count,
    maxAttempts: task.max_attempts,
    est: numberOr(params.est_seconds, 0),
    actual: numberOr(result.duration_seconds, 0),
    failedCost: 0,
    submitAt: clock(task.created_at),
    failReason: task.error_message || '—',
    qc: String(params.qc ?? '待检'),
  }
}

export function toAttemptRow(attempt: TaskAttemptDto, taskId: string): Row {
  return {
    id: `AT-${taskId}-${attempt.attempt_number}`,
    n: attempt.attempt_number,
    at: clock(attempt.started_at),
    status: attempt.status === 'succeeded' ? '成功' : attempt.status === 'failed' ? '失败' : '执行中',
    fail: attempt.error_code || '—',
  }
}

export function toCreatePayload(payload: Record<string, unknown>) {
  const project = String(payload.project ?? '')
  const kind = String(payload.kind ?? '视频生成')
  const capability = KIND_CAPABILITY[kind] ?? 'video_generation'
  const episode = numberOr(payload.ep, 0)
  const shot = String(payload.shot ?? '—')
  const scene = String(payload.scene ?? '—')
  const priority = String(payload.priority ?? '中')
  const est = numberOr(payload.est, 0)
  return {
    capability,
    prompt: `${kind} · ${project} · E${episode} ${shot} · ${priority}优先级 · ${est}s`,
    parameters: {
      episode_number: episode,
      shot_label: shot,
      scene_label: scene,
      priority,
      est_seconds: est,
      kind_label: kind,
      stage: String(payload.stage ?? '视频生产'),
      input: String(payload.input ?? `${project} · E${episode} ${shot}`),
      output: String(payload.output ?? (capability === 'video_generation' ? 'MP4 1080×1920' : '—')),
    },
    model_code: MODEL_BY_CAPABILITY[capability] ?? 'mock-default',
    provider_code: String(payload.provider ?? 'mock'),
    max_attempts: 3,
  }
}

export function rememberTask(displayId: string, backendId: string) {
  taskIds.set(displayId, backendId)
}

export function resolveTaskId(value: string): string {
  if (UUID_RE.test(value)) return value
  return taskIds.get(value) ?? value
}

export function idempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
