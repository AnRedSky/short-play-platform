import { isMockMode } from '../../api'
import { http } from '../../api/client'
import type { Row } from '../../mock/db'
import {
  toCreateDto,
  toProjectRow,
  toProjectSummary,
  toTransitionResult,
  toUpdateDto,
  type ProjectDto,
} from './contract'

/** 项目域：列表、创建、流水线、状态迁移。字段差异全部在 contract 层收敛。 */
export const projectApi = {
  list: async (params: Record<string, unknown> = { limit: 100 }) => {
    const result = await http.list<ProjectDto>('/projects', params)
    return { ...result, rows: result.rows.map(toProjectRow) }
  },
  create: async (payload: Record<string, unknown>) => {
    const body = isMockMode ? payload : toCreateDto(payload)
    return toProjectRow(await http.post<ProjectDto>('/projects', body))
  },
  update: async (id: string, patch: Record<string, unknown>) => {
    const body = isMockMode ? patch : toUpdateDto(patch)
    return toProjectRow(await http.patch<ProjectDto>(`/projects/${id}`, body))
  },
  summary: async (id: string) => toProjectSummary(await http.get<Record<string, unknown>>(`/projects/${id}/summary`)),
  workflow: (id: string) => http.get<Row>(`/projects/${id}/workflow`),
  timeline: (id: string) => http.get<Row[]>(`/projects/${id}/timeline`),
  transition: async (id: string, action: string, reason?: string, expectedState?: string) => {
    const body: Record<string, unknown> = { action }
    if (reason) body.reason = reason
    if (expectedState) body.expected_state = expectedState
    return toTransitionResult(
      await http.post<Record<string, unknown>>(`/projects/${id}/transitions`, body),
    )
  },
  states: () => http.list<Row>('/project-states'),
  pipeline: () => http.list<Row>('/stage-pipeline'),
  departments: () => http.list<Row>('/departments'),
  users: () => http.list<Row>('/users'),
}
