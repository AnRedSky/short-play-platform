import { describe, expect, it } from 'vitest'
import type { Row } from '../../src/mock/db'
import { assetRegisterBlockReason, assetRightsBlockReason } from '../../src/composables/assetGate'

const readyAsset: Row = {
  id: 'A-1201',
  name: '顾沉 · 正面人物设定',
  cat: '人物资产',
  type: '人物参考图',
  rights: 'AI 生成 · 无需真人授权',
  qc: '已确认',
  status: '正式',
}

describe('assetGate', () => {
  it('授权不明确的资产阻断生产', () => {
    const blocked = assetRightsBlockReason({ ...readyAsset, rights: '授权不明确' })
    expect(blocked).toContain('授权不明确')
    expect(blocked).toContain('补授权')
  })

  it('待替换素材阻断生产', () => {
    expect(assetRightsBlockReason({ ...readyAsset, rights: '待替换' })).toContain('待替换')
  })

  it('授权已到期时阻断', () => {
    const blocked = assetRightsBlockReason(
      { ...readyAsset, rightsExpiry: '2026-10-01' },
      '2026-11-27',
    )
    expect(blocked).toContain('2026-10-01')
    expect(blocked).toContain('到期')
  })

  it('质检失败或状态阻断时给出原因', () => {
    expect(assetRightsBlockReason({ ...readyAsset, qc: 'FAIL（合规）' })).toContain('质检未通过')
    expect(assetRightsBlockReason({ ...readyAsset, status: '阻断交付' })).toContain('阻断交付')
  })

  it('授权与质检都满足时允许放行', () => {
    expect(assetRightsBlockReason(readyAsset, '2026-11-27')).toBe('')
  })

  it('登记资产必填字段逐项校验', () => {
    expect(assetRegisterBlockReason({}, '2026-11-27')).toContain('资产名')
    expect(assetRegisterBlockReason({ name: '测试资产' }, '2026-11-27')).toContain('分类')
    expect(assetRegisterBlockReason({ name: '测试资产', cat: '人物资产' }, '2026-11-27')).toContain('类型')
    expect(assetRegisterBlockReason({ name: '测试资产', cat: '人物资产', type: '人物参考图' }, '2026-11-27')).toContain('授权标记')
  })

  it('登记时授权到期日不能早于今天或格式错误', () => {
    const base = { name: '测试资产', cat: '人物资产', type: '人物参考图', rights: 'AI 生成' }
    expect(assetRegisterBlockReason({ ...base, rightsExpiry: '2026-10-01' }, '2026-11-27')).toContain('早于今天')
    expect(assetRegisterBlockReason({ ...base, rightsExpiry: '2026/10/01' }, '2026-11-27')).toContain('YYYY-MM-DD')
    expect(assetRegisterBlockReason({ ...base, rightsExpiry: '2026-12-31' }, '2026-11-27')).toBe('')
  })
})
