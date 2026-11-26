import { http } from '../../api/client'
import type { Row } from '../../mock/db'

/** 创意与剧本域：创意简报、剧本、审核 */
export const creationApi = {
  briefs: (project: string) => http.list<Row>('/briefs', { project }),
  briefModes: () => http.list<Row>('/brief-modes'),
  creativePlans: (project: string) => http.list<Row>('/creative-plans', { project }),
  updateBrief: (id: string, payload: Record<string, unknown>) => http.patch(`/briefs/${id}`, payload),
  scripts: (project: string) => http.list<Row>('/scripts', { project }),
  scriptDiffs: () => http.list<Row>('/script-diffs'),
  createScript: (payload: Record<string, unknown>) => http.post<Row>('/scripts', payload),
  reviews: (project: string) => http.list<Row>('/reviews', { project }),
  reviewChecklist: () => http.list<Row>('/review-checklist'),
  reviewScript: (scriptId: string, payload: Record<string, unknown>) => http.post(`/scripts/${scriptId}/review`, payload),
}
