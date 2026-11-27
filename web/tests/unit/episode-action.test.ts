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

  it('walks E4 → E7 with timeline, audio, QC, final review and a single-episode package', async () => {
    const { handleMock, store } = await loadMock()
    await call(handleMock, '/api/v1/projects/SP-26031/summary')
    const act = (action: string, extra: Record<string, unknown> = {}) =>
      call(handleMock, '/api/v1/projects/SP-26031/episodes/19/actions', { action, ...extra }) as Promise<{
        data: { state: Record<string, unknown> }
      }>

    await act('lockAssets', { model: '视频模型 A' })
    await act('startProduction')
    await act('advanceQueue', { note: 'Mock 队列完成 18 镜' })
    expect(
      store.table('episodeStates').find((row) => row.project === 'SP-26031' && row.ep === 19)?.currentStep,
    ).toBe('E4')
    expect(store.table('tasks').filter((row) => row.project === 'SP-26031' && row.ep === 19).every((row) => row.status === '已通过')).toBe(true)

    const timeline = (await act('buildTimeline', { note: '建立 E19 时间线' })).data.state
    expect(timeline).toMatchObject({ currentStep: 'E4', timelineLocked: false })
    const lockedTimeline = (await act('lockTimeline', { note: '锁定 E19 时间线' })).data.state
    expect(lockedTimeline).toMatchObject({ currentStep: 'E5', timelineLocked: true })

    const audio = (await act('generateAudio', { note: '生成 E19 对白与字幕' })).data.state
    expect(audio).toMatchObject({ currentStep: 'E5', audioGenerated: true, subtitleApproved: false })
    const lip = (await act('runLipSync', { note: '执行 E19 口型同步' })).data.state
    expect(lip).toMatchObject({ currentStep: 'E5', lipSyncPassed: true })
    const subtitle = (await act('approveSubtitle', { note: '确认 E19 字幕' })).data.state
    expect(subtitle).toMatchObject({ currentStep: 'E5', subtitleApproved: true })
    const mix = (await act('checkMix', { note: '混音检查通过' })).data.state
    expect(mix).toMatchObject({ currentStep: 'E6', mixPassed: true })

    const qc = (await act('runEpisodeQc', { note: '单集 QC 执行' })).data.state
    expect(qc).toMatchObject({ currentStep: 'E6', qcPassed: false })

    const rework = (await act('reworkEpisode', { target: 'E5', note: '字幕错字，退回声音字幕' })).data.state
    expect(rework).toMatchObject({ currentStep: 'E5', qcPassed: false, mixPassed: false })
    expect(
      store.table('qualityReports').find((row) => row.project === 'SP-26031' && String(row.object).includes('第 19 集'))?.archived,
    ).toBe(true)

    await act('generateAudio', { note: '返工后重新生成字幕' })
    await act('approveSubtitle', { note: '返工后字幕确认' })
    await act('runLipSync', { note: '返工后口型复检' })
    const mixAgain = (await act('checkMix', { note: '返工后混音复检' })).data.state
    expect(mixAgain).toMatchObject({ currentStep: 'E6', mixPassed: true })
    const qcAgain = (await act('runEpisodeQc', { note: '返工后 QC 复检' })).data.state
    expect(qcAgain).toMatchObject({ currentStep: 'E6', qcPassed: false })

    const accepted = (await act('acceptEpisodeQc', { note: 'QC 确认通过' })).data.state
    expect(accepted).toMatchObject({ currentStep: 'E7', qcPassed: true })
    const final = (await act('approveEpisode', { note: '单集终审通过' })).data.state
    expect(final).toMatchObject({ currentStep: 'E7', finalApproved: true })
    const packaged = (await act('packageEpisode', { receiver: '企业内容库', note: '单集包入库' })).data.state
    expect(packaged).toMatchObject({ currentStep: 'E7', delivered: true })

    const deliveries = store.table('deliveries').filter((row) => row.project === 'SP-26031' && row.ep === 19)
    expect(deliveries[0]).toMatchObject({ kind: '单集包', episodes: 1, status: '已交付' })
    expect(store.table('episodes').find((row) => row.project === 'SP-26031' && row.no === 19)?.status).toBe('已交付')
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
