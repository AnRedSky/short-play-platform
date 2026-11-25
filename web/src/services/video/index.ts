import { http } from '../../api/client'
import type { Row } from '../../mock/db'

/** 视频生成域：任务排队、重试、取消、批量推进 */
export const videoApi = {
  tasks: (project: string, limit = 100) => http.list<Row>('/generation-tasks', { project, limit }),
  attempts: (taskId: string) => http.get<Row[]>(`/generation/tasks/${taskId}/attempts`),
  retry: (taskId: string) => http.post(`/generation/tasks/${taskId}/retry`),
  cancel: (taskId: string) => http.post(`/generation/tasks/${taskId}/cancel`),
  updateTask: (id: string, patch: Record<string, unknown>) => http.patch(`/generation-tasks/${id}`, patch),
  createTask: (payload: Record<string, unknown>) => http.post('/generation/tasks', payload),
}
