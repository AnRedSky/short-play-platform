import { http } from '../../api/client'
import type { Row } from '../../mock/db'

/** 工作台域：首页聚合、助手动作、成本与通知 */
export const workspaceApi = {
  home: () => http.get<Row>('/workspace/home'),
  costSummary: () => http.get<Row>('/costs/summary'),
  notifications: (limit = 50, project?: string) => http.list<Row>('/notifications', project ? { limit, project } : { limit }),
  createTask: (payload: Record<string, unknown>) => http.post('/generation/tasks', payload),
}
