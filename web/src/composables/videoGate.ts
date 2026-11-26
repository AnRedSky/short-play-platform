import type { Row } from '../mock/db'

/** 任务重试的服务端前置条件在前端先解释；真正的 attempt 上限仍由后端权威校验。 */
export function retryBlockReason(task: Row): string | null {
  const status = String(task.status ?? '')
  if (['成功', '已完成'].includes(status)) return '任务已完成，如需新版本请在预览页重新生成'
  if (!['失败', '已取消'].includes(status)) return '任务尚未失败，无需重试；如需重跑请先取消'
  const attempt = Number(task.attempt ?? 0)
  const max = Number(task.maxAttempts ?? 0)
  if (max > 0 && attempt >= max) return `已用满 ${attempt}/${max} 次尝试，不能重试；请新建生成任务`
  return null
}

/** 取消是不可逆动作：执行中与待执行可取消，已完成和已取消不重复提交。 */
export function cancelBlockReason(task: Row): string | null {
  const status = String(task.status ?? '')
  if (['成功', '已完成', '已取消'].includes(status)) return `当前为${status}，不能取消`
  return null
}

export function budgetUsedUp(project?: Row): boolean {
  const total = Number(project?.budget ?? 0)
  return total > 0 && Number(project?.actual ?? 0) >= total
}

export function budgetText(project?: Row): string {
  const actual = Number(project?.actual ?? 0)
  const total = Number(project?.budget ?? 0)
  return `¥${actual.toLocaleString('zh-CN')} / ¥${total.toLocaleString('zh-CN')}`
}

/** 同一镜头同一类型只允许一个进行中任务，避免重复提交造成双计费。 */
export function findActiveTask(tasks: Row[], ep: unknown, shot: unknown, kind = '视频生成'): Row | null {
  return tasks.find((task) => (
    Number(task.ep) === Number(ep)
    && String(task.shot) === String(shot)
    && String(task.kind) === kind
    && ['待执行', '排队中', '执行中'].includes(String(task.status))
  )) ?? null
}
