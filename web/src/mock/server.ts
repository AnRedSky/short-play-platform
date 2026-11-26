/**
 * Mock API 服务：与真实后端同构的 REST 契约（/api/v1）。
 * 前端只调 api 层；VITE_DATA_MODE=mock 时请求进入这里，切到 real 时同一份代码改用后端。
 */
import { nextId, now, store, type Row } from './db'
import { GATE_ACTIONS, allowedActions, permissionsOf, progressOf, stageChain } from './state'

export interface Envelope<T = unknown> {
  data: T
  meta?: Record<string, unknown>
}

export class MockHttpError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type Handler = (ctx: {
  id: string
  body: Row
  query: URLSearchParams
  method: string
  parts: string[]
}) => Envelope | unknown

const LATENCY = 60

function ok<T>(data: T, meta?: Record<string, unknown>): Envelope<T> {
  return meta ? { data, meta } : { data }
}

function rows(table: string): Row[] {
  return store.table(table)
}

function byId(table: string, id: string, field = 'id'): Row {
  const row = rows(table).find((item) => String(item[field]) === id)
  if (!row) throw new MockHttpError(404, 'not_found', `未找到 ${table} / ${id}`)
  return row
}

function currentIdentity(): Row {
  const identity = rows('identities').find((item) => item.id === store.identityId)
  return identity ?? rows('identities')[0]
}

function currentPermissions(): string[] {
  return permissionsOf(store.identityId)
}

function projectOf(id: string): Row {
  return byId('projects', id, 'id')
}

/* ------------------------------------------------------------------ *
 * 通用集合路由
 * ------------------------------------------------------------------ */

interface Collection {
  path: string
  table: string
  field?: string
  prefix?: string
  search?: string[]
  defaults?: Row
  /** 列表默认条数，宽表必须限流，避免把 650 条镜头一次塞给前端 */
  limit?: number
}

const COLLECTIONS: Collection[] = [
  { path: '/projects', table: 'projects', prefix: 'SP', search: ['name', 'id', 'genre', 'owner'] },
  { path: '/project-states', table: 'projectStates', field: 'name' },
  { path: '/stage-pipeline', table: 'stagePipeline', field: 'key' },
  { path: '/briefs', table: 'briefs', prefix: 'BR' },
  { path: '/brief-modes', table: 'briefModes', field: 'key' },
  { path: '/creative-plans', table: 'creativePlans', prefix: 'CP' },
  { path: '/scripts', table: 'scripts', prefix: 'SCR' },
  { path: '/script-diffs', table: 'scriptDiff', field: 'id' },
  { path: '/episodes', table: 'episodes', field: 'no', limit: 40 },
  { path: '/scenes', table: 'scenes', prefix: 'SC' },
  { path: '/characters', table: 'characters', prefix: 'CH' },
  { path: '/locations', table: 'locations', prefix: 'LC' },
  { path: '/props', table: 'props', prefix: 'PR' },
  { path: '/storyboard-plans', table: 'plans', prefix: 'PP' },
  { path: '/shots', table: 'shots', limit: 60 },
  { path: '/dialogues', table: 'dialogues', prefix: 'DL' },
  { path: '/voice-profiles', table: 'voiceProfiles', prefix: 'VO' },
  { path: '/audio-assets', table: 'audioAssets', prefix: 'AU' },
  { path: '/subtitles', table: 'subtitles', limit: 40 },
  { path: '/lip-sync', table: 'lipSync', prefix: 'LS' },
  { path: '/generation-tasks', table: 'tasks', prefix: 'T', limit: 80 },
  { path: '/task-attempts', table: 'attempts', prefix: 'AT' },
  { path: '/invocations', table: 'invocations', prefix: 'IV' },
  { path: '/quality-levels', table: 'qualityLevels', field: 'level' },
  { path: '/quality-matrix', table: 'qualityMatrix', field: 'item' },
  { path: '/quality-reports', table: 'qualityReports', prefix: 'QR' },
  { path: '/quality-issues', table: 'qualityIssues', prefix: 'QI' },
  { path: '/rework', table: 'reworkLedger', prefix: 'RW' },
  { path: '/reviews', table: 'reviews', prefix: 'RV' },
  { path: '/review-checklist', table: 'reviewChecklist', field: 'item' },
  { path: '/timelines', table: 'timelines', field: 'version' },
  { path: '/tracks', table: 'tracks', field: 'name' },
  { path: '/deliveries', table: 'deliveries', prefix: 'DP' },
  { path: '/delivery-checklist', table: 'deliveryChecklist', field: 'item' },
  { path: '/works', table: 'works', prefix: 'WK' },
  { path: '/asset-categories', table: 'assetCategories', field: 'name' },
  { path: '/assets', table: 'assets', prefix: 'A', search: ['name', 'id', 'cat', 'type'] },
  { path: '/usage', table: 'usage', prefix: 'US' },
  { path: '/budgets', table: 'budgets', field: 'scope' },
  { path: '/budget-rules', table: 'budgetRules', field: 'item' },
  { path: '/costs', table: 'costs', prefix: 'CR', search: ['project', 'task', 'cap'] },
  { path: '/cost-dimensions', table: 'costDimensions', field: 'name' },
  { path: '/providers', table: 'providers', prefix: 'PRV', search: ['name', 'kind'] },
  { path: '/model-profiles', table: 'modelProfiles', prefix: 'MP' },
  { path: '/call-logs', table: 'callLogs', prefix: 'CL' },
  { path: '/capabilities', table: 'capabilities', field: 'cap' },
  { path: '/video-capabilities', table: 'videoCapabilities', field: 'item' },
  { path: '/post-capabilities', table: 'postCapabilities', field: 'item' },
  { path: '/rights', table: 'rights', prefix: 'RT' },
  { path: '/risks', table: 'risks', prefix: 'RK' },
  { path: '/audit-logs', table: 'audits', field: 'time', search: ['object', 'action', 'actor'] },
  { path: '/notifications', table: 'notifications', prefix: 'N', search: ['title', 'project', 'type'] },
  { path: '/incidents', table: 'incidents', prefix: 'IN' },
  { path: '/departments', table: 'departments', field: 'id' },
  { path: '/users', table: 'users', field: 'id' },
  { path: '/members', table: 'users', field: 'id' },
  { path: '/roles', table: 'roles', field: 'code' },
  { path: '/identities', table: 'identities', field: 'id' },
]

