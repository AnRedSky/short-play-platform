import { describe, expect, it } from 'vitest'
import type { Row } from '../../src/mock/db'
import {
  modelProfileCreateBlockReason,
  providerTestBlockReason,
  routeEditBlockReason,
  routeImpactTasks,
  routeImpactText,
  type RouteDraft,
} from '../../src/composables/modelGate'

const providers: Row[] = [
  { id: 'PRV-01', name: '视频供应商 A', status: '启用', test: '已验证 · 2026-11-20 09:12' },
  { id: 'PRV-07', name: '图像供应商 B', status: '停用', test: '失效 · 鉴权失败 2026-11-21' },
  { id: 'PRV-09', name: '新供应商', status: '启用', test: '未测试' },
]

const models: Row[] = [
  { id: 'MP-01', provider: 'PRV-01', model: 'video-a-2.1', cap: '视频生成', status: '启用', license: '商用可用' },
  { id: 'MP-02', provider: 'PRV-01', model: 'video-b-1.0', cap: '视频生成', status: '启用', license: '商用可用 · 不可作主生产' },
  { id: 'MP-03', provider: 'PRV-01', model: 'vision-v2', cap: '视觉理解', status: '启用', license: '商用可用' },
  { id: 'MP-04', provider: 'PRV-09', model: 'video-c-1', cap: '视频生成', status: '启用', license: '商用可用' },
  { id: 'MP-05', provider: 'PRV-07', model: 'image-a-2', cap: '图像生成', status: '启用', license: '商用可用' },
  { id: 'MP-06', provider: 'PRV-01', model: 'video-d-1', cap: '视频生成', status: '停用', license: '商用可用' },
]

const capabilities: Row[] = [{ cap: '视频生成' }, { cap: '视觉理解' }]

function draft(overrides: Partial<RouteDraft> = {}): RouteDraft {
  return { primaryId: 'MP-01', backupId: '', fallback: '自动降级', reason: '主模型切换', ...overrides }
}

describe('modelGate', () => {
  it('停用供应商不能测试连通性', () => {
    expect(providerTestBlockReason(providers[1])).toContain('已停用')
    expect(providerTestBlockReason(providers[0])).toBe('')
  })

  it('新增模型档案要求供应商已启用且已验证', () => {
    const body = { provider: 'PRV-09', model: 'video-x', cap: '视频生成', io: '文 → 视频', limits: '≤ 8s', price: '¥3 / 秒', license: '商用可用' }
    expect(modelProfileCreateBlockReason(body, providers, models, capabilities)).toContain('尚未通过连通性验证')
    expect(modelProfileCreateBlockReason({ ...body, provider: 'PRV-01', model: 'video-x' }, providers, models, capabilities)).toBe('')
  })

  it('新增模型档案拒绝重复模型标识与缺失字段', () => {
    const body = { provider: 'PRV-01', model: 'video-a-2.1', cap: '视频生成', io: '文 → 视频', limits: '≤ 8s', price: '¥3 / 秒', license: '商用可用' }
    expect(modelProfileCreateBlockReason(body, providers, models, capabilities)).toContain('已存在模型')
    expect(modelProfileCreateBlockReason({ ...body, model: 'video-new', price: '' }, providers, models, capabilities)).toContain('计费单价')
  })

  it('调整路由必须选择主模型', () => {
    expect(routeEditBlockReason('视频生成', draft({ primaryId: '' }), models, providers)).toContain('请选择主模型')
  })

  it('主模型能力不符时阻断', () => {
    expect(routeEditBlockReason('视频生成', draft({ primaryId: 'MP-03' }), models, providers)).toContain('属于「视觉理解」')
  })

  it('不可作主生产与停用档案只能作备选或不可用', () => {
    expect(routeEditBlockReason('视频生成', draft({ primaryId: 'MP-02' }), models, providers)).toContain('只能作为备选')
    expect(routeEditBlockReason('视频生成', draft({ primaryId: 'MP-06' }), models, providers)).toContain('当前状态为「停用」')
  })

  it('主模型供应商停用或未验证时阻断', () => {
    expect(routeEditBlockReason('图像生成', draft({ primaryId: 'MP-05' }), models, providers)).toContain('当前状态为「停用」')
    expect(routeEditBlockReason('视频生成', draft({ primaryId: 'MP-04' }), models, providers)).toContain('尚未通过连通性验证')
  })

  it('备选必须与主模型不同且同能力', () => {
    expect(routeEditBlockReason('视频生成', draft({ backupId: 'MP-01' }), models, providers)).toContain('需与主模型不同')
    expect(routeEditBlockReason('视频生成', draft({ backupId: 'MP-03' }), models, providers)).toContain('属于「视觉理解」')
  })

  it('变更原因缺失时阻断，合法主备放行', () => {
    expect(routeEditBlockReason('视频生成', draft({ reason: '' }), models, providers)).toContain('请填写路由变更原因')
    expect(routeEditBlockReason('视频生成', draft({ backupId: 'MP-02' }), models, providers)).toBe('')
  })

  it('按能力映射未完成任务，并说明只影响新任务', () => {
    const tasks: Row[] = [
      { id: 'T-8842', kind: '视频生成', status: '执行中' },
      { id: 'T-8843', kind: '视频生成', status: '排队中' },
      { id: 'T-8820', kind: '单集质检', status: '成功' },
      { id: 'T-8839', kind: '对白配音', status: '执行中' },
      { id: 'T-9001', kind: '视频生成', status: '已取消' },
    ]
    expect(routeImpactTasks(tasks, '视频生成').map((task) => task.id)).toEqual(['T-8842', 'T-8843'])
    expect(routeImpactTasks(tasks, '语音合成').map((task) => task.id)).toEqual(['T-8839'])
    expect(routeImpactText(tasks, '视频生成')).toContain('2 个未完成任务')
    expect(routeImpactText(tasks, '视频生成')).toContain('只影响之后新建的任务')
    expect(routeImpactText(tasks, '音乐生成')).toContain('没有未完成任务')
  })
})
