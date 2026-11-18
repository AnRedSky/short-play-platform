import type { Role } from '../types/api'
import { apiGet, apiPost } from './index'

export interface CreateRolePayload {
  code: string
  name: string
  description?: string
  permissions: string[]
}

export const rolesApi = {
  list: (page = 1) => apiGet<Role[]>(`/roles?page=${page}&page_size=100`),
  create: (payload: CreateRolePayload) => apiPost<Role, CreateRolePayload>('/roles', payload),
  assign: (id: string, role_id: string) =>
    apiPost<{ role_id: string; user_id: string }, { role_id: string }>(`/roles/${id}/assignments`, {
      role_id,
    }),
}