const collectionByPath = new Map(COLLECTIONS.map((item) => [item.path, item]))

function listRows(collection: Collection, query: URLSearchParams): Envelope {
  let list = rows(collection.table)
  const reserved = new Set(['q', 'limit', 'page', 'page_size', 'project_id', 'projectId', 'all'])

  query.forEach((value, key) => {
    if (reserved.has(key) || !value) return
    const normalized = key.replace(/_([a-z])/g, (_, c) => String(c).toUpperCase())
    if (!(normalized in (list[0] ?? {})) && !rows(collection.table).some((row) => normalized in row)) return
    list = list.filter((row) => String(row[normalized] ?? '') === value)
  })

  const project = query.get('project') ?? query.get('project_id') ?? query.get('projectId')
  if (project) list = list.filter((row) => String(row.project ?? '') === project)

  const q = (query.get('q') ?? '').trim().toLowerCase()
  if (q) {
    const fields = collection.search ?? ['id', 'name', 'title']
    list = list.filter((row) => fields.some((field) => String(row[field] ?? '').toLowerCase().includes(q)))
  }

  const limit = Number(query.get('limit') ?? query.get('page_size') ?? collection.limit ?? 200)
  const page = Math.max(1, Number(query.get('page') ?? 1))
  const total = list.length
  const sliced = list.slice((page - 1) * limit, page * limit)
  return ok(sliceRows(collection.table, sliced), { page, page_size: limit, total })
}

/** tracks/subtitles/timelines 这些行没有 id，真实 API 也会返回稳定 id，这里补一个只读 id。 */
function sliceRows(table: string, list: Row[]): Row[] {
  return list.map((row) => {
    if (row.id) return row
    const composite = [table, row.project, row.ep ?? row.no ?? row.version ?? row.name ?? row.scope].filter(Boolean).join(':')
    return { ...row, id: composite }
  })
}

function createRow(collection: Collection, body: Row): Envelope {
  const defaults = collection.defaults ?? {}
  const row: Row = {
    ...defaults,
    ...body,
    id: body.id ?? nextId(collection.prefix ?? 'X', collection.table),
    createdAt: now(),
  }
  rows(collection.table).unshift(row)
  store.persist()
  return ok(row)
}

