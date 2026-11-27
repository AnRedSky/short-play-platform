import { afterAll, describe, expect, it, vi } from 'vitest'

/**
 * B-14 service 契约。
 *
 * 每个 service 函数都在 mock 与 real 两条分支上各调用一次：
 * - 请求断言记录 HTTP method / path / query / 必要 header；
 * - 响应断言由同一个 assertResult 执行，页面形状不因数据源而变；
 * - 汇总后的结构签名写入 snapshot，任何函数漏测或路径漂移都会失败。
 */

type Mode = 'mock' | 'real'
type Fn = (...args: unknown[]) => Promise<unknown>
type ServiceBag = Record<string, Record<string, Fn>>

interface RequestExpectation {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  headers?: string[]
}

interface ContractSpec {
  name: string
  invoke: (services: ServiceBag, mode: Mode) => Promise<unknown>
  mock: RequestExpectation
  real: RequestExpectation
  kind: 'page' | 'array' | 'object'
  /** 页面实际消费的行字段；mock 与 real 都必须提供。 */
  rowKeys?: string[]
  /** 覆盖 real 分支的 envelope.data。 */
  realData?: unknown
  /** real 分支需要断言携带的请求头。 */
  realHeaders?: string[]
  /** mock 分支需要断言携带的请求头。 */
  mockHeaders?: string[]
}

interface RecordedCall {
  method: string
  path: string
  body?: string
  headers: Headers
}

const PROJECT_CODE = 'SP-26031'
const PROJECT_RECORD = '5a7f41e2-8b3c-4c1e-9d2a-1b6c7e8f9012'
const TASK_RECORD = '0f1e2d3c-4b5a-6978-8c9d-0a1b2c3d4e5f'

function request(
  method: RequestExpectation['method'],
  path: string,
  headers?: string[],
): RequestExpectation {
  return { method, path, headers }
}

/** mock 分支保留业务码，real 分支必须换成后端 record_id。 */
function projectPath(
  suffix: string,
  method: RequestExpectation['method'] = 'GET',
): { mock: RequestExpectation; real: RequestExpectation } {
  return {
    mock: request(method, `/projects/${PROJECT_CODE}${suffix}`),
    real: request(method, `/projects/${PROJECT_RECORD}${suffix}`),
  }
}

