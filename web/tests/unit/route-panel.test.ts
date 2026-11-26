import { describe, expect, it } from 'vitest'
import { queryValue, withPanelQuery, withoutPanelQuery } from '../../src/composables/useRoutePanel'

describe('route panel query', () => {
  it('打开抽屉时保留列表筛选并写入 panel/id', () => {
    expect(withPanelQuery({ status: '在制', dept: '内容部' }, 'project', 'SP-26031')).toEqual({
      status: '在制',
      dept: '内容部',
      panel: 'project',
      id: 'SP-26031',
    })
  })

  it('重复打开抽屉时覆盖旧对象而不是叠加 panel 参数', () => {
    expect(withPanelQuery({ panel: 'project', id: 'SP-26031', status: '在制' }, 'project', 'SP-26028')).toEqual({
      status: '在制',
      panel: 'project',
      id: 'SP-26028',
    })
  })

  it('关闭时只移除当前抽屉参数，不误删其它域参数', () => {
    expect(withoutPanelQuery({ panel: 'project', id: 'SP-26031', tab: 'review', page: '2' }, 'project')).toEqual({
      tab: 'review',
      page: '2',
    })
    expect(withoutPanelQuery({ panel: 'asset', id: 'A-01' }, 'project')).toEqual({ panel: 'asset', id: 'A-01' })
  })

  it('数组或空 query 不视为有效抽屉 id', () => {
    expect(queryValue({ id: ['SP-1', 'SP-2'] }, 'id')).toBe('')
    expect(queryValue({ id: null }, 'id')).toBe('')
    expect(queryValue({ id: 'SP-26031' }, 'id')).toBe('SP-26031')
  })
})
