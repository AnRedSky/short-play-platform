import type { User } from '../types/api'
import { apiGet, apiPatch, apiPost } from './index'

export interface CreateUserPayload {
  email: string
  full_name: string
  password: string
  department_id?: string | null
  role_ids?: string[]
}

export type UpdateUserPayload = { full_name?: string; is_active?: boolean }

export const usersApi = {
  list: (page = 1) => apiGet<User[]>(`/users?page=${page}&page_size=100`),
  create: (payload: CreateUserPayload) => apiPost<User, CreateUserPayload>('/users', payload),
  update: (id: string, payload: UpdateUserPayload) =>
    apiPatch<User, UpdateUserPayload>(`/users/${id}`, payload),
}
