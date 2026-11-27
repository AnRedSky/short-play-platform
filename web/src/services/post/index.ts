import { http } from '../../api/client'
import type { Row } from '../../mock/db'

/** 后期域：时间线、单集输出、终审、交付 */
export const postApi = {
  timelines: (project: string, limit = 40) => http.list<Row>('/timelines', { project, limit }),
  tracks: () => http.list<Row>('/tracks'),
  episodes: (project: string, limit = 40) => http.list<Row>('/episodes', { project, limit }),
  outputEpisode: (project: string, no: string) => http.post(`/episodes/${no}/output`, { project }),
  rebuildTimeline: (version: string, project: string) => http.post(`/timelines/${encodeURIComponent(version)}/rebuild`, { project }),
  runQuality: (payload: Record<string, unknown>) => http.post('/quality/run', payload),
  reviews: (project: string) => http.list<Row>('/reviews', { project }),
  createReview: (payload: Record<string, unknown>) => http.post('/reviews', payload),
  deliveries: (project?: string) => http.list<Row>('/deliveries', project ? { project } : {}),
  deliveryChecklist: () => http.list<Row>('/delivery-checklist'),
  createDelivery: (payload: Record<string, unknown>) => http.post('/deliveries', payload),
}
