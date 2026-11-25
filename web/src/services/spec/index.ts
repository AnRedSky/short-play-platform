import { http } from '../../api/client'
import type { Row } from '../../mock/db'

/** 规格页通用取数：endpoint 由 views/specs.ts 声明，仍经 service 层统一出口。 */
export const specApi = {
  list: (endpoint: string, params: Record<string, unknown> = {}) => http.list<Row>(endpoint, params),
}
