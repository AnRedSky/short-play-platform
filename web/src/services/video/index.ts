import { isMockMode } from '../../api'
import { http } from '../../api/client'
import type { Row } from '../../mock/db'
import { projectRef } from '../projects/registry'
import {
  idempotencyKey,
  resolveTaskId,
  toAttemptRow,
  toCreatePayload,
  toTaskRow,
  type GenerationTaskDto,
  type TaskAttemptDto,
} from './contract'

interface TaskDetailDto extends GenerationTaskDto {
  attempts?: TaskAttemptDto[]
}

/** 视频生成域：页面用中文状态与业务码，服务层负责映射到后端 capability / UUID。 */
export const videoApi = {
  tasks: async (project: string, limit = 100) => {
    if (isMockMode) return http.list<Row>('/generation-tasks', { project, limit })
    const result = await http.list<GenerationTaskDto>(
      `/projects/${projectRef(project)}/generation/tasks`,
      { page: 1, page_size: limit },
    )
    return { ...result, rows: result.rows.map((task) => toTaskRow(task, project)) }
  },
  attempts: async (taskId: string) => {
    if (isMockMode) return http.get<Row[]>(`/generation/tasks/${taskId}/attempts`)
    const detail = await http.get<TaskDetailDto>(`/generation/tasks/${resolveTaskId(taskId)}`)
    return (detail.attempts ?? []).map((attempt) => toAttemptRow(attempt, taskId))
  },
  retry: (taskId: string) =>
    http.post(
      isMockMode
        ? `/generation/tasks/${taskId}/retry`
        : `/generation/tasks/${resolveTaskId(taskId)}/retry`,
    ),
  cancel: (taskId: string) =>
    http.post(
      isMockMode
        ? `/generation/tasks/${taskId}/cancel`
        : `/generation/tasks/${resolveTaskId(taskId)}/cancel`,
    ),
  updateTask: (id: string, patch: Record<string, unknown>) => {
    if (isMockMode) return http.patch(`/generation-tasks/${id}`, patch)
    // 真实后端没有“手工改任务状态”；页面推进队列语义落到调度一次。
    return http.post('/generation/queue/dispatch', { limit: 1 })
  },
  createTask: (payload: Record<string, unknown>) => {
    if (isMockMode) return http.post('/generation/tasks', payload)
    return http.post(
      `/projects/${projectRef(String(payload.project ?? ''))}/generation/tasks`,
      toCreatePayload(payload),
      { 'Idempotency-Key': idempotencyKey() },
    )
  },
}
