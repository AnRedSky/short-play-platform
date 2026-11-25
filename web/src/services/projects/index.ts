import { http } from '../../api/client'
import type { Row } from '../../mock/db'

/** 项目域：列表、创建、流水线、状态迁移 */
export const projectApi = {
  list: (params: Record<string, unknown> = { limit: 100 }) => http.list<Row>('/projects', params),
  create: (payload: Record<string, unknown>) => http.post<Row>('/projects', payload),
  update: (id: string, patch: Record<string, unknown>) => http.patch(`/projects/${id}`, patch),
  summary: (id: string) => http.get<Record<string, any>>(`/projects/${id}/summary`),
  workflow: (id: string) => http.get<Record<string, any>>(`/projects/${id}/workflow`),
  timeline: (id: string) => http.get<any[]>(`/projects/${id}/timeline`),
  transition: (id: string, action: string, reason?: string) =>
    http.post(`/projects/${id}/transitions`, reason ? { action, reason } : { action }),
  states: () => http.list<Row>('/project-states'),
  pipeline: () => http.list<Row>('/stage-pipeline'),
  departments: () => http.list<Row>('/departments'),
  users: () => http.list<Row>('/users'),
}
