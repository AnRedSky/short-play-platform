import type { Row } from '../../mock/db'

/**
 * B-01 契约的序列化边界。
 *
 * 页面只认 mock 的字段（`id` = 业务编号、`name` = 标题、`record_id` 隐藏 UUID）。
 * 真实后端仍返回 `code` / `title`，因此所有差异都收敛在这里：
 * 页面、组件与 store 不感知后端字段名，替换 `services/projects` 内部实现即可。
 */
export interface ProjectDto {
  id?: string
  code?: string
  name?: string
  title?: string
  record_id?: string
  organization_id?: string
  summary?: string
  status?: string
  genre?: string
  audience?: string
  episodes?: number
  duration?: string
  ratio?: string
  language?: string
  style?: string
  constraints?: string
  budget?: number
  actual?: number
  estimated?: number
  phase?: string
  done?: number
  delivered?: number
  quality?: string
  ownerId?: string
  owner?: string
  deptId?: string
  dept?: string
  budgetState?: string
  created?: string
  updated?: string
  [key: string]: unknown
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LEGACY_STATUS: Record<string, string> = {
  draft: '草稿',
  in_review: '待剧本审核',
  approved: '已完成',
  rejected: '剧本创作中',
  archived: '已归档',
}

export function projectStatus(status: unknown): string {
  const value = String(status || '草稿')
  return LEGACY_STATUS[value] ?? value
}

/** 真实后端 -> 页面行。mock 行是幂等的：有 `name` 时不会再被改写。 */
export function toProjectRow(dto: ProjectDto): Row {
  const rawId = String(dto.id ?? '')
  const code = String(dto.code ?? '')
  const id = code || rawId
  const recordId = dto.record_id ?? (UUID_PATTERN.test(rawId) ? rawId : undefined)
  return {
    ...dto,
    id,
    name: String(dto.name ?? dto.title ?? ''),
    record_id: recordId,
    status: projectStatus(dto.status),
    genre: dto.genre ?? '',
    audience: dto.audience ?? '',
    episodes: Number(dto.episodes ?? 0),
    duration: dto.duration ?? '',
    ratio: dto.ratio ?? '',
    language: dto.language ?? '',
    style: dto.style ?? '',
    constraints: dto.constraints ?? dto.summary ?? '',
    budget: Number(dto.budget ?? 0),
    actual: Number(dto.actual ?? 0),
    estimated: Number(dto.estimated ?? 0),
    phase: dto.phase ?? '',
    done: Number(dto.done ?? 0),
    delivered: Number(dto.delivered ?? 0),
    quality: dto.quality ?? '',
    ownerId: dto.ownerId ?? '',
    owner: dto.owner ?? '',
    deptId: dto.deptId ?? '',
    dept: dto.dept ?? '',
    budgetState: dto.budgetState ?? '',
    created: dto.created ?? '',
    updated: dto.updated ?? '',
  }
}

/** 页面行 -> 真实后端创建载荷；mock 模式不调用，直接发送原始表单。 */
export function toCreateDto(payload: Record<string, unknown>): Record<string, unknown> {
  const code =
    String(payload.code ?? payload.id ?? '') ||
    `SP-${Date.now().toString(36).toUpperCase()}`
  return {
    code,
    title: String(payload.name ?? payload.title ?? ''),
    summary: String(payload.constraints ?? payload.summary ?? ''),
  }
}

/** 页面 patch -> 真实后端可接受的字段；不支持的业务字段不静默写入别的列。 */
export function toUpdateDto(patch: Record<string, unknown>): Record<string, unknown> {
  const dto: Record<string, unknown> = {}
  if (patch.name !== undefined) dto.title = patch.name
  if (patch.title !== undefined) dto.title = patch.title
  if (patch.summary !== undefined) dto.summary = patch.summary
  return dto
}

/** 详情聚合：项目实体统一走行映射，其余集合保持后端形状。 */
export function toProjectSummary(dto: Record<string, unknown>): Row {
  if (dto.project && typeof dto.project === 'object') {
    return { ...dto, project: toProjectRow(dto.project as ProjectDto) }
  }
  return toProjectRow(dto as ProjectDto)
}

/** 状态迁移结果：`data.project` 归一，`allowed_actions` 原样透传。 */
export function toTransitionResult(dto: Record<string, unknown>): Row {
  if (dto.project && typeof dto.project === 'object') {
    return { ...dto, project: toProjectRow(dto.project as ProjectDto) }
  }
  return dto as Row
}