function patchRow(collection: Collection, id: string, body: Row): Envelope {
  const field = collection.field ?? 'id'
  const row = byId(collection.table, id, field)
  Object.assign(row, body, { updatedAt: now() })
  store.persist()
  return ok(row)
}

function deleteRow(collection: Collection, id: string): Envelope {
  const field = collection.field ?? 'id'
  const list = rows(collection.table)
  const index = list.findIndex((row) => String(row[field]) === id)
  if (index >= 0) list.splice(index, 1)
  store.persist()
  return ok({ id, deleted: index >= 0 })
}

/* ------------------------------------------------------------------ *
 * 领域动作
 * ------------------------------------------------------------------ */

function workflow(id: string): Envelope {
  const project = projectOf(id)
  const permissions = currentPermissions()
  return ok({
    project,
    stages: stageChain(project),
    allowed_actions: allowedActions(project, permissions),
    progress: progressOf(project),
    kpis: [
      { label: '集数', value: `${project.done ?? 0} / ${project.episodes ?? 0}` },
      { label: '预算占用', value: `¥${Number(project.actual ?? 0).toLocaleString('zh-CN')}` },
      { label: '预算总额', value: `¥${Number(project.budget ?? 0).toLocaleString('zh-CN')}` },
      { label: '质量', value: project.quality ?? '—' },
    ],
  })
}

function transition(id: string, body: Row): Envelope {
  const project = projectOf(id)
  const actionKey = String(body.action ?? '')
  const action = (GATE_ACTIONS[project.status] ?? []).find((item) => item.key === actionKey)
  if (!action) throw new MockHttpError(409, 'illegal_transition', `状态「${project.status}」不允许动作 ${actionKey}`)
  if (!currentPermissions().includes(action.permission)) {
    throw new MockHttpError(403, 'forbidden', `当前身份缺少权限 ${action.permission}`)
  }
  if (action.needReason && !String(body.reason ?? '').trim()) {
    throw new MockHttpError(422, 'reason_required', '该动作必须填写原因')
  }

  const from = project.status
  const next = action.next === '__prev__' ? String(project._prevStatus ?? '生产中') : action.next
  project._prevStatus = from
  project.status = next
  project.phase = stageChain(project).find((stage) => stage.state === 'now')?.name ?? project.phase
  project.updated = now()

  if (next === '已交付') {
    const placeholder = rows('deliveries').findIndex(
      (row) => row.project === project.id && String(row.status).startsWith('未生成'),
    )
    if (placeholder >= 0) rows('deliveries').splice(placeholder, 1)
    rows('deliveries').unshift(buildDelivery(project, { version: 'V1' }))
    project.delivered = project.episodes
  }

  rows('audits').unshift({
    id: nextId('AUD', 'audits'),
    time: now(),
    actor: String(currentIdentity().name ?? '').split(' · ')[0],
    object: `项目 ${project.id}`,
    action: `${action.label}（${from} → ${next}）`,
    result: '成功',
    src: '本地 mock · 桌面端',
    link: project.id,
    reason: body.reason ?? '',
  })
  rows('notifications').unshift({
    id: nextId('N', 'notifications'),
    type: next,
    project: project.id,
    title: `《${project.name}》${action.label}`,
    reason: body.reason ? String(body.reason) : `${from} → ${next}`,
    impact: '下游节点按新状态继续',
    state: '待处理',
    action: '查看流水线',
    owner: project.owner,
    link: 'projects/workflow',
    unread: true,
    at: now(),
  })
  store.persist()
  return ok({ project, allowed_actions: allowedActions(project, currentPermissions()), message: `${from} → ${next}` })
}

function projectTimeline(id: string): Envelope {
  const project = projectOf(id)
  const audits = rows('audits').filter((row) => row.object === `项目 ${project.id}` || row.link === project.id)
  const reviews = rows('reviews').filter((row) => row.project === id)
  const items = [
    ...audits.map((row) => ({ at: row.time, title: row.action, by: row.actor, kind: '动作', note: row.result })),
    ...reviews.map((row) => ({ at: row.at, title: `${row.node} · ${row.result}`, by: row.auditor, kind: '审核', note: row.note })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)))
  return ok(items)
}

