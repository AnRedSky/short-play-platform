import type { Row } from '../mock/db'

/** 资产进入生产与交付前的统一授权口径。 */
const INCOMPLETE_RIGHTS = ['授权不明确', '待补', '待授权', '未授权', '待替换']

function localToday(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 资产详情与生产入口共用的放行判断。授权优先于质检：
 * 即使画面已通过，授权不明确或已到期也不能进入正式生产。
 */
export function assetRightsBlockReason(asset: Row | null | undefined, today = localToday()): string {
  if (!asset) return '未找到资产，无法判断授权状态'
  const rights = String(asset.rights ?? '').trim()
  if (!rights) return '资产未登记授权标记，不能进入生产或交付'
  if (rights.includes('待替换')) return '素材标记为“待替换”，替换或重新生成后才能进入生产'
  if (rights.includes('授权不明确')) return '授权不明确，需补授权范围、依据与到期日后放行'
  if (INCOMPLETE_RIGHTS.some((token) => rights.includes(token))) {
    return '授权待补，补录授权依据与到期日后才能进入生产'
  }

  const expiry = String(asset.rightsExpiry ?? '').trim()
  if (expiry && expiry < today) {
    return `授权已于 ${expiry} 到期，请续期并更新授权标记后再使用`
  }
  if (String(asset.qc ?? '').includes('FAIL')) {
    return `资产质检未通过（${asset.qc}），完成整改并重新质检后才能进入正式生产`
  }
  if (String(asset.status ?? '').includes('阻断')) {
    return `资产状态为“${asset.status}”，完成整改后才能进入生产`
  }
  return ''
}

/** 登记表单的字段与授权到期日校验；服务端 createAsset 使用同一口径兜底。 */
export function assetRegisterBlockReason(
  values: Record<string, unknown>,
  today = localToday(),
): string {
  if (!String(values.name ?? '').trim()) return '请填写资产名'
  if (!String(values.cat ?? '').trim()) return '请选择资产分类'
  if (!String(values.type ?? '').trim()) return '请填写资产类型'
  if (!String(values.rights ?? '').trim()) return '请填写授权标记，说明素材来源与可用范围'

  const expiry = String(values.rightsExpiry ?? '').trim()
  if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return '授权到期日格式应为 YYYY-MM-DD'
  if (expiry && expiry < today) return `授权到期日 ${expiry} 早于今天，请填写有效授权期限`
  return ''
}
