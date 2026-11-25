import { http } from '../../api/client'

/** 访问控制域：身份与权限 */
export const accessApi = {
  identities: () => http.list<{ id: string; permissions?: string[] }>('/identities'),
}
