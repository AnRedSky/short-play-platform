import { http } from '../../api/client'

/** 工作台域：首页聚合、助手动作、成本与通知 */
export const workspaceApi = {
  home: () => http.get<Record<string, any>>('/workspace/home'),
  costSummary: () => http.get<Record<string, any>>('/costs/summary'),
  notifications: (limit = 50, project?: string) => http.list<any>('/notifications', project ? { limit, project } : { limit }),
  createTask: (payload: Record<string, unknown>) => http.post('/generation/tasks', payload),
}
