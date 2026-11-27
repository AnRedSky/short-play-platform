import type { Row } from '../mock/db'

export interface RightsWindow {
  date: Date | null
  daysLeft: number | null
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function parseDateOnly(value: unknown): Date | null {
  const match = String(value ?? '').match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

export function rightsWindow(row: Row, now = new Date()): RightsWindow {
  const date = parseDateOnly(row.validUntil ?? row.rights)
  if (!date) return { date: null, daysLeft: null }
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000)
  return { date, daysLeft: diff }
}

function textOf(row: Row): string {
  return `${String(row.rights ?? '')} ${String(row.status ?? '')}`
}

function hasMissingRights(row: Row): boolean {
  const text = textOf(row)
  return !String(row.rights ?? '').trim() || /授权不明确|待补授权|授权缺失|阻断交付/.test(text)
}

export function entitlementBlockReason(row: Row, label: string, now = new Date()): string | null {
  if (hasMissingRights(row)) return `${label}授权依据不完整，不能用于生成；请先补授权或续期`
  if (String(row.status ?? '').includes('停用')) return `${label}已停用，不能用于生成`
  if (/待复核|到期/.test(String(row.status ?? ''))) return `${label}状态为「${row.status}」，需复核授权后才能使用`
  const window = rightsWindow(row, now)
  if (!window.date) return `${label}未登记授权到期日，不能用于生成；请补充有效期`
  if ((window.daysLeft ?? 0) < 0) return `${label}授权已于 ${String(row.validUntil)} 到期，不能用于生成；请先续期`
  return null
}

export function voiceBlockReason(profile: Row | undefined, now = new Date()): string | null {
  if (!profile) return '未找到对应音色档案，不能生成对白'
  if (String(profile.status ?? '') !== '启用') {
    return `音色 ${profile.id} 状态为「${profile.status}」，需复核授权后才能使用`
  }
  return entitlementBlockReason(profile, `音色 ${profile.id}`, now)
}

export function audioAssetBlockReason(asset: Row | undefined, now = new Date()): string | null {
  if (!asset) return '未找到音频资产，不能用于混音'
  if (String(asset.status ?? '') === '阻断') return `音频资产 ${asset.id} 已被阻断，不能用于混音`
  return entitlementBlockReason(asset, `音频资产 ${asset.id}`, now)
}

export function expiringSoon(row: Row, now = new Date(), days = 7): boolean {
  const window = rightsWindow(row, now)
  return window.daysLeft !== null && window.daysLeft >= 0 && window.daysLeft <= days
}

export function extractVoiceProfileId(value: unknown): string {
  return String(value ?? '').match(/VO-\d+/)?.[0] ?? ''
}

export function dialogueScopeRows(rows: Row[], scope: unknown): Row[] {
  if (String(scope) === 'all') return rows
  return rows.filter((row) => ['待生成', '已退回', '待'].includes(String(row.status ?? '')))
}

export function findActiveAudioTask(tasks: Row[], ep: unknown, profile: string): Row | null {
  return tasks.find((task) => (
    String(task.kind ?? '') === '音频合成'
    && String(task.config ?? '') === profile
    && Number(task.ep) === Number(ep)
    && String(task.input ?? '').startsWith('批量对白')
    && ['待执行', '排队中', '执行中'].includes(String(task.status ?? ''))
  )) ?? null
}

export function dialogueBatchBlockReason(
  rows: Row[],
  profile: Row | undefined,
  project: Row | undefined,
  tasks: Row[],
  scope: unknown,
  now = new Date(),
): string | null {
  const targets = dialogueScopeRows(rows, scope)
  if (!targets.length) return '当前没有待生成对白的镜头；请切换范围或先补齐台词'
  if (!profile) return '请先选择有效的音色档案'
  const voiceBlocked = voiceBlockReason(profile, now)
  if (voiceBlocked) return voiceBlocked
  if (Number(project?.budget ?? 0) > 0 && Number(project?.actual ?? 0) >= Number(project?.budget ?? 0)) {
    return `预算已用 100%（¥${Number(project?.actual ?? 0).toLocaleString('zh-CN')} / ¥${Number(project?.budget ?? 0).toLocaleString('zh-CN')}），不能提交批量配音`
  }
  const active = [...new Set(targets.map((row) => Number(row.ep)))].find((ep) => findActiveAudioTask(tasks, ep, String(profile.id)))
  if (active) return `第 ${active} 集已有使用音色 ${profile.id} 的进行中批量配音任务，不能重复提交`
  return null
}

export function lipSyncBlockReason(
  subtitles: Row[],
  tasks: Row[],
  ep: unknown,
  project: Row | undefined,
): string | null {
  const rows = subtitles.filter((row) => Number(row.ep) === Number(ep))
  if (!rows.length) return `第 ${ep} 集暂无字幕版本，不能提交口型校验；请先完成字幕`
  if (rows.some((row) => ['需重做', '待处理', '待校对', '待'].includes(String(row.status ?? '')))) {
    return `第 ${ep} 集字幕未通过校对（${rows.map((row) => row.status).join(' / ')}），不能提交口型校验`
  }
  const active = tasks.find((task) => (
    String(task.kind ?? '') === '口型校验'
    && Number(task.ep) === Number(ep)
    && ['待执行', '排队中', '执行中'].includes(String(task.status ?? ''))
  ))
  if (active) return `第 ${ep} 集已有进行中的口型校验任务 ${active.id}，不能重复提交`
  if (Number(project?.budget ?? 0) > 0 && Number(project?.actual ?? 0) >= Number(project?.budget ?? 0)) {
    return '预算已用 100%，不能提交口型校验'
  }
  return null
}