function scriptReview(id: string, body: Row): Envelope {
  const script = byId('scripts', id)
  const result = String(body.result ?? '通过')
  const project = rows('projects').find((row) => row.id === script.project)
  script.status = result === '通过' ? '已通过 · 正式版本' : '已退回'
  script.locked = result === '通过'
  script.updatedAt = now()
  rows('reviews').unshift({
    id: nextId('RV', 'reviews'),
    project: script.project,
    node: '剧本审核（节点 A）',
    object: script.id,
    version: script.version,
    auditor: String(currentIdentity().name ?? '').split(' · ')[0],
    role: currentIdentity().discriminator === 'admin' ? '企业管理员' : '项目负责人',
    at: now(),
    result,
    note: body.note ?? '',
    positions: '全篇',
    tasks: '下游按审核结论执行',
    follow: result === '通过' ? '进入导演规划' : '回退剧本修订',
  })
  if (project) {
    if (result === '通过' && project.status === '待剧本审核') {
      project._prevStatus = project.status
      project.status = '生产准备中'
      project.phase = '导演规划'
    } else if (result !== '通过' && project.status === '待剧本审核') {
      project._prevStatus = project.status
      project.status = '剧本创作中'
      project.phase = '剧本创作'
    }
  }
  store.persist()
  return ok({ script, project })
}

function createTask(body: Row): Envelope {
  const project = projectOf(String(body.project))
  const row: Row = {
    id: nextId('T', 'tasks'),
    project: project.id,
    ep: body.ep ?? 1,
    scene: body.scene ?? '01',
    shot: body.shot ?? 'SH-01',
    kind: body.kind ?? '视频生成',
    stage: project.phase,
    status: '排队中',
    priority: body.priority ?? '中',
    deps: body.deps ?? [],
    parallelGroup: body.parallelGroup ?? `${project.id}-G1`,
    input: body.input ?? '—',
    output: body.output ?? 'MP4 1080×1920',
    model: body.model ?? '视频模型 A',
    config: body.config ?? 'PRV-01',
    executor: body.executor ?? '林知远',
    resourceOwner: body.resourceOwner ?? '林知远',
    attempt: 1,
    maxAttempts: body.maxAttempts ?? 3,
    est: body.est ?? 30,
    actual: 0,
    failedCost: 0,
    submitAt: now().slice(11),
    failReason: '—',
    qc: '待检',
  }
  rows('tasks').unshift(row)
  rows('audits').unshift({
    id: nextId('AUD', 'audits'),
    time: now(),
    actor: '林知远',
    object: `项目 ${project.id} · ${row.shot}`,
    action: `提交任务 ${row.id}（${row.kind}）`,
    result: '成功',
    src: '本地 mock · 桌面端',
    link: row.id,
  })
  store.persist()
  return ok(row)
}

function taskAction(id: string, kind: 'retry' | 'cancel' | 'pause'): Envelope {
  const task = byId('tasks', id)
  if (kind === 'retry') {
    task.attempt = Number(task.attempt ?? 1) + 1
    task.status = '排队中'
    task.failReason = '—'
    rows('attempts').unshift({
      id: nextId('AT', 'attempts'),
      task: task.id,
      n: task.attempt,
      at: now(),
      status: '排队中',
      fail: '—',
      cost: 0,
      by: '林知远',
    })
  }
  if (kind === 'cancel') task.status = '已取消'
  if (kind === 'pause') task.status = '已暂停'
  task.updatedAt = now()
  store.persist()
  return ok(task)
}

function runQuality(body: Row): Envelope {
  const project = projectOf(String(body.project ?? ''))
  const report: Row = {
    id: nextId('QR', 'qualityReports'),
    object: `${project.id} / 第 ${body.ep ?? 1} 集成片`,
    level: body.level ?? '单集级',
    version: body.version ?? `EP${body.ep ?? 1} v1`,
    result: body.result ?? 'PASS',
    items: 42,
    issues: Number(body.issues ?? 0),
    review: 1,
    fail: 0,
    engine: '质检模型 Q1（独立检测能力）',
    at: now(),
    note: '本地 mock 质检执行完成；阻断项 0。',
    project: project.id,
  }
  rows('qualityReports').unshift(report)
  store.persist()
  return ok(report)
}

