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
