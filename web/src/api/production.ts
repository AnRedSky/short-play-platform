import { apiDownload, apiGet, apiPost, apiRequest } from './index'
import type { ApiEnvelope } from '../types/api'

export interface Story { id: string; project_id: string; title: string; logline: string; synopsis: string; status: string }
export interface StoryBible { id: string; project_id: string; version_number: number; content: Record<string, unknown>; status: string }
export interface Episode { id: string; project_id: string; episode_number: number; title: string; synopsis: string; status: string }
export interface Script { id: string; episode_id: string; title: string; status: string }
export interface ScriptVersion { id: string; script_id: string; version_number: number; content: string; status: string }
export interface ScriptScene { id: string; script_version_id: string; scene_number: number; location: string; time_of_day: string; summary: string }
export interface Dialogue { id: string; script_scene_id: string; order_number: number; character_name: string; content: string }
export interface ProductionAsset { id: string; project_id: string; name: string; description: string }
export interface AssetVersion { id: string; version_number: number; appearance: string; prompt: string; reference_storage_key: string | null; status: string }
export interface Storyboard { id: string; episode_id: string; version_number: number; status: string }
export interface Shot { id: string; storyboard_id: string; scene_id: string | null; shot_number: number; shot_size: string; description: string; status: string }
export interface ShotContract { id: string; shot_id: string; version_number: number; payload: Record<string, unknown>; status: string }
export interface ProviderHealth { code: string; healthy: boolean }
export interface Task { id: string; project_id: string; capability: string; provider_code: string; model_code: string; status: string; error_code: string | null; error_message: string | null; result_payload: Record<string, unknown>; attempts?: Array<{ attempt_number: number; status: string; provider_task_id: string | null; error_code: string | null; duration_ms: number | null }> }
export interface WorkflowRun { id: string; project_id: string; status: string; error_code: string | null; error_message: string | null; finished_at: string | null; nodes?: Array<{ id: string; node_key: string; node_type: string; status: string; attempt_count: number; max_attempts: number; error_code: string | null; error_message: string | null }> }

const enc = encodeURIComponent
const data = <T>(p: Promise<ApiEnvelope<T>>) => p.then(r => r.data)