function finalReview(body: Row): Envelope {
  const project = projectOf(String(body.project ?? ''))
  const result = String(body.result ?? '通过')
  rows('reviews').unshift({
    id: nextId('RV', 'reviews'),
    project: project.id,
    node: '最终成片审核（节点 B）',
    object: `DP-${project.id}-V1`,
    version: 'V1',
    auditor: String(currentIdentity().name ?? '').split(' · ')[0],
    role: '终审人',
    at: now(),
    result,
    note: body.note ?? '',
    positions: '全篇',
    tasks: result === '通过' ? '进入交付' : '退回后期',
    follow: result === '通过' ? '生成交付包' : '返工',
  })
  if (project.status === '待最终审核') {
    project._prevStatus = project.status
    project.status = result === '通过' ? '已完成' : '后期制作中'
    project.updated = now()
  }
  store.persist()
  return ok({ project })
}

function buildDelivery(project: Row, body: Row): Row {
  const seq = rows('deliveries').filter((row) => row.project === project.id && row.status === '已交付').length + 1
  return {
    id: `DP-${String(project.id).replace(/^SP-/, '')}-${String(seq).padStart(2, '0')}`,
    project: project.id,
    version: body.version ?? 'V1',
    episodes: body.episodes ?? project.episodes,
    files: body.files ?? project.episodes,
    size: body.size ?? `${(Number(project.episodes ?? 1) * 0.42).toFixed(1)} GB`,
    checksum: body.checksum ?? `sha256:${project.id.toLowerCase()}…mock`,
    reviewer: String(currentIdentity().name ?? '').split(' · ')[0],
    at: now(),
    status: '已交付',
    receiver: body.receiver ?? '企业内容库',
    frozen: true,
  }
}

function delivery(body: Row): Envelope {
  const project = projectOf(String(body.project ?? ''))
  const row = buildDelivery(project, body)
  rows('deliveries').unshift(row)
  if (project.status === '已完成') {
    project._prevStatus = project.status
    project.status = '已交付'
    project.delivered = project.episodes
    project.updated = now()
  }
  store.persist()
  return ok(row)
}

/* ------------------------------------------------------------------ *
 * 聚合视图
 * ------------------------------------------------------------------ */

function workspaceHome(): Envelope {
  const projects = rows('projects')
  const tasks = rows('tasks')
  const notifications = rows('notifications')
  const active = projects.filter((row) => !['已交付', '已归档', '已终止', '草稿'].includes(row.status))
  const running = tasks.filter((row) => ['执行中', '排队中'].includes(row.status))
  return ok({
    identity: currentIdentity(),
    permissions: currentPermissions(),
    metrics: [
      { label: '在制项目', value: active.length, hint: `共 ${projects.length} 个` },
      { label: '运行任务', value: running.length, hint: `失败 ${tasks.filter((row) => row.status === '失败').length}` },
      { label: '待处理', value: notifications.filter((row) => row.unread).length, hint: '待办与通知' },
      { label: '预算占用', value: `¥${projects.reduce((sum, row) => sum + Number(row.actual ?? 0), 0).toLocaleString('zh-CN')}`, hint: '全部项目' },
    ],
    pipeline: stageChain(active[0] ?? projects[0] ?? {}),
    projects: active.slice(0, 6),
    tasks: running.slice(0, 8),
    notifications: notifications.slice(0, 6),
    audits: rows('audits').slice(0, 6),
  })
}

function currentStageName(project: Row): string {
  const chain = stageChain(project)
  return chain.find((stage) => stage.state === 'now')?.name ?? chain[0]?.name ?? '待启动'
}

