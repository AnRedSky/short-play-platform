import { http } from '../../api/client'
import type { Row } from '../../mock/db'

export const analyticsApi = {
  get: (scope: 'enterprise' | 'me') => http.get<Row>(`/analytics/${scope}`),
}
