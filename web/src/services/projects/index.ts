import { isMockMode } from '../../api'
import { http } from '../../api/client'
import type { Row } from '../../mock/db'
import {
  toBatchPackage,
  toBatchTrial,
  toCreateDto,
  toEpisodeActionResult,
  toProjectRow,
  toProjectSummary,
  toTransitionResult,
  toUpdateDto,
  type ProjectDto,
} from './contract'
import { projectRef, rememberProject, rememberProjects } from './registry'

/** 项目域：列表、创建、流水线、状态迁移。字段差异全部在 contract 层收敛。 */
export const projectApi = {
  list: async (params: Record<string, unknown> = { limit: 100 }) => {
    const result = await http.list<ProjectDto>('/projects', params)
    rememberProjects(result.rows)
    return { ...result, rows: result.rows.map(toProjectRow) }
  },
  create: async (payload: Record<string, unknown>) => {
    const body = isMockMode ? payload : toCreateDto(payload)
    const dto = await http.post<ProjectDto>('/projects', body)
    rememberProject(dto)
    return toProjectRow(dto)
  },
  update: async (id: string, patch: Record<string, unknown>) => {
    const body = isMockMode ? patch : toUpdateDto(patch)
    const dto = await http.patch<ProjectDto>(`/projects/${projectRef(id)}`, body)
    rememberProject(dto)
    return toProjectRow(dto)
  },
  summary: async (id: string) =>
    toProjectSummary(await http.get<Record<string, unknown>>(`/projects/${projectRef(id)}/summary`)),
  workflow: (id: string) => http.get<Row>(`/projects/${projectRef(id)}/workflow`),
  timeline: (id: string) => http.get<Row[]>(`/projects/${projectRef(id)}/timeline`),
  episodeAction: async (id: string, ep: number, payload: Record<string, unknown>) =>
    toEpisodeActionResult(
      await http.post<Record<string, unknown>>(`/projects/${projectRef(id)}/episodes/${ep}/actions`, payload),
    ),
  batchTrial: async (id: string, batch: number, payload: Record<string, unknown> = {}) =>
    toBatchTrial(
      await http.post<Record<string, unknown>>(`/projects/${projectRef(id)}/batches/${batch}/trial`, payload),
    ),
  batchPackage: async (id: string, batch: number, payload: Record<string, unknown> = {}) =>
    toBatchPackage(
      await http.post<Record<string, unknown>>(`/projects/${projectRef(id)}/batches/${batch}/package`, payload),
    ),
  transition: async (id: string, action: string, reason?: string, expectedState?: string) => {
    const body: Record<string, unknown> = { action }
    if (reason) body.reason = reason
    if (expectedState) body.expected_state = expectedState
    return toTransitionResult(
      await http.post<Record<string, unknown>>(
        `/projects/${projectRef(id)}/transitions`,
        body,
      ),
    )
  },
  states: () => http.list<Row>('/project-states'),
  pipeline: () => http.list<Row>('/stage-pipeline'),
  departments: () => http.list<Row>('/departments'),
  users: () => http.list<Row>('/users'),
}
