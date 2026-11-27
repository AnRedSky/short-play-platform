import type { Row } from '../mock/db'

export interface RouteDraft {
  primaryId: string
  backupId: string
  fallback: string
  reason: string
}

const ACTIVE_TASK_STATUSES = ['待执行', '排队中', '执行中', '待人工处理']

const CAPABILITY_TASK_KINDS: Record<string, string[]> = {
  文本生成: ['文本生成', '剧本结构生成'],
  推理: ['推理', '剧本结构生成'],
  图像生成: ['图像生成', '参考图生成'],
  图像编辑: ['图像编辑', '参考图生成'],
  视频生成: ['视频生成'],
  视频编辑: ['视频编辑'],
  语音合成: ['语音合成', '对白配音'],
  语音识别: ['语音识别', '字幕识别'],
  音乐生成: ['音乐生成', '配乐生成'],
  音效生成: ['音效生成'],
  口型同步: ['口型同步', '口型校验'],
  数字人: ['数字人'],
  视觉理解: ['视觉理解', '参考资产校验', '单集质检', '整剧质检'],
  内容审核: ['内容审核', '合规检测'],
  视频处理: ['视频处理', '视频增强'],
  媒体转码: ['媒体转码', '单集合成'],
}

function providerOf(providerId: unknown, providers: Row[]): Row | undefined {
  return providers.find((provider) => String(provider.id) === String(providerId))
}

function modelOf(modelId: unknown, models: Row[]): Row | undefined {
  return models.find((model) => String(model.id) === String(modelId))
}

function providerReadyReason(provider: Row | undefined): string {
  if (!provider) return '供应商不存在'
  if (String(provider.status ?? '') !== '启用') {
    return `供应商 ${provider.name ?? provider.id} 当前状态为「${provider.status ?? '未知'}」，不可用于生产路由`
  }
  if (!String(provider.test ?? '').startsWith('已验证')) {
    return `供应商 ${provider.name ?? provider.id} 尚未通过连通性验证，请先测试`
  }
  return ''
}

function modelReadyReason(model: Row | undefined, cap: string, providers: Row[], forPrimary: boolean): string {
  if (!model) return `${forPrimary ? '主模型' : '备选模型'}档案不存在`
  if (String(model.cap ?? '') !== cap) {
    return `模型 ${model.id} 属于「${model.cap ?? '未知能力'}」，与当前能力「${cap}」不符`
  }
  if (String(model.status ?? '') !== '启用') {
    return `模型 ${model.id} 当前状态为「${model.status ?? '未知'}」，不可用于路由`
  }
  const providerReason = providerReadyReason(providerOf(model.provider, providers))
  if (providerReason) return `模型 ${model.id} ${providerReason}`
  if (forPrimary && String(model.license ?? '').includes('不可作主生产')) {
    return `模型 ${model.id} 的许可注明「不可作主生产」，只能作为备选`
  }
  return ''
}

export function providerTestBlockReason(provider: Row | undefined): string {
  if (!provider) return '供应商不存在'
  if (String(provider.status ?? '') !== '启用') {
    return `供应商 ${provider.name ?? provider.id} 当前状态为「${provider.status ?? '未知'}」，已停用或降级，不能发起测试`
  }
  return ''
}

export function modelProfileCreateBlockReason(body: Row, providers: Row[], models: Row[], capabilities: Row[]): string {
  const providerId = String(body.provider ?? '').trim()
  const model = String(body.model ?? '').trim()
  const cap = String(body.cap ?? '').trim()
  if (!providerId) return '请选择供应商'
  const provider = providerOf(providerId, providers)
  if (!provider) return `供应商 ${providerId} 不存在`
  const providerReason = providerReadyReason(provider)
  if (providerReason) return providerReason
  if (!model) return '请填写模型标识'
  if (!cap) return '请选择能力族'
  if (!capabilities.some((item) => String(item.cap) === cap)) return `能力族「${cap}」不在能力字典中`
  for (const field of ['io', 'limits', 'price', 'license'] as const) {
    if (!String(body[field] ?? '').trim()) return `请填写${field === 'io' ? '输入输出' : field === 'limits' ? '使用限制' : field === 'price' ? '计费单价' : '许可条款'}`
  }
  const duplicate = models.find((item) => String(item.provider) === providerId && String(item.model) === model)
  if (duplicate) return `供应商 ${provider.name ?? providerId} 下已存在模型 ${model}（${duplicate.id}）`
  return ''
}

export function routeEditBlockReason(cap: string, draft: RouteDraft, models: Row[], providers: Row[]): string {
  if (!cap.trim()) return '能力族不能为空'
  if (!String(draft.primaryId ?? '').trim()) return '请选择主模型'
  const primary = modelOf(draft.primaryId, models)
  const primaryReason = modelReadyReason(primary, cap, providers, true)
  if (primaryReason) return primaryReason

  const backupId = String(draft.backupId ?? '').trim()
  if (backupId) {
    if (backupId === draft.primaryId) return '备选模型需与主模型不同'
    const backup = modelOf(backupId, models)
    const backupReason = modelReadyReason(backup, cap, providers, false)
    if (backupReason) return backupReason
  }
  if (!String(draft.fallback ?? '').trim()) return '请选择降级策略'
  if (!String(draft.reason ?? '').trim()) return '请填写路由变更原因'
  return ''
}

export function routeImpactTasks(tasks: Row[], cap: string): Row[] {
  const kinds = CAPABILITY_TASK_KINDS[cap] ?? [cap]
  return tasks.filter((task) => {
    const status = String(task.status ?? '')
    const kind = String(task.kind ?? '')
    return ACTIVE_TASK_STATUSES.includes(status) && (kinds.includes(kind) || kind === cap)
  })
}

export function routeImpactText(tasks: Row[], cap: string): string {
  const impacted = routeImpactTasks(tasks, cap)
  if (!impacted.length) return `当前没有未完成任务占用「${cap}」；本次变更只影响之后新建的任务。`
  const ids = impacted.slice(0, 6).map((task) => `${task.id}（${task.status}）`).join('、')
  const more = impacted.length > 6 ? ` 等 ${impacted.length} 个` : ''
  return `当前有 ${impacted.length} 个未完成任务使用「${cap}」：${ids}${more}。执行中任务按旧路由完成，本次变更只影响之后新建的任务。`
}

export function modelProfileStatusTone(status: unknown): 'ok' | 'warn' | 'bad' {
  const value = String(status ?? '')
  if (value === '启用') return 'ok'
  if (value === '待验证') return 'warn'
  return 'bad'
}
