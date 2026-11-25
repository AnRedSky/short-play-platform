import { http } from '../../api/client'
import type { Row } from '../../mock/db'

/** 导演域：镜头契约与生成任务发起 */
export const directorApi = {
  shots: (project: string, limit = 60) => http.list<Row>('/shots', { project, limit }),
  createTask: (payload: Record<string, unknown>) => http.post('/generation/tasks', payload),
}
