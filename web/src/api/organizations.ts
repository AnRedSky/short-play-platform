import type { Department, Organization } from '../types/api'
import { apiGet, apiPost } from './index'

export interface CreateDepartmentPayload {
  name: string
  parent_id?: string | null
}

export const organizationsApi = {
  list: () => apiGet<Organization[]>('/organizations'),
  departments: (page = 1) =>
    apiGet<Department[]>(`/organizations/departments?page=${page}&page_size=100`),
  createDepartment: (payload: CreateDepartmentPayload) =>
    apiPost<Department, CreateDepartmentPayload>('/organizations/departments', payload),
}