function analytics(scope: 'enterprise' | 'me'): Envelope {
  const projects = scope === 'me'
    ? rows('projects').filter((project) => String(project.owner ?? '').includes('林知远') || project.owner === currentIdentity().name)
    : rows('projects')
  const costs = rows('costs')
  const tasks = scope === 'me'
    ? rows('tasks').filter((task) => String(task.owner ?? '').includes('林知远'))
    : rows('tasks')
  const totalCost = costs.reduce((sum, row) => sum + Number(row.actual ?? 0), 0)
  const byProject = projects.map((project) => ({
    project: project.id,
    name: project.name,
    status: project.status,
    episodes: project.episodes,
    done: project.done,
    stage: currentStageName(project),
    budget: project.budget,
    actual: project.actual,
    quality: project.quality,
    cost: costs.filter((row) => row.project === project.id).reduce((sum, row) => sum + Number(row.actual ?? 0), 0),
  }))
  const stageNames = stageChain(projects[0] ?? {}).map((stage) => stage.name)
  const byStage = stageNames.map((name) => {
    const count = projects.filter((project) => currentStageName(project) === name).length
    const ratio = `${Math.round((count / Math.max(1, projects.length)) * 100)}%`
    return { stage: name, count, ratio }
  })
  const taskMix = tasks.reduce((acc: Row[], task) => {
    const hit = acc.find((row) => row.kind === task.kind)
    if (hit) {
      hit.count += 1
      if (task.status === '失败') hit.failed += 1
    } else {
      acc.push({ kind: task.kind, count: 1, failed: task.status === '失败' ? 1 : 0 })
    }
    return acc
  }, [])
  const passRate = Math.round((rows('qualityReports').filter((row) => row.result === 'PASS').length / Math.max(1, rows('qualityReports').length)) * 100)
  return ok({
    scope,
    kpis: {
      projects: projects.length,
      episodes: projects.reduce((sum, row) => sum + Number(row.done ?? 0), 0),
      onTime: `${Math.max(72, 96 - projects.filter((row) => row.status === '异常中').length * 8)}%`,
      cost: totalCost,
      reuse: `${passRate}%`,
    },
    by_project: byProject,
    by_stage: byStage,
    task_mix: taskMix,
    cost_by_cap: rows('costDimensions').map((dim) => ({
      name: dim.name,
      amount: costs.filter((row) => String(row.cap ?? '').includes(String(dim.name).slice(0, 2))).reduce((sum, row) => sum + Number(row.actual ?? 0), 0),
    })),
  })
}

function opsOverview(): Envelope {
  const tasks = rows('tasks')
  const providers = rows('providers')
  return ok({
    queues: providers.slice(0, 5).map((provider, index) => {
      const kinds = ['视频生成', '视频生成', '音频合成', '质检', '视频生成'][index] ?? '视频生成'
      const queue = tasks.filter((row) => row.kind === kinds)
      return {
        name: `${provider.name} 队列`,
        provider: provider.name,
        running: queue.filter((row) => row.status === '执行中').length,
        waiting: queue.filter((row) => row.status === '排队中').length,
        failed: queue.filter((row) => row.status === '失败').length,
        p95: 18 + index * 9,
        status: provider.status,
      }
    }),
    storage: {
      objects: '1.28 TB · 234,880 对象',
      db: '42 GB · Postgres 16',
      cache: '6.4 GB · Redis',
      level: '64%（告警阈值 75%）',
    },
    services: [
      { name: 'API', status: '正常', note: 'P95 128ms' },
      { name: 'Worker', status: '正常', note: '并发 6 / 8' },
      { name: 'Redis', status: '正常', note: '队列正常' },
      { name: 'Postgres', status: '正常', note: '连接 14 / 100' },
      { name: '对象存储', status: '告警', note: '用量 64%' },
      { name: 'Mock 网关', status: '正常', note: 'VITE_DATA_MODE=mock' },
    ],
    providers: providers.map((row) => ({ name: row.name, kind: row.kind, models: row.models ?? '—', sla: row.sla ?? '—', cost: row.cost ?? '—', status: row.status })),
    incidents: rows('incidents'),
  })
}

function opsQueues(): Envelope {
  return ok(rows('tasks').filter((row) => ['排队中', '执行中', '失败'].includes(row.status)))
}

function opsConfig(): Envelope {
  return ok(store.dicts.ops ?? {})
}

function costsSummary(): Envelope {
  const costs = rows('costs')
  const total = costs.reduce((sum, row) => sum + Number(row.actual ?? 0), 0)
  const failed = costs.reduce((sum, row) => sum + Number(row.failed ?? 0), 0)
  return ok({
    total,
    failed,
    count: costs.length,
    by_project: rows('projects').map((project) => ({
      project: project.id,
      name: project.name,
      amount: costs.filter((row) => row.project === project.id).reduce((sum, row) => sum + Number(row.actual ?? 0), 0),
      budget: project.budget,
    })),
    by_provider: rows('providers').map((provider) => ({
      provider: provider.name,
      amount: costs.filter((row) => String(row.provider ?? '').includes(String(provider.name).slice(0, 4))).reduce((sum, row) => sum + Number(row.actual ?? 0), 0),
    })),
  })
}

