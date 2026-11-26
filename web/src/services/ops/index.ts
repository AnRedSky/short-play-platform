import { http } from '../../api/client'
import type { Row } from '../../mock/db'

/** 运营域：总览与平台配置 */
export const opsApi = {
  overview: () => http.get<Row>('/ops/overview'),
  config: () => http.get<Row>('/ops/config'),
}
