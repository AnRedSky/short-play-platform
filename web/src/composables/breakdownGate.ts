import type { Row } from '../mock/db'

export interface BreakdownIssue {
  rowId: string
  ep: string
  scene: string
  no: string
  field: string
  label: string
}

const REQUIRED_FIELDS = [
  { key: 'ep', label: '集号' },
  { key: 'scene', label: '场号' },
  { key: 'no', label: '镜号' },
  { key: 'desc', label: '画面描述' },
  { key: 'chars', label: '人物' },
  { key: 'duration', label: '时长' },
] as const

function text(value: unknown): string {
  return String(value ?? '').trim()
}

/** 拆解结果的生产准入校验：每个镜头只报第一个缺失字段，避免一个镜头刷屏。 */
export function findBreakdownIssues(rows: Row[]): BreakdownIssue[] {
  const issues: BreakdownIssue[] = []
  for (const row of rows) {
    const missing = REQUIRED_FIELDS.find((field) => !text(row[field.key]))
    if (!missing) continue
    issues.push({
      rowId: text(row.id),
      ep: text(row.ep),
      scene: text(row.scene),
      no: text(row.no),
      field: missing.key,
      label: missing.label,
    })
  }
  return issues
}

export function formatBreakdownIssue(issue: BreakdownIssue): string {
  const shot = issue.no || issue.rowId || '未知镜头'
  const location = [issue.ep ? `第 ${issue.ep} 集` : '', issue.scene ? `场 ${issue.scene}` : ''].filter(Boolean).join(' / ')
  return `镜头 ${shot}${location ? `（${location}）` : ''}缺少${issue.label}，不能进入生产`
}

const SHOT_CONTRACT_FIELDS = [
  { key: 'ep', label: '集号' },
  { key: 'scene', label: '场号' },
  { key: 'no', label: '镜号' },
  { key: 'desc', label: '画面描述' },
  { key: 'frame', label: '景别' },
  { key: 'angle', label: '机位' },
  { key: 'move', label: '运镜' },
  { key: 'chars', label: '人物' },
  { key: 'duration', label: '时长' },
  { key: 'refs', label: '引用资产' },
  { key: 'model', label: '模型' },
  { key: 'quality', label: '质检项' },
] as const

/** 镜头契约：派发视频任务前必须完整，缺任一字段都不能提交生成。 */
export function findShotContractIssues(rows: Row[]): BreakdownIssue[] {
  const issues: BreakdownIssue[] = []
  for (const row of rows) {
    const missing = SHOT_CONTRACT_FIELDS.find((field) => !text(row[field.key]))
    if (!missing) continue
    issues.push({
      rowId: text(row.id),
      ep: text(row.ep),
      scene: text(row.scene),
      no: text(row.no),
      field: missing.key,
      label: missing.label,
    })
  }
  return issues
}

export function formatShotContractIssue(issue: BreakdownIssue): string {
  const shot = issue.no || issue.rowId || '未知镜头'
  const location = issue.ep ? `第 ${issue.ep} 集` : ''
  return `镜头 ${shot}${location ? `（${location}）` : ''}缺少${issue.label}，不能提交生成`
}
