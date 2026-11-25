import { http } from '../../api/client'
import type { Row } from '../../mock/db'

/** 资产域：素材、分类与入库 */
export const assetApi = {
  list: (limit = 100) => http.list<Row>('/assets', { limit }),
  categories: () => http.list<Row>('/asset-categories'),
  create: (payload: Record<string, unknown>) => http.post('/assets', payload),
}
