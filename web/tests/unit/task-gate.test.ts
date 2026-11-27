import { describe, expect, it } from 'vitest'
import type { Row } from '../../src/mock/db'
import {
  taskCancelBlockReason,
  taskCancelImpact,
  taskCostTotal,
  taskDownstreamCount,
  taskNextAttempt,
  taskRetryBlockReason,
  taskRetryImpact,
} from '../../src/composables/taskGate'

const failedTask: Row = {
  id: 'T-8824',
  project: 'SP-26031',
  status: '失败',
  shot: 'SH-06',
  attempt: 1,
  maxAttempts: 3,
  failedCost: 24.4,
  failReason: '供应商超时（可重试）',
}

describe('taskGate', () => {
  it('只有失败或待人工任务可以重试', () => {
    expect(taskRetryBlockReason({ ...failedTask, status: '执行中' })).toContain('只有失败或待人工处理')
    expect(taskRetryBlockReason({ ...failedTask, status: '成功' })).toContain('只有失败或待人工处理')
    expect(taskRetryBlockReason(failedTask)).toBe('')
  })

  it('达到 maxAttempts 后阻断重试', () => {
    const blocked = taskRetryBlockReason({ ...failedTask, attempt: 3, maxAttempts: 3 })
    expect(blocked).toContain('3/3')
    expect(blocked).toContain('上限')
  })

  it('不可重试与合规阻断不能直接重放', () => {
    expect(taskRetryBlockReason({ ...failedTask, failReason: '合规检测阻断：疑似警用标识' })).toContain('不可重试')
    expect(taskRetryBlockReason({ ...failedTask, failReason: '模型返回不可重试错误' })).toContain('不可重试')
  })

  it('没有镜头对象的任务不能重试', () => {
    expect(taskRetryBlockReason({ ...failedTask, shot: '—' })).toContain('没有可重放的镜头对象')
  })

  it('成功、已完成、已交付与已取消不能再次取消', () => {
    for (const status of ['成功', '已完成', '已交付', '已取消']) {
      expect(taskCancelBlockReason({ ...failedTask, status })).toContain('不能再次取消')
    }
    expect(taskCancelBlockReason({ ...failedTask, status: '待人工处理' })).toBe('')
  })

  it('成本优先读汇总字段，缺失时按尝试合计', () => {
    expect(taskCostTotal(failedTask, [])).toBe(24.4)
    expect(taskCostTotal({ ...failedTask, failedCost: 0 }, [
      { cost: 12 },
      { cost: 8.6 },
    ])).toBe(20.6)
  })

  it('重试影响说明第 N/M 次、费用与记录保留', () => {
    const text = taskRetryImpact(failedTask, 24.4)
    expect(text).toContain('第 2/3 次')
    expect(text).toContain('¥24.4')
    expect(text).toContain('审计保留')
    expect(taskNextAttempt(failedTask)).toBe(2)
  })

  it('取消影响说明成本与下游重排', () => {
    const text = taskCancelImpact(failedTask, 24.4, 2)
    expect(text).toContain('取消不退')
    expect(text).toContain('下游 2 个')
    expect(text).toContain('审计保留')
  })

  it('按任务 ID 统计直接下游依赖', () => {
    const rows: Row[] = [
      failedTask,
      { id: 'T-9001', deps: ['T-8824（同场景衔接）'] },
      { id: 'T-9002', deps: ['T-8823（无关）'] },
    ]
    expect(taskDownstreamCount(failedTask, rows)).toBe(1)
  })
})