/* ------------------------------------------------------------------ *
 * 鉴权
 * ------------------------------------------------------------------ */

function login(body: Row): Envelope {
  const identities = rows('identities')
  const target = identities.find((row) => row.id === body.identity_id) ?? identities[0]
  store.identityId = String(target.id)
  const user = rows('users').find((row) => row.id === target.userId) ?? rows('users')[0]
  return ok({
    access_token: `mock.${target.id}.${Date.now()}`,
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: 'mock-refresh',
    user: { id: user?.id ?? 'u-01', email: `${target.id}@studio.local`, full_name: target.name, is_active: true },
    identity: target,
    identity_id: target.id,
    permissions: permissionsOf(String(target.id)),
  })
}

function me(): Envelope {
  const identity = currentIdentity()
  const user = rows('users').find((row) => row.id === identity.userId) ?? rows('users')[0]
  return ok({
    user: { id: user?.id ?? 'u-01', email: `${identity.id}@studio.local`, full_name: identity.name, is_active: true },
    identity,
    identity_id: identity.id,
    permissions: currentPermissions(),
  })
}

/* ------------------------------------------------------------------ *
 * 路由分发
 * ------------------------------------------------------------------ */

const CUSTOM: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  { method: 'POST', pattern: /^\/auth\/login$/, handler: ({ body }) => login(body) },
  { method: 'POST', pattern: /^\/auth\/logout$/, handler: () => ok({ ok: true }) },
  { method: 'GET', pattern: /^\/auth\/me$/, handler: () => me() },
  { method: 'POST', pattern: /^\/mock\/identity$/, handler: ({ body }) => login({ identity_id: body.identity_id }) },
  { method: 'POST', pattern: /^\/mock\/reset$/, handler: () => { store.reset(); return ok({ reset: true }) } },
  { method: 'GET', pattern: /^\/workspace\/home$/, handler: () => workspaceHome() },
  { method: 'GET', pattern: /^\/projects\/([^/]+)\/workflow$/, handler: ({ id }) => workflow(id) },
  { method: 'POST', pattern: /^\/projects\/([^/]+)\/transitions$/, handler: ({ id, body }) => transition(id, body) },
  { method: 'GET', pattern: /^\/projects\/([^/]+)\/timeline$/, handler: ({ id }) => projectTimeline(id) },
  { method: 'GET', pattern: /^\/projects\/([^/]+)\/members$/, handler: ({ id }) => ok(projectOf(id).members ?? []) },
  { method: 'GET', pattern: /^\/projects\/([^/]+)\/summary$/, handler: ({ id }) => {
    const project = projectOf(id)
    return ok({
      project,
      stages: stageChain(project),
      scripts: rows('scripts').filter((row) => row.project === id),
      episodes: rows('episodes').filter((row) => row.project === id).slice(0, 30),
      assets: rows('assets').filter((row) => row.project === id),
      costs: rows('costs').filter((row) => row.project === id),
      tasks: rows('tasks').filter((row) => row.project === id),
      reviews: rows('reviews').filter((row) => row.project === id),
      notifications: rows('notifications').filter((row) => row.project === id),
    })
  } },
  { method: 'POST', pattern: /^\/scripts\/([^/]+)\/review$/, handler: ({ id, body }) => scriptReview(id, body) },
  { method: 'POST', pattern: /^\/generation\/tasks$/, handler: ({ body }) => createTask(body) },
  { method: 'POST', pattern: /^\/generation\/tasks\/([^/]+)\/(retry|cancel|pause)$/, handler: ({ id, parts }) => taskAction(id, parts[3] as 'retry' | 'cancel' | 'pause') },
  { method: 'GET', pattern: /^\/generation\/tasks\/([^/]+)\/attempts$/, handler: ({ id }) => ok(rows('attempts').filter((row) => row.task === id).map((row, index) => ({
    ...row,
    n: row.n ?? row.attempt ?? index + 1,
    fail: row.fail ?? row.reason ?? '—',
  }))) },
  { method: 'POST', pattern: /^\/quality\/run$/, handler: ({ body }) => runQuality(body) },
  { method: 'POST', pattern: /^\/reviews\/([^/]+)\/recheck$/, handler: ({ id, body }) => {
    const issue = byId('qualityIssues', id)
    issue.status = body.status ?? '已修复'
    store.persist()
    return ok(issue)
  } },
  { method: 'POST', pattern: /^\/reviews$/, handler: ({ body }) => finalReview(body) },
  { method: 'POST', pattern: /^\/deliveries$/, handler: ({ body }) => delivery(body) },
  { method: 'POST', pattern: /^\/notifications\/([^/]+)\/read$/, handler: ({ id }) => {
    const row = byId('notifications', id)
    row.unread = false
    row.state = '已处理'
    store.persist()
    return ok(row)
  } },
  { method: 'POST', pattern: /^\/notifications\/read-all$/, handler: () => {
    rows('notifications').forEach((row) => { row.unread = false; row.state = '已处理' })
    store.persist()
    return ok({ ok: true })
  } },
  { method: 'GET', pattern: /^\/analytics\/(enterprise|me)$/, handler: ({ parts }) => analytics(parts[2] as 'enterprise' | 'me') },
  { method: 'GET', pattern: /^\/ops\/overview$/, handler: () => opsOverview() },
  { method: 'GET', pattern: /^\/ops\/queues$/, handler: () => opsQueues() },
  { method: 'GET', pattern: /^\/ops\/logs$/, handler: () => ok(rows('audits')) },
  { method: 'GET', pattern: /^\/ops\/config$/, handler: () => opsConfig() },
  { method: 'GET', pattern: /^\/costs\/summary$/, handler: () => costsSummary() },
  { method: 'GET', pattern: /^\/orgs\/grants$/, handler: () => ok(rows('projects').flatMap((project) => (project.members ?? []).map((member: Row) => ({ project: project.id, projectName: project.name, ...member })))) },
  { method: 'GET', pattern: /^\/identities$/, handler: () => ok(rows('identities').map((identity) => ({ ...identity, permissions: permissionsOf(String(identity.id)) }))) },
  { method: 'GET', pattern: /^\/orgs\/enterprise$/, handler: () => ok(store.dicts.enterprise ?? {}) },
  { method: 'GET', pattern: /^\/orgs\/handovers$/, handler: () => ok([]) },
  { method: 'GET', pattern: /^\/permissions$/, handler: () => ok(Object.entries(store.dicts.permissions ?? {}).map(([code, name]) => ({ code, name }))) },
]

