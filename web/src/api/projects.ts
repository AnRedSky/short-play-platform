import type { Project } from '../types/api'
import { apiGet, apiPatch, apiPost } from './index'

export interface CreateProjectPayload {
  code: string
  title: string
  summary?: string
}

export type UpdateProjectPayload = { title?: string; summary?: string; status?: string }

export const projectsApi = {
  list: (page = 1) => apiGet<Project[]>(`/projects?page=${page}&page_size=100`),
  create: (payload: CreateProjectPayload) =>
    apiPost<Project, CreateProjectPayload>('/projects', payload),
  update: (id: string, payload: UpdateProjectPayload) =>
    apiPatch<Project, UpdateProjectPayload>(`/projects/${id}`, payload),
}