const specs: ContractSpec[] = [
  {
    name: 'access.identities',
    invoke: (s) => s.access.identities(),
    mock: request('GET', '/identities'),
    real: request('GET', '/identities'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'analytics.get',
    invoke: (s) => s.analytics.get('enterprise'),
    mock: request('GET', '/analytics/enterprise'),
    real: request('GET', '/analytics/enterprise'),
    kind: 'object',
  },
  {
    name: 'assets.list',
    invoke: (s) => s.assets.list(5),
    mock: request('GET', '/assets?limit=5'),
    real: request('GET', '/assets?limit=5'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'assets.categories',
    invoke: (s) => s.assets.categories(),
    mock: request('GET', '/asset-categories'),
    real: request('GET', '/asset-categories'),
    kind: 'page',
  },
  {
    name: 'assets.create',
    invoke: (s) => s.assets.create({
      name: 'contract asset',
      cat: '人物资产',
      type: '人物参考图',
      origin: '契约测试',
      rights: 'AI 生成 · 无需真人授权',
    }),
    mock: request('POST', '/assets'),
    real: request('POST', '/assets'),
    kind: 'object',
  },
  {
    name: 'assets.references',
    invoke: (s) => s.assets.references('A-1201'),
    mock: request('GET', '/assets/A-1201/references'),
    real: request('GET', '/assets/A-1201/references'),
    kind: 'array',
    rowKeys: ['project', 'object', 'kind'],
    realData: [{ project: 'SP-26031', object: 'SH-26031-E17-04', kind: '镜头参考', status: '执行中' }],
  },
  {
    name: 'creation.briefs',
    invoke: (s) => s.creation.briefs(PROJECT_CODE),
    mock: request('GET', `/briefs?project=${PROJECT_CODE}`),
    real: request('GET', `/briefs?project=${PROJECT_CODE}`),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'creation.briefModes',
    invoke: (s) => s.creation.briefModes(),
    mock: request('GET', '/brief-modes'),
    real: request('GET', '/brief-modes'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'creation.creativePlans',
    invoke: (s) => s.creation.creativePlans(PROJECT_CODE),
    mock: request('GET', `/creative-plans?project=${PROJECT_CODE}`),
    real: request('GET', `/creative-plans?project=${PROJECT_CODE}`),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'creation.createBrief',
    invoke: (s) => s.creation.createBrief({
      project: PROJECT_CODE,
      genre: '悬疑 / 都市',
      audience: '25–40 岁女性',
      style: '冷灰低饱和 · 手持近景',
      constraints: '不出现真实品牌',
      note: 'contract brief',
      mode: '自由描述',
    }),
    mock: request('POST', '/briefs'),
    real: request('POST', '/briefs'),
    kind: 'object',
  },
  {
    name: 'creation.generateCreativePlans',
    invoke: (s) => s.creation.generateCreativePlans({
      project: PROJECT_CODE,
      idea: 'contract idea',
      mode: '自由描述',
      count: 3,
    }),
    mock: request('POST', '/creative-plans/generate'),
    real: request('POST', '/creative-plans/generate'),
    kind: 'array',
    rowKeys: ['id', 'title', 'chosen'],
    realData: [{ id: 'CP-contract-1', title: 'contract plan', chosen: false }],
  },
  {
    name: 'creation.selectCreativePlan',
    invoke: (s) => s.creation.selectCreativePlan('CP-26031-B', PROJECT_CODE),
    mock: request('POST', '/creative-plans/CP-26031-B/select'),
    real: request('POST', '/creative-plans/CP-26031-B/select'),
    kind: 'object',
  },
  {
    name: 'creation.updateBrief',
    invoke: (s) => s.creation.updateBrief('CB-26031-03', { note: 'contract' }),
    mock: request('PATCH', '/briefs/CB-26031-03'),
    real: request('PATCH', '/briefs/CB-26031-03'),
    kind: 'object',
  },
  {
    name: 'creation.scripts',
    invoke: (s) => s.creation.scripts(PROJECT_CODE),
    mock: request('GET', `/scripts?project=${PROJECT_CODE}`),
    real: request('GET', `/scripts?project=${PROJECT_CODE}`),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'creation.scriptDiffs',
    invoke: (s) => s.creation.scriptDiffs(),
    mock: request('GET', '/script-diffs'),
    real: request('GET', '/script-diffs'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'creation.createScript',
    invoke: (s) => s.creation.createScript({ project: PROJECT_CODE, version: 'v5' }),
    mock: request('POST', '/scripts'),
    real: request('POST', '/scripts'),
    kind: 'object',
  },
  {
    name: 'creation.reviews',
    invoke: (s) => s.creation.reviews(PROJECT_CODE),
    mock: request('GET', `/reviews?project=${PROJECT_CODE}`),
    real: request('GET', `/reviews?project=${PROJECT_CODE}`),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'creation.reviewChecklist',
    invoke: (s) => s.creation.reviewChecklist(),
    mock: request('GET', '/review-checklist'),
    real: request('GET', '/review-checklist'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'creation.reviewScript',
    invoke: (s) => s.creation.reviewScript('SCR-26031-V4', { result: '通过' }),
    mock: request('POST', '/scripts/SCR-26031-V4/review'),
    real: request('POST', '/scripts/SCR-26031-V4/review'),
    kind: 'object',
  },
  {
    name: 'director.shots',
    invoke: (s) => s.director.shots(PROJECT_CODE, 5),
    mock: request('GET', `/shots?project=${PROJECT_CODE}&limit=5`),
    real: request('GET', `/shots?project=${PROJECT_CODE}&limit=5`),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'director.createTask',
    invoke: (s) => s.director.createTask({ project: PROJECT_CODE, kind: '视频生成' }),
    mock: request('POST', '/generation/tasks'),
    real: request('POST', '/generation/tasks'),
    kind: 'object',
  },
  {
    name: 'ops.overview',
    invoke: (s) => s.ops.overview(),
    mock: request('GET', '/ops/overview'),
    real: request('GET', '/ops/overview'),
    kind: 'object',
  },
  {
    name: 'ops.config',
    invoke: (s) => s.ops.config(),
    mock: request('GET', '/ops/config'),
    real: request('GET', '/ops/config'),
    kind: 'object',
  },
  {
    name: 'orgs.enterprise',
    invoke: (s) => s.orgs.enterprise(),
    mock: request('GET', '/orgs/enterprise'),
    real: request('GET', '/orgs/enterprise'),
    kind: 'object',
  },
  {
    name: 'orgs.departments',
    invoke: (s) => s.orgs.departments(),
    mock: request('GET', '/departments'),
    real: request('GET', '/departments'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'orgs.users',
    invoke: (s) => s.orgs.users(),
    mock: request('GET', '/users'),
    real: request('GET', '/users'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'post.timelines',
    invoke: (s) => s.post.timelines(PROJECT_CODE, 5),
    mock: request('GET', `/timelines?project=${PROJECT_CODE}&limit=5`),
    real: request('GET', `/timelines?project=${PROJECT_CODE}&limit=5`),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'post.tracks',
    invoke: (s) => s.post.tracks(),
    mock: request('GET', '/tracks'),
    real: request('GET', '/tracks'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'post.episodes',
    invoke: (s) => s.post.episodes(PROJECT_CODE, 5),
    mock: request('GET', `/episodes?project=${PROJECT_CODE}&limit=5`),
    real: request('GET', `/episodes?project=${PROJECT_CODE}&limit=5`),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'post.outputEpisode',
    invoke: (s) => s.post.outputEpisode(PROJECT_CODE, '1'),
    mock: request('POST', '/episodes/1/output'),
    real: request('POST', '/episodes/1/output'),
    kind: 'object',
  },
  {
    name: 'post.rebuildTimeline',
    invoke: (s) => s.post.rebuildTimeline('TL-26031-E16-V3', PROJECT_CODE),
    mock: request('POST', '/timelines/TL-26031-E16-V3/rebuild'),
    real: request('POST', '/timelines/TL-26031-E16-V3/rebuild'),
    kind: 'object',
  },
  {
    name: 'post.runQuality',
    invoke: (s) => s.post.runQuality({ project: PROJECT_CODE, level: '单集级' }),
    mock: request('POST', '/quality/run'),
    real: request('POST', '/quality/run'),
    kind: 'object',
  },
  {
    name: 'post.reviews',
    invoke: (s) => s.post.reviews(PROJECT_CODE),
    mock: request('GET', `/reviews?project=${PROJECT_CODE}`),
    real: request('GET', `/reviews?project=${PROJECT_CODE}`),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'post.createReview',
    invoke: (s) => s.post.createReview({ project: PROJECT_CODE, result: '通过' }),
    mock: request('POST', '/reviews'),
    real: request('POST', '/reviews'),
    kind: 'object',
  },
  {
    name: 'post.deliveries',
    invoke: (s) => s.post.deliveries(),
    mock: request('GET', '/deliveries'),
    real: request('GET', '/deliveries'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'post.deliveryChecklist',
    invoke: (s) => s.post.deliveryChecklist(),
    mock: request('GET', '/delivery-checklist'),
    real: request('GET', '/delivery-checklist'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'post.createDelivery',
    invoke: (s) => s.post.createDelivery({ project: PROJECT_CODE }),
    mock: request('POST', '/deliveries'),
    real: request('POST', '/deliveries'),
    kind: 'object',
  },
  {
    name: 'projects.list',
    invoke: (s) => s.projects.list({ limit: 5 }),
    mock: request('GET', '/projects?limit=5'),
    real: request('GET', '/projects?limit=5'),
    kind: 'page',
    rowKeys: ['id', 'name'],
  },
  {
    name: 'projects.create',
    invoke: (s) => s.projects.create({ name: 'contract project' }),
    mock: request('POST', '/projects'),
    real: request('POST', '/projects'),
    kind: 'object',
  },
  {
    name: 'projects.update',
    invoke: (s) => s.projects.update(PROJECT_CODE, { name: 'contract project' }),
    mock: request('PATCH', `/projects/${PROJECT_CODE}`),
    real: request('PATCH', `/projects/${PROJECT_RECORD}`),
    kind: 'object',
  },
  {
    name: 'projects.summary',
    invoke: (s) => s.projects.summary(PROJECT_CODE),
    ...projectPath('/summary'),
    kind: 'object',
  },
  {
    name: 'projects.workflow',
    invoke: (s) => s.projects.workflow(PROJECT_CODE),
    ...projectPath('/workflow'),
    kind: 'object',
  },
  {
    name: 'projects.timeline',
    invoke: (s) => s.projects.timeline(PROJECT_CODE),
    ...projectPath('/timeline'),
    kind: 'array',
  },
  {
    name: 'projects.episodeAction',
    invoke: (s) =>
      s.projects.episodeAction(PROJECT_CODE, 19, {
        action: 'lockAssets',
        model: '视频模型 A',
        note: 'contract',
      }),
    ...projectPath('/episodes/19/actions', 'POST'),
    kind: 'object',
    realData: { state: { currentStep: 'E3' } },
  },
  {
    name: 'projects.transition',
    invoke: (s) => s.projects.transition(PROJECT_CODE, 'toPost', 'contract'),
    ...projectPath('/transitions', 'POST'),
    kind: 'object',
  },
  {
    name: 'projects.states',
    invoke: (s) => s.projects.states(),
    mock: request('GET', '/project-states'),
    real: request('GET', '/project-states'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'projects.pipeline',
    invoke: (s) => s.projects.pipeline(),
    mock: request('GET', '/stage-pipeline'),
    real: request('GET', '/stage-pipeline'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'projects.departments',
    invoke: (s) => s.projects.departments(),
    mock: request('GET', '/departments'),
    real: request('GET', '/departments'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'projects.users',
    invoke: (s) => s.projects.users(),
    mock: request('GET', '/users'),
    real: request('GET', '/users'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'quality.reports',
    invoke: (s) => s.quality.reports(5),
    mock: request('GET', '/quality-reports?limit=5'),
    real: request('GET', '/quality-reports?page=1&page_size=5'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'quality.issues',
    invoke: (s) => s.quality.issues(),
    mock: request('GET', '/quality-issues'),
    real: request('GET', '/quality-issues?page=1&page_size=100'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'quality.levels',
    invoke: (s) => s.quality.levels(),
    mock: request('GET', '/quality-levels'),
    real: request('GET', '/quality-levels'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'quality.run',
    invoke: (s) => s.quality.run({ project: PROJECT_CODE, level: '单集级' }),
    mock: request('POST', '/quality/run'),
    real: request('POST', `/projects/${PROJECT_RECORD}/quality/runs`),
    kind: 'object',
  },
  {
    name: 'quality.acceptReport',
    invoke: (s) => s.quality.acceptReport('QR-26031-E17-03', { note: '已核对问题项' }),
    mock: request('POST', '/quality-reports/QR-26031-E17-03/accept'),
    real: request('POST', '/quality-reports/QR-26031-E17-03/accept'),
    kind: 'object',
  },
  {
    name: 'quality.createRework',
    invoke: (s) => s.quality.createRework({ project: PROJECT_CODE, target: 'SH-26031-E17-06', type: '人物不一致' }),
    mock: request('POST', '/rework'),
    real: request('POST', `/projects/${PROJECT_RECORD}/quality/reworks`),
    kind: 'object',
  },
  {
    name: 'spec.list',
    invoke: (s) => s.spec.list('/projects', { limit: 5 }),
    mock: request('GET', '/projects?limit=5'),
    real: request('GET', '/projects?limit=5'),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'video.tasks',
    invoke: (s) => s.video.tasks(PROJECT_CODE, 5),
    mock: request('GET', `/generation-tasks?project=${PROJECT_CODE}&limit=5`),
    real: request('GET', `/projects/${PROJECT_RECORD}/generation/tasks?page=1&page_size=5`),
    kind: 'page',
    rowKeys: ['id', 'status', 'kind'],
  },
  {
    name: 'video.attempts',
    invoke: (s, mode) => s.video.attempts(mode === 'mock' ? 'T-8842' : TASK_RECORD),
    mock: request('GET', '/generation/tasks/T-8842/attempts'),
    real: request('GET', `/generation/tasks/${TASK_RECORD}`),
    kind: 'array',
    rowKeys: ['id', 'n', 'status', 'fail'],
    realData: {
      id: TASK_RECORD,
      attempts: [
        {
          attempt_number: 1,
          status: 'running',
          error_code: null,
          started_at: '2026-11-26T02:00:00Z',
          finished_at: null,
        },
      ],
    },
  },
  {
    name: 'video.retry',
    invoke: (s, mode) => s.video.retry(mode === 'mock' ? 'T-8824' : TASK_RECORD),
    mock: request('POST', '/generation/tasks/T-8824/retry'),
    real: request('POST', `/generation/tasks/${TASK_RECORD}/retry`),
    kind: 'object',
  },
  {
    name: 'video.cancel',
    invoke: (s, mode) => s.video.cancel(mode === 'mock' ? 'T-8842' : TASK_RECORD),
    mock: request('POST', '/generation/tasks/T-8842/cancel'),
    real: request('POST', `/generation/tasks/${TASK_RECORD}/cancel`),
    kind: 'object',
  },
  {
    name: 'video.updateTask',
    invoke: (s, mode) => s.video.updateTask(mode === 'mock' ? 'T-8842' : TASK_RECORD, { status: '排队中' }),
    mock: request('PATCH', '/generation-tasks/T-8842'),
    real: request('POST', '/generation/queue/dispatch'),
    kind: 'object',
  },
  {
    name: 'video.createTask',
    invoke: (s) => s.video.createTask({ project: PROJECT_CODE, kind: '视频生成', ep: 1 }),
    mock: request('POST', '/generation/tasks'),
    real: request('POST', `/projects/${PROJECT_RECORD}/generation/tasks`, ['Idempotency-Key']),
    kind: 'object',
  },
  {
    name: 'workspace.home',
    invoke: (s) => s.workspace.home(),
    mock: request('GET', '/workspace/home'),
    real: request('GET', '/workspace/home'),
    kind: 'object',
  },
  {
    name: 'workspace.costSummary',
    invoke: (s) => s.workspace.costSummary(),
    mock: request('GET', '/costs/summary'),
    real: request('GET', '/costs/summary'),
    kind: 'object',
  },
  {
    name: 'workspace.notifications',
    invoke: (s) => s.workspace.notifications(5, PROJECT_CODE),
    mock: request('GET', `/notifications?limit=5&project=${PROJECT_CODE}`),
    real: request('GET', `/notifications?limit=5&project=${PROJECT_CODE}`),
    kind: 'page',
    rowKeys: ['id'],
  },
  {
    name: 'workspace.markNotificationRead',
    invoke: (s) => s.workspace.markNotificationRead('N-4412'),
    mock: request('POST', '/notifications/N-4412/read'),
    real: request('POST', '/notifications/N-4412/read'),
    kind: 'object',
  },
  {
    name: 'workspace.markAllNotificationsRead',
    invoke: (s) => s.workspace.markAllNotificationsRead(),
    mock: request('POST', '/notifications/read-all'),
    real: request('POST', '/notifications/read-all'),
    kind: 'object',
  },
  {
    name: 'workspace.createTask',
    invoke: (s) => s.workspace.createTask({ project: PROJECT_CODE, kind: '视频生成' }),
    mock: request('POST', '/generation/tasks'),
    real: request('POST', '/generation/tasks'),
    kind: 'object',
  },
]

async function loadServices(mode: Mode) {
  vi.resetModules()
  vi.stubEnv('VITE_DATA_MODE', mode)
  const api = await import('../../src/api')
  const mockServer = await import('../../src/mock/server')
  const registry = await import('../../src/services/projects/registry')
  const services = {
    access: (await import('../../src/services/access')).accessApi,
    analytics: (await import('../../src/services/analytics')).analyticsApi,
    assets: (await import('../../src/services/assets')).assetApi,
    creation: (await import('../../src/services/creation')).creationApi,
    director: (await import('../../src/services/director')).directorApi,
    ops: (await import('../../src/services/ops')).opsApi,
    orgs: (await import('../../src/services/orgs')).orgApi,
    post: (await import('../../src/services/post')).postApi,
    projects: (await import('../../src/services/projects')).projectApi,
    quality: (await import('../../src/services/quality')).qualityApi,
    spec: (await import('../../src/services/spec')).specApi,
    video: (await import('../../src/services/video')).videoApi,
    workspace: (await import('../../src/services/workspace')).workspaceApi,
  } as unknown as ServiceBag
  registry.clearProjectRefs()
  registry.rememberProject({ id: PROJECT_CODE, record_id: PROJECT_RECORD })
  return { api, mockServer, services }
}

function realDataFor(spec: ContractSpec): unknown {
  if (spec.realData !== undefined) return spec.realData
  const row = {
    id: `contract-${spec.name}`,
    name: 'contract row',
    status: 'draft',
    record_id: PROJECT_RECORD,
  }
  if (spec.kind === 'page') return [row]
  if (spec.kind === 'array') return [row]
  return {}
}

function realEnvelope(spec: ContractSpec) {
  const data = realDataFor(spec)
  if (spec.kind === 'page') {
    return { data, meta: { page: 1, page_size: 5, total: Array.isArray(data) ? data.length : 0 } }
  }
  return { data }
}

function assertResult(spec: ContractSpec, result: unknown) {
  if (spec.kind === 'page') {
    expect(result).toMatchObject({
      rows: expect.any(Array),
      total: expect.any(Number),
      page: expect.any(Number),
      page_size: expect.any(Number),
    })
    const rows = (result as { rows: Record<string, unknown>[] }).rows
    for (const key of spec.rowKeys ?? []) {
      for (const row of rows) expect(row).toHaveProperty(key)
    }
    return
  }
  if (spec.kind === 'array') {
    expect(Array.isArray(result)).toBe(true)
    for (const key of spec.rowKeys ?? []) {
      for (const row of result as Record<string, unknown>[]) expect(row).toHaveProperty(key)
    }
    return
  }
  expect(result).toBeTruthy()
  expect(typeof result).toBe('object')
  expect(Array.isArray(result)).toBe(false)
}

function contractShape(spec: ContractSpec, result: unknown) {
  if (spec.kind === 'page') {
    const rows = (result as { rows: Record<string, unknown>[] }).rows
    return {
      kind: 'page',
      envelope: ['rows', 'total', 'page', 'page_size'],
      row: (spec.rowKeys ?? []).map((key) => [key, typeof rows[0]?.[key]]),
    }
  }
  if (spec.kind === 'array') {
    const rows = result as Record<string, unknown>[]
    return {
      kind: 'array',
      row: (spec.rowKeys ?? []).map((key) => [key, typeof rows[0]?.[key]]),
    }
  }
  return { kind: 'object' }
}

function assertRequest(expected: RequestExpectation, call: RecordedCall | undefined) {
  expect(call, 'service must issue exactly one HTTP request').toBeTruthy()
  expect(call?.method).toBe(expected.method)
  expect(call?.path).toBe(expected.path)
  for (const header of expected.headers ?? []) {
    expect(call?.headers.has(header)).toBe(true)
  }
}

async function exercise(mode: Mode) {
  const { api, mockServer, services } = await loadServices(mode)
  const calls: RecordedCall[] = []
  const shapes: Record<string, unknown> = {}
  let currentName = ''

  if (mode === 'mock') {
    api.configureApiMock(async (path: string, init: RequestInit) => {
      calls.push({
        method: init.method ?? 'GET',
        path,
        body: typeof init.body === 'string' ? init.body : undefined,
        headers: new Headers(init.headers),
      })
      return mockServer.handleMock(path, init)
    })
  } else {
    api.configureApiMock(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), 'http://contract.local')
        calls.push({
          method: init?.method ?? 'GET',
          path: `${url.pathname.replace(/^\/api\/v1/, '')}${url.search}`,
          body: typeof init?.body === 'string' ? init.body : undefined,
          headers: new Headers(init?.headers),
        })
        const current = specs.find((item) => item.name === currentName)
        return new Response(JSON.stringify(realEnvelope(current ?? specs[0])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )
  }

  for (const spec of specs) {
    currentName = spec.name
    calls.length = 0
    const result = await spec.invoke(services, mode)
    assertRequest(mode === 'mock' ? spec.mock : spec.real, calls[0])
    assertResult(spec, result)
    shapes[spec.name] = contractShape(spec, result)
  }
  api.configureApiMock(undefined)
  const covered = Object.keys(shapes).sort()
  const methods = Object.entries(services)
    .flatMap(([domain, api]) => Object.keys(api).map((method) => `${domain}.${method}`))
    .sort()
  expect(covered, 'every exported service function must have a contract spec').toEqual(methods)
  return shapes
}

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('B-14 service contract', () => {
  it('runs every service function against mock and real with shared assertions', async () => {
    const mockShapes = await exercise('mock')
    const realShapes = await exercise('real')

    expect(Object.keys(mockShapes).sort()).toEqual(specs.map((spec) => spec.name).sort())
    expect(realShapes).toEqual(mockShapes)
    expect(mockShapes).toMatchSnapshot('service shapes')
  }, 15_000)

  it('marks a notification read with the POST route used by the inbox dialog', async () => {
    const { api, mockServer } = await loadServices('mock')
    api.configureApiMock(mockServer.handleMock)
    const result = await api.apiRequest<{ data: { id: string; unread: boolean } }>(
      '/notifications/N-4412/read',
      { method: 'POST' },
    )
    expect(result.data).toMatchObject({ id: 'N-4412', unread: false })
  })
})
