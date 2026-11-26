import { http } from '../../api/client'
import type { Row } from '../../mock/db'

/** 企业域：企业信息、部门与成员 */
export const orgApi = {
  enterprise: () => http.get<Row>('/orgs/enterprise'),
  departments: () => http.list<Row>('/departments'),
  users: () => http.list<Row>('/users'),
}
