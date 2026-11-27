import { describe, expect, it } from 'vitest'
import type { Row } from '../../src/mock/db'
import {
  highRiskIssues,
  issueClosed,
  nextReworkRound,
  qualityRunBlockReason,
  reportPassBlockReason,
  reworkCreateBlockReason,
} from '../../src/composables/qualityGate'

const project: Row = { id: 'SP-26031', budget: 18000, actual: 9260 }
const report: Row = {
  id: 'QR-26031-E17-03',
  result: 'REVIEW_REQUIRED',
  issues: 3,
  review: 3,
  fail: 0,
}
const highIssue: Row = {
  report: 'QR-26031-E17-03',
  dim: '内容合规',
  where: 'E17 / S03 / SH-05 · 00:03',
  level: '高',
  action: '阻断下游',
}
const mediumIssue: Row = {
  report: 'QR-26031-E17-03',
  dim: '人物一致性',
  where: 'E17 / S03 / SH-05 · 00:03',
  level: '中',
  action: '局部重生成',
}

describe('qualityGate', () => {
  it('高风险问题未关闭时阻断报告通过', () => {
    const blocked = reportPassBlockReason(report, [highIssue])
    expect(blocked).toContain('1 项高风险问题未关闭')
    expect(blocked).toContain('内容合规')
  })

  it('高风险问题关闭后允许人工通过', () => {
    const closed = { ...highIssue, status: '已修复' }
    expect(issueClosed(closed)).toBe(true)
    expect(highRiskIssues([closed, mediumIssue])).toHaveLength(0)
    expect(reportPassBlockReason(report, [closed, mediumIssue])).toBe('')
  })

  it('旧数据没有状态时按待处理处理', () => {
    expect(issueClosed(highIssue)).toBe(false)
    expect(reportPassBlockReason(report, [highIssue])).not.toBe('')
  })

  it('已通过的报告不重复确认', () => {
    expect(reportPassBlockReason({ ...report, result: 'PASS' }, [])).toContain('无需重复确认')
  })

  it('报告有阻断项但问题明细缺失时不允许通过', () => {
    expect(reportPassBlockReason({ ...report, fail: 2 }, [])).toContain('问题明细未同步')
  })

  it('未选择项目或预算用尽时阻断质检', () => {
    expect(qualityRunBlockReason(null)).toContain('未选择项目')
    expect(qualityRunBlockReason({ id: 'SP-26007', budget: 26000, actual: 26000 })).toContain('预算已用尽')
    expect(qualityRunBlockReason(project)).toBe('')
  })

  it('返工对象与原因必填', () => {
    expect(reworkCreateBlockReason('', '人物不一致', [], project)).toContain('请填写返工对象')
    expect(reworkCreateBlockReason('SH-26031-E17-06', '', [], project)).toContain('请选择返工原因')
  })

  it('同一对象进行中或已转人工时阻断新建', () => {
    const rows: Row[] = [{
      id: 'RW-26031-014',
      project: 'SP-26031',
      target: 'SH-26031-E17-05',
      round: 1,
      status: '进行中',
    }]
    expect(reworkCreateBlockReason('SH-26031-E17-05', '人物不一致', rows, project)).toContain('进行中的返工单')
    rows[0].status = '转人工'
    expect(reworkCreateBlockReason('SH-26031-E17-05', '人物不一致', rows, project)).toContain('需人工决策')
  })

  it('返工达到 3 轮或预算用尽时阻断新建', () => {
    const rows: Row[] = [{
      id: 'RW-26015-009',
      project: 'SP-26015',
      target: 'SH-26015-E09-02',
      round: 3,
      status: '已修复',
    }]
    expect(reworkCreateBlockReason('SH-26015-E09-02', '合规风险', rows, { id: 'SP-26015', budget: 16000, actual: 14420 })).toContain('达到 3 轮上限')
    expect(reworkCreateBlockReason('SH-26015-E10-01', '合规风险', [], { id: 'SP-26015', budget: 16000, actual: 16000 })).toContain('预算已用尽')
  })

  it('新返工轮次按同对象历史最大值递增', () => {
    const rows: Row[] = [
      { target: 'SH-26031-E17-06', round: 1 },
      { target: 'SH-26031-E17-06', round: 2 },
      { target: 'SH-26031-E17-05', round: 3 },
    ]
    expect(nextReworkRound(rows, 'SH-26031-E17-06')).toBe(3)
    expect(nextReworkRound(rows, 'SH-26031-E17-07')).toBe(1)
  })
})
