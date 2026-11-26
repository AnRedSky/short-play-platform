import { describe, expect, it } from 'vitest'
import { findBreakdownIssues, formatBreakdownIssue } from '../../src/composables/breakdownGate'

function shot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'SH-26031-E12-03',
    ep: 12,
    scene: '03',
    no: 'SH-03',
    desc: '顾沉推门进入仓库，灯管闪烁',
    chars: '顾沉',
    duration: '7 秒',
    ...overrides,
  }
}

describe('breakdown production gate', () => {
  it('字段完整时没有阻断项', () => {
    expect(findBreakdownIssues([shot()])).toEqual([])
  })

  it('缺画面描述时只报第一个缺失字段，并给出可定位镜头', () => {
    const issues = findBreakdownIssues([shot({ desc: '  ' })])
    expect(issues).toEqual([
      { rowId: 'SH-26031-E12-03', ep: '12', scene: '03', no: 'SH-03', field: 'desc', label: '画面描述' },
    ])
    expect(formatBreakdownIssue(issues[0])).toBe('镜头 SH-03（第 12 集 / 场 03）缺少画面描述，不能进入生产')
  })

  it('缺集号或场号时同样阻断，不因镜头号存在而放行', () => {
    expect(findBreakdownIssues([shot({ ep: undefined })])[0].label).toBe('集号')
    expect(findBreakdownIssues([shot({ scene: '' })])[0].label).toBe('场号')
  })
})
