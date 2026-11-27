import { isMockMode } from '../../api'
import { http } from '../../api/client'
import type { Row } from '../../mock/db'
import { projectRef } from '../projects/registry'

const LEVEL_OBJECT: Record<string, string> = {
  资产级: '角色、场景、道具与成片资产',
  镜头级: '单镜头首帧、口型与安全区',
  单集级: '单集成片完整性、音画与字幕',
  整剧级: '跨集连续性、总规格与合规终审',
}

/** 质检域：页面走“质检执行”，真实后端挂在项目子资源下。 */
export const qualityApi = {
  reports: (limit = 60) => {
    if (isMockMode) return http.list<Row>('/quality-reports', { limit })
    return http.list<Row>('/quality-reports', { page: 1, page_size: limit })
  },
  issues: () => {
    if (isMockMode) return http.list<Row>('/quality-issues')
    return http.list<Row>('/quality-issues', { page: 1, page_size: 100 })
  },
  levels: () => http.list<Row>('/quality-levels'),
  run: (payload: Record<string, unknown>) => {
    if (isMockMode) return http.post('/quality/run', payload)
    const level = String(payload.level ?? '单集级')
    return http.post(
      `/projects/${projectRef(String(payload.project ?? ''))}/quality/runs`,
      {
        level,
        version: String(payload.version ?? 'v1'),
        object: String(payload.object ?? LEVEL_OBJECT[level] ?? ''),
        checks: [],
        note: payload.note ? String(payload.note) : undefined,
      },
    )
  },
  /** 人工确认报告结论：只有高风险项关闭后才允许通过。 */
  acceptReport: (id: string, payload: Record<string, unknown>) => http.post(
    `/quality-reports/${encodeURIComponent(id)}/accept`,
    { note: payload.note ? String(payload.note) : undefined },
  ),
  /** 返工单由服务端计算轮次与成本，避免前端重复计数。 */
  createRework: (payload: Record<string, unknown>) => {
    if (isMockMode) return http.post('/rework', payload)
    return http.post(
      `/projects/${projectRef(String(payload.project ?? ''))}/quality/reworks`,
      {
        target: String(payload.target ?? ''),
        type: String(payload.type ?? ''),
        report: payload.report ? String(payload.report) : undefined,
        note: payload.note ? String(payload.note) : undefined,
      },
    )
  },
}
