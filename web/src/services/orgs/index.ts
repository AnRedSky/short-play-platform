import { http } from '../../api/client'

/** 企业域：企业信息、部门与成员 */
export const orgApi = {
  enterprise: () => http.get<Record<string, any>>('/orgs/enterprise'),
  departments: () => http.list<Record<string, any>>('/departments'),
  users: () => http.list<Record<string, any>>('/users'),
}
