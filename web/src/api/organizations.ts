import type { Department, Organization } from '../types/api'
import { apiGet, apiPost } from './index'

export interface OrganizationMember { id: string; organization_id: string; user_id: string; department_id: string | null; is_active: boolean }

export interface CreateDepartmentPayload {
  name: string
  parent_id?: string | null
}

export const organizationsApi = {
  list: () => apiGet<Organization[]>('/organizations'),
  members: (page = 1) => apiGet<OrganizationMember[]>(`/organizations/members?page=${page}&page_size=100`),
  departments: (page = 1) =>
    apiGet<Department[]>(`/organizations/departments?page=${page}&page_size=100`),
  createDepartment: (payload: CreateDepartmentPayload) =>
    apiPost<Department, CreateDepartmentPayload>('/organizations/departments', payload),
}
