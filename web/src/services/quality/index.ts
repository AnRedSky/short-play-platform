import { http } from '../../api/client'
import type { Row } from '../../mock/db'

/** 质检域：报告、问题、等级与检测执行 */
export const qualityApi = {
  reports: (limit = 60) => http.list<Row>('/quality-reports', { limit }),
  issues: () => http.list<Row>('/quality-issues'),
  levels: () => http.list<Row>('/quality-levels'),
  run: (payload: Record<string, unknown>) => http.post('/quality/run', payload),
}
