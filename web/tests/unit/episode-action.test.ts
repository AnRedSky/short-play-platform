import { beforeEach, describe, expect, it, vi } from 'vitest'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  }
}

async function loadMock() {
  const server = await import('../../src/mock/server')
  const db = await import('../../src/mock/db')
  return { handleMock: server.handleMock, store: db.store }
}

async function call(
  handleMock: (path: string, init?: RequestInit) => Promise<unknown>,
  path: string,
  body?: Record<string, unknown>,
) {
  return handleMock(path, body ? { method: 'POST', body: JSON.stringify(body) } : undefined)
}

describe('episode E0–E3 contract', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('localStorage', memoryStorage())
  })

  it('derives E0–E7 state from episode status and exposes batches', async () => {
    const { handleMock } = await loadMock()
    const result = (await call(handleMock, '/api/v1/projects/SP-26031/summary')) as {
      data: { episodeStates: Array<Record<string, unknown>> }
    }
    const states = result.data.episodeStates
    expect(states).toHaveLength(24)
    const e19 = states.find((state) => state.ep === 19)
    expect(e19).toMatchObject({
      currentStep: 'E2',
      inputConfirmed: true,
      scriptLocked: true,
      assetsLocked: false,
      productionStarted: false,
    })
    expect(e19?.batch).toBe(4)
  })

  it('walks E0 → E1 → E2 → E3 through the action contract', async () => {
    const { handleMock, store } = await loadMock()
    await call(handleMock, '/api/v1/projects/SP-26031/summary')
    const e24 = store
      .table('episodeStates')
      .find((row) => row.project === 'SP-26031' && row.ep === 24)
    expect(e24).toBeTruthy()
    Object.assign(e24!, {
      currentStep: 'E0',
      status: '待启动',
      inputConfirmed: false,
      scriptLocked: false,
      assetsLocked: false,
      productionStarted: false,
    })

    const input = (await call(handleMock, '/api/v1/projects/SP-26031/episodes/24/actions', {
      action: 'confirmInput',
      note: 'E23 钩子与 E24 任务单已对齐',
    })) as { data: { state: Record<string, unknown> } }
    expect(input.data.state).toMatchObject({ currentStep: 'E1', inputConfirmed: true })

    const script = (await call(handleMock, '/api/v1/projects/SP-26031/episodes/24/actions', {
      action: 'lockScript',
      note: 'E24 单集剧本 V4 锁定',
    })) as { data: { state: Record<string, unknown> } }
    expect(script.data.state).toMatchObject({ currentStep: 'E2', scriptLocked: true })

    const assets = (await call(handleMock, '/api/v1/projects/SP-26031/episodes/24/actions', {
      action: 'lockAssets',
      model: '视频模型 A',
      note: '镜头契约与资产锁定',
    })) as { data: { state: Record<string, unknown> } }
    expect(assets.data.state).toMatchObject({
      currentStep: 'E3',
      assetsLocked: true,
      modelBaseline: '视频模型 A',
    })
  })

  it('locks E2 assets, starts E3 tasks, retries and opens a new take when model changes', async () => {    const { handleMock, store } = await loadMock()

    const locked = (await call(handleMock, '/api/v1/projects/SP-26031/episodes/19/actions', {
      action: 'lockAssets',
      model: '视频模型 B',
      note: 'E19 镜头契约与资产锁定',
    })) as { data: { state: Record<string, unknown> } }
    expect(locked.data.state).toMatchObject({
      currentStep: 'E3',
      assetsLocked: true,
      modelBaseline: '视频模型 B',
    })

    const started = (await call(handleMock, '/api/v1/projects/SP-26031/episodes/19/actions', {
      action: 'startProduction',
      note: '派发 18 个镜头任务',
    })) as { data: { state: Record<string, unknown> } }
    expect(started.data.state).toMatchObject({ currentStep: 'E3', productionStarted: true })

    const tasks = store.table('tasks').filter((row) => row.project === 'SP-26031' && row.ep === 19)
    expect(tasks).toHaveLength(18)
    const first = tasks[0]
    expect(first).toMatchObject({ status: '排队中', take: 1, model: '视频模型 B' })

    first.status = '失败'
    first.failReason = '供应商超时（可重试）'
    const retried = (await call(handleMock, '/api/v1/projects/SP-26031/episodes/19/actions', {
      action: 'retryTask',
      taskId: first.id,
    })) as { data: { state: Record<string, unknown> } }
    expect(retried.data.state.currentStep).toBe('E3')
    expect(first.status).toBe('排队中')
    expect(first.attempt).toBe(2)

    const changed = (await call(handleMock, '/api/v1/projects/SP-26031/episodes/19/actions', {
      action: 'changeModel',
      taskId: first.id,
      model: '视频模型 A（图生视频）',
      note: '人物连续性不足，换参考视频模型',
    })) as { data: { state: Record<string, unknown> } }
    expect(changed.data.state.currentStep).toBe('E3')
    expect(first.status).toBe('已替代')
    const take2 = store
      .table('tasks')
      .find(
        (row) =>
          row.project === 'SP-26031' &&
          row.ep === 19 &&
          row.shot === first.shot &&
          Number(row.take) === 2,
      )
    expect(take2).toMatchObject({
      status: '排队中',
      model: '视频模型 A（图生视频）',
      parentTask: first.id,
      take: 2,
    })
  })
})
