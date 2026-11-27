import type { Row } from '../mock/db'

const CLOSED_STATUS = ['成功', '已完成', '已交付', '已取消']
const RETRYABLE_STATUS = ['失败', '待人工处理']

function number(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/** 只有失败或待人工处理的任务能重试；达到 maxAttempts 后必须人工决策。 */
export function taskRetryBlockReason(task: Row | null | undefined): string {
  if (!task) return '未找到任务，无法重试'
  const status = String(task.status ?? '')
  if (!RETRYABLE_STATUS.includes(status)) {
    return `当前状态为“${status || '未知'}”，只有失败或待人工处理任务可以重试`
  }
  const attempt = number(task.attempt)
  const max = Math.max(1, number(task.maxAttempts) || 3)
  if (attempt >= max) return `已尝试 ${attempt}/${max} 次，达到上限，需转人工或调整上限后重建任务`
  if (String(task.failReason ?? '').includes('不可重试') || String(task.failReason ?? '').includes('合规检测阻断')) {
    return '失败原因标记为不可重试，需修改输入、资产或合规问题后重建任务'
  }
  if (String(task.shot ?? '') === '—') return '任务没有可重放的镜头对象，需从上游重新提交'
  return ''
}

/** 成功、已完成、已交付与已取消任务不再允许取消；待人工任务可取消但需 L3 确认。 */
export function taskCancelBlockReason(task: Row | null | undefined): string {
  if (!task) return '未找到任务，无法取消'
  const status = String(task.status ?? '')
  if (CLOSED_STATUS.includes(status)) return `当前状态为“${status || '未知'}”，不能再次取消`
  return ''
}

/** 优先使用任务汇总失败成本；缺失时按尝试记录求和，避免详情与列表口径不一致。 */
export function taskCostTotal(task: Row | null | undefined, attempts: Row[] = []): number {
  const explicit = number(task?.failedCost)
  if (explicit > 0) return explicit
  return attempts.reduce((sum, attempt) => sum + number(attempt.cost), 0)
}

export function taskNextAttempt(task: Row): number {
  return number(task.attempt) + 1
}

export function taskCostText(cost: number): string {
  return cost > 0 ? `已产生调用成本 ¥${cost.toLocaleString('zh-CN')}，取消不退` : '尚未产生可计费调用，取消不产生新费用'
}

/** 取消影响必须同时说明成本、下游重排与审计保留。 */
export function taskCancelImpact(task: Row, cost: number, downstreamCount = 0): string {
  const downstream = downstreamCount > 0
    ? `下游 ${downstreamCount} 个依赖任务需要重新排队或改走替代结果。`
    : '当前没有直接下游任务依赖该结果。'
  return `取消 ${task.id} 后任务停在“已取消”，${taskCostText(cost)}；${downstream} 尝试记录与审计保留。`
}

/** 重试影响：第 N/M 次、同输入与原记录保留，失败仍可能计费。 */
export function taskRetryImpact(task: Row, cost: number): string {
  const max = Math.max(1, number(task.maxAttempts) || 3)
  const next = taskNextAttempt(task)
  const history = cost > 0 ? `此前已产生 ¥${cost.toLocaleString('zh-CN')}，不会因重试退回。` : '此前没有可计费失败调用。'
  return `将为 ${task.id} 新增第 ${next}/${max} 次尝试，沿用同一镜头输入与模型配置；${history} 原任务、旧尝试与审计保留。`
}

/** 下游任务数：任务依赖常写成“T-8842（同场景衔接）”，按任务 ID 子串匹配。 */
export function taskDownstreamCount(task: Row, allTasks: Row[]): number {
  const id = String(task.id ?? '')
  if (!id) return 0
  return allTasks.filter((row) => {
    if (String(row.id) === id) return false
    const deps = Array.isArray(row.deps) ? row.deps : []
    return deps.some((dep) => String(dep).includes(id))
  }).length
}