export async function handleMock(path: string, init: RequestInit = {}): Promise<Envelope> {
  const url = new URL(path, 'http://mock.local')
  const method = (init.method ?? 'GET').toUpperCase()
  const body = init.body ? (JSON.parse(String(init.body)) as Row) : {}
  const pathname = url.pathname.replace(/^\/api\/v1/, '') || '/'
  const parts = pathname.split('/').filter(Boolean)

  await new Promise((resolve) => setTimeout(resolve, LATENCY))

  for (const route of CUSTOM) {
    if (route.method !== method) continue
    const match = route.pattern.exec(pathname)
    if (!match) continue
    const result = route.handler({ id: match[1] ?? '', body, query: url.searchParams, method, parts })
    return result as Envelope
  }

  const collection = collectionByPath.get(`/${parts[0]}`)
  if (collection) {
    if (parts.length === 1) {
      if (method === 'GET') return listRows(collection, url.searchParams)
      if (method === 'POST') return createRow(collection, body)
    }
    if (parts.length >= 2) {
      const id = decodeURIComponent(parts[1])
      if (method === 'GET') return ok(sliceRows(collection.table, [byId(collection.table, id, collection.field ?? 'id')])[0])
      if (method === 'PATCH' || method === 'PUT') return patchRow(collection, id, body)
      if (method === 'DELETE') return deleteRow(collection, id)
    }
  }

  throw new MockHttpError(404, 'mock_route_missing', `mock 未实现接口 ${method} ${pathname}`)
}

export const mockRuntime = {
  identity: currentIdentity,
  permissions: currentPermissions,
}
