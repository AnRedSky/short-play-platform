import type { Project } from '../types/api'
import { apiRequest } from './index'
import { apiGet, apiPatch, apiPost } from './index'
import type { ApiRequestOptions } from './index'

export interface CreateProjectPayload {
  code: string
  title: string
  summary?: string
}

export type UpdateProjectPayload = { title?: string; summary?: string; status?: string }
export interface ProjectMember { id: string; project_id: string; user_id: string; project_role: string; is_active: boolean }

export const projectsApi = {
  list: (page = 1) => apiGet<Project[]>(`/projects?page=${page}&page_size=100`),
  create: (payload: CreateProjectPayload) =>
    apiPost<Project, CreateProjectPayload>('/projects', payload),
  read: (id: string, options: Pick<ApiRequestOptions, 'signal'> = {}) =>
    apiGet<Project>(`/projects/${id}`, options),
  update: (id: string, payload: UpdateProjectPayload) =>
    apiPatch<Project, UpdateProjectPayload>(`/projects/${id}`, payload),
  members: (id: string) => apiGet<ProjectMember[]>(`/projects/${id}/members`),
  addMember: (id: string, user_id: string, project_role: string) =>
    apiPost<ProjectMember, { user_id: string; project_role: string }>(`/projects/${id}/members`, { user_id, project_role }),
  removeMember: (id: string, userId: string) =>
    apiRequest<void>(`/projects/${id}/members/${userId}`, { method: 'DELETE' }),
}
