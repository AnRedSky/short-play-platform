import { http } from '../../api/client'
import type { Row } from '../../mock/db'

/** 资产域：素材、分类、引用关系与入库 */
export const assetApi = {
  list: (limit = 100) => http.list<Row>('/assets', { limit }),
  categories: () => http.list<Row>('/asset-categories'),
  references: (id: string) => http.get<Row[]>(`/assets/${encodeURIComponent(id)}/references`),
  create: (payload: Record<string, unknown>) => http.post<Row>('/assets', payload),
}
