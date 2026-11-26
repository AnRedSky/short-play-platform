import { describe, expect, it } from 'vitest'
import { budgetUsedUp, cancelBlockReason, findActiveTask, retryBlockReason } from '../../src/composables/videoGate'

const task = (patch: Record<string, unknown> = {}) => ({
  id: 'T-8842',
  project: 'SP-26031',
  ep: 17,
  shot: 'SH-04',
  kind: '视频生成',
  status: '失败',
  attempt: 1,
  maxAttempts: 3,
  ...patch,
})

describe('VD-01 task gates', () => {
  it('拒绝重试已完成任务，并指向预览页重新生成', () => {
    expect(retryBlockReason(task({ status: '成功' }))).toContain('预览页重新生成')
  })

  it('拒绝重试仍在排队或执行的任务，先要求取消', () => {
    expect(retryBlockReason(task({ status: '执行中' }))).toContain('先取消')
  })

  it('用满 maxAttempts 后不再允许重试', () => {
    expect(retryBlockReason(task({ attempt: 3, maxAttempts: 3 }))).toContain('3/3')
  })

  it('失败且未用满尝试次数时允许重试', () => {
    expect(retryBlockReason(task({ status: '失败', attempt: 2, maxAttempts: 3 }))).toBeNull()
  })

  it('已完成或已取消任务不能再次取消', () => {
    expect(cancelBlockReason(task({ status: '成功' }))).toContain('不能取消')
    expect(cancelBlockReason(task({ status: '已取消' }))).toContain('不能取消')
    expect(cancelBlockReason(task({ status: '执行中' }))).toBeNull()
  })

  it('预算用满或达到总额时阻断新任务', () => {
    expect(budgetUsedUp({ budget: 18000, actual: 18000 })).toBe(true)
    expect(budgetUsedUp({ budget: 18000, actual: 17000 })).toBe(false)
  })

  it('同一镜头同一类型只识别一个进行中任务', () => {
    const rows = [
      task({ id: 'T-1', status: '执行中' }),
      task({ id: 'T-2', status: '成功' }),
      task({ id: 'T-3', shot: 'SH-05', status: '排队中' }),
    ]
    expect(findActiveTask(rows, 17, 'SH-04')?.id).toBe('T-1')
    expect(findActiveTask(rows, 17, 'SH-06')).toBeNull()
  })
})