export const productionApi = {
  stories: (projectId: string) => data(apiGet<Story[]>(`/projects/${enc(projectId)}/stories`)),
  createStory: (projectId: string, body: { title: string; logline: string; synopsis: string }) => data(apiPost<Story, typeof body>(`/projects/${enc(projectId)}/stories`, body)),
  storyBibles: (projectId: string) => data(apiGet<StoryBible[]>(`/projects/${enc(projectId)}/story-bibles`)),
  createStoryBible: (projectId: string, content: Record<string, unknown>) => data(apiPost<StoryBible, { content: Record<string, unknown> }>(`/projects/${enc(projectId)}/story-bibles`, { content })),
  episodes: (projectId: string) => data(apiGet<Episode[]>(`/projects/${enc(projectId)}/episodes?page=1&page_size=100`)),
  createEpisode: (projectId: string, body: { episode_number: number; title: string; synopsis: string }) => data(apiPost<Episode, typeof body>(`/projects/${enc(projectId)}/episodes`, body)),
  episode: (id: string) => data(apiGet<Episode>(`/episodes/${enc(id)}`)),
  createScript: (episodeId: string, title: string) => data(apiPost<Script, { title: string }>(`/episodes/${enc(episodeId)}/scripts`, { title })),
  scriptVersions: (scriptId: string) => data(apiGet<ScriptVersion[]>(`/scripts/${enc(scriptId)}/versions`)),
  createScriptVersion: (scriptId: string, content: string) => data(apiPost<ScriptVersion, { content: string }>(`/scripts/${enc(scriptId)}/versions`, { content })),
  scenes: (versionId: string) => data(apiGet<ScriptScene[]>(`/script-versions/${enc(versionId)}/scenes`)),
  createScene: (versionId: string, body: { scene_number: number; location: string; time_of_day: string; summary: string }) => data(apiPost<ScriptScene, typeof body>(`/script-versions/${enc(versionId)}/scenes`, body)),
  createDialogue: (sceneId: string, body: { order_number: number; character_name: string; content: string }) => data(apiPost<Dialogue, typeof body>(`/script-scenes/${enc(sceneId)}/dialogues`, body)),
  productionAssets: (projectId: string, kind: 'characters' | 'scenes' | 'props') => data(apiGet<ProductionAsset[]>(`/projects/${enc(projectId)}/${kind}`)),
  createProductionAsset: (projectId: string, kind: 'characters' | 'scenes' | 'props', body: { name: string; description: string }) => data(apiPost<ProductionAsset, typeof body>(`/projects/${enc(projectId)}/${kind}`, body)),
  createAssetVersion: (kind: 'characters' | 'scenes' | 'props', id: string, body: { appearance: string; prompt: string }) => data(apiPost<AssetVersion, typeof body>(`/${kind}/${enc(id)}/versions`, body)),
  assetFiles: (projectId: string, kind?: string) => data(apiGet<Array<Record<string, unknown>>>(`/projects/${enc(projectId)}/assets${kind ? `?kind=${enc(kind)}` : ''}`)),
  uploadAsset: (projectId: string, file: File, title: string) => {
    const body = new FormData(); body.append('file', file); body.append('title', title)
    return apiRequest<ApiEnvelope<Record<string, unknown>>>(`/projects/${enc(projectId)}/assets`, { method: 'POST', body })
      .then(r => r.data)
  },
  assetDetail: (id: string) => data(apiGet<Record<string, unknown>>(`/assets/${enc(id)}`)),
  uploadAssetVersion: (id: string, file: File, note: string) => {
    const body = new FormData(); body.append('file', file); body.append('note', note)
    return apiRequest<ApiEnvelope<Record<string, unknown>>>(`/assets/${enc(id)}/versions`, { method: 'POST', body }).then(r => r.data)
  },
  downloadAsset: (id: string) => apiDownload(`/assets/${enc(id)}/download`),
  createStoryboard: (episodeId: string, versionNumber: number) => data(apiPost<Storyboard, { version_number: number }>(`/episodes/${enc(episodeId)}/storyboards`, { version_number: versionNumber })),
  shots: (storyboardId: string) => data(apiGet<Shot[]>(`/storyboards/${enc(storyboardId)}/shots`)),
  createShot: (storyboardId: string, body: { shot_number: number; shot_size: string; description: string }) => data(apiPost<Shot, typeof body>(`/storyboards/${enc(storyboardId)}/shots`, body)),
  shotContracts: (shotId: string) => data(apiGet<ShotContract[]>(`/shots/${enc(shotId)}/contracts`)),
  createShotContract: (shotId: string, payload: Record<string, unknown>) => data(apiPost<ShotContract, { payload: Record<string, unknown> }>(`/shots/${enc(shotId)}/contracts`, { payload })),
  providers: () => data(apiGet<ProviderHealth[]>('/models/providers')),
  createTask: (projectId: string, body: { capability: string; prompt: string; parameters: Record<string, unknown>; model_code: string; provider_code: string; shot_id?: string }) => data(apiPost<Task, typeof body>(`/projects/${enc(projectId)}/generation/tasks`, body, { headers: { 'Idempotency-Key': crypto.randomUUID() } })),
  task: (id: string) => data(apiGet<Task>(`/generation/tasks/${enc(id)}`)),
  cancelTask: (id: string) => data(apiPost<Task, Record<string, never>>(`/generation/tasks/${enc(id)}/cancel`, {})),
  workflows: (projectId: string) => data(apiGet<WorkflowRun[]>(`/projects/${enc(projectId)}/workflow-runs`)),
  createWorkflow: (projectId: string, workflowCode: string, context: Record<string, unknown>) => data(apiPost<WorkflowRun, { workflow_code: string; context: Record<string, unknown> }>(`/projects/${enc(projectId)}/workflow-runs`, { workflow_code: workflowCode, context }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })),
  workflow: (id: string) => data(apiGet<WorkflowRun>(`/workflow-runs/${enc(id)}`)),
  cancelWorkflow: (id: string) => data(apiPost<WorkflowRun, Record<string, never>>(`/workflow-runs/${enc(id)}/cancel`, {})),
  recoverWorkflow: (id: string) => data(apiPost<{ run_id: string; status: string; recovered: number; promoted: number }, Record<string, never>>(`/workflow-runs/${enc(id)}/recover`, {})),
}
