import type { Row } from '../mock/db'
import { budgetText, budgetUsedUp } from './videoGate'

/** 报告结论与返工台账共用的状态口径；旧数据没有 status 时按待处理处理。 */
const CLOSED_ISSUE_STATUS = ['已修复', '已关闭', '已确认', '已豁免']

export function issueStatus(issue: Row): string {
  return String(issue.status ?? '待处理')
}

export function issueClosed(issue: Row): boolean {
  return CLOSED_ISSUE_STATUS.includes(issueStatus(issue))
}

export function highRiskIssues(issues: Row[]): Row[] {
  return issues.filter((issue) => String(issue.level ?? '') === '高' && !issueClosed(issue))
}

/**
 * 报告人工通过门禁。质量报告必须先关闭高风险项，才能从待复核/阻断转为通过；
 * 中低风险项允许在确认说明中记录放行依据。
 */
export function reportPassBlockReason(report: Row | null | undefined, issues: Row[]): string {
  if (!report) return '未找到质检报告，无法确认通过'
  if (String(report.result ?? '') === 'PASS') return '该报告已通过，无需重复确认'
  const high = highRiskIssues(issues)
  if (high.length) {
    const first = high[0]
    return `报告仍有 ${high.length} 项高风险问题未关闭（${first.dim ?? '未命名维度'} · ${first.where ?? '未标注位置'}），请完成返工并重新质检后再通过`
  }
  if (!issues.length && Number(report.fail ?? 0) > 0) {
    return `报告记录 ${report.fail} 个阻断项但问题明细未同步，暂不能通过`
  }
  return ''
}

export function qualityRunBlockReason(project?: Row | null): string {
  if (!project) return '未选择项目，无法执行质检'
  if (budgetUsedUp(project)) return `项目预算已用尽（${budgetText(project)}），不能发起新的质检`
  return ''
}

/** 同一对象只允许一个进行中返工；3 轮封顶后必须转人工，不再继续自动创建。 */
export function reworkCreateBlockReason(
  target: string,
  type: string,
  rows: Row[],
  project?: Row | null,
): string {
  const trimmed = String(target ?? '').trim()
  if (!trimmed) return '请填写返工对象（镜头、分集或音频 ID）'
  if (!String(type ?? '').trim()) return '请选择返工原因'
  const same = rows.filter((row) => {
    if (String(row.target ?? '').trim() !== trimmed) return false
    return !project?.id || !row.project || String(row.project) === String(project.id)
  })
  const active = same.find((row) => String(row.status ?? '') === '进行中')
  if (active) return `对象 ${trimmed} 已有进行中的返工单 ${active.id}，完成或转人工后再创建`
  const manual = same.find((row) => String(row.status ?? '') === '转人工')
  if (manual) return `对象 ${trimmed} 已有转人工返工单 ${manual.id}，需人工决策后才能继续`
  const maxRound = same.reduce((max, row) => Math.max(max, Number(row.round ?? 0)), 0)
  if (maxRound >= 3) return `对象 ${trimmed} 已返工 ${maxRound} 轮，达到 3 轮上限，需转人工决策`
  if (budgetUsedUp(project ?? undefined)) return `项目预算已用尽（${budgetText(project ?? undefined)}），不能新建返工`
  return ''
}

export function nextReworkRound(rows: Row[], target: string): number {
  const trimmed = String(target ?? '').trim()
  const maxRound = rows
    .filter((row) => String(row.target ?? '').trim() === trimmed)
    .reduce((max, row) => Math.max(max, Number(row.round ?? 0)), 0)
  return maxRound + 1
}
