import { describe, expect, it } from 'vitest'
import type { GateAction } from '../../src/mock/state'
import {
  actionImpact,
  actionTarget,
  isDangerAction,
  permissionLabel,
} from '../../src/composables/useGateActionRunner'

function action(overrides: Partial<GateAction> = {}): GateAction {
  return {
    key: 'archive',
    label: '归档项目',
    next: '已归档',
    permission: 'project.manage',
    ...overrides,
  } as GateAction
}

describe('gate action copy and safety', () => {
  it('把权限码转成可读权限名，未知码保留原码', () => {
    expect(permissionLabel('project.manage')).toBe('「项目管理」')
    expect(permissionLabel('custom.permission')).toBe('「custom.permission」')
    expect(permissionLabel(undefined)).toBe('「」')
  })

  it('服务端 hint 优先于本地影响文案', () => {
    expect(actionImpact(action())).toContain('归档后项目进入只读终态')
    expect(actionImpact(action({ hint: '该动作会释放 12 个制作席位' }))).toBe('该动作会释放 12 个制作席位')
    expect(actionImpact(action({ key: 'unknown' }))).toContain('写入审计日志')
  })

  it('暂停恢复动作的 next 文案正确', () => {
    expect(actionTarget(action({ next: '__prev__' }))).toBe('暂停前状态')
    expect(actionTarget(action())).toBe('「已归档」')
  })

  it('交付、归档、终止属于需要二次确认的危险动作', () => {
    expect(isDangerAction('deliver')).toBe(true)
    expect(isDangerAction('archive')).toBe(true)
    expect(isDangerAction('terminate')).toBe(true)
    expect(isDangerAction('pause')).toBe(false)
  })
})
