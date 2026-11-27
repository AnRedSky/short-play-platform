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
      data: {
        episodeStates: Array<Record<string, unknown>>
        qualityProfiles: Array<Record<string, unknown>>
      }
    }
    const states = result.data.episodeStates
    expect(states).toHaveLength(24)
    expect(result.data.qualityProfiles.map((profile) => profile.id)).toEqual([
      'QC-SUB',
      'QC-AV',
      'QC-TIME',
      'QC-SAFE',
    ])
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

  it('derives project status from episode progress and hides stage actions', async () => {
    const { handleMock, store } = await loadMock()
    const summary = (await call(handleMock, '/api/v1/projects/SP-26031/summary')) as {
      data: { project: Record<string, unknown> }
    }
    expect(summary.data.project.status).toBe('生产准备中')
    const detail = (await call(handleMock, '/api/v1/projects/SP-26031/workflow')) as {
      data: {
        project: Record<string, unknown>
        stages: Array<Record<string, unknown>>
        allowed_actions: Array<Record<string, unknown>>
      }
    }
    expect(detail.data.allowed_actions.map((action) => action.key)).toEqual(['terminate'])

    const states = store.table('episodeStates').filter((row) => row.project === 'SP-26031')
    const pending = states.filter((row) => !row.delivered)
    for (const row of pending) Object.assign(row, { currentStep: 'E4' })
    const post = (await call(handleMock, '/api/v1/projects/SP-26031/workflow')) as typeof detail
    expect(post.data.project.status).toBe('后期制作中')
    expect(post.data.stages.find((stage) => stage.state === 'now')?.name).toBe('后期合成')
    expect(post.data.allowed_actions.map((action) => action.key)).toEqual(['pause'])

    for (const row of pending) Object.assign(row, { currentStep: 'E6' })
    const qc = (await call(handleMock, '/api/v1/projects/SP-26031/workflow')) as typeof detail
    expect(qc.data.project.status).toBe('质量检测中')
    expect(qc.data.allowed_actions).toEqual([])

    for (const row of states) Object.assign(row, { currentStep: 'E7', finalApproved: true })
    const done = (await call(handleMock, '/api/v1/projects/SP-26031/workflow')) as typeof detail
    expect(done.data.project.status).toBe('已完成')

    for (const row of states) Object.assign(row, { delivered: true })
    const delivered = (await call(handleMock, '/api/v1/projects/SP-26031/workflow')) as typeof detail
    expect(delivered.data.project.status).toBe('已交付')
    expect(delivered.data.allowed_actions.map((action) => action.key)).toEqual(['archive'])
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
    const clips = store.table('timelineClips').filter((row) => row.project === 'SP-26031' && row.ep === 19)
    expect(clips).toHaveLength(18)

    const replaced = (await act('replaceClip', {
      clipId: clips[2].id,
      model: '视频模型 B',
      note: 'SH-03 换模型替换片段',
    })).data.state
    expect(replaced).toMatchObject({ currentStep: 'E4', timelineLocked: false })
    expect(clips[2].stale).toBe(true)
    expect(store.table('timelines').find((row) => row.project === 'SP-26031' && row.ep === 19)?.stale).toBe(1)
    const rebuilt = (await act('rebuildTimeline', { note: '重建 E19 时间线' })).data.state
    expect(rebuilt).toMatchObject({ currentStep: 'E4', timelineLocked: false })
    expect(clips[2].stale).toBe(false)

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

    const qcFail = (
      await act('failEpisodeQc', { profile: 'QC-AV', note: '音画不同步，记录 QC 阻断' })
    ).data.state
    expect(qcFail).toMatchObject({ currentStep: 'E6', qcPassed: false })
    const failedReport = store
      .table('qualityReports')
      .find((row) => row.project === 'SP-26031' && String(row.object).includes('第 19 集'))
    expect(failedReport).toMatchObject({ result: 'FAIL', fail: 1 })
    const failedIssue = store
      .table('qualityIssues')
      .find((row) => row.report === failedReport?.id)
    expect(failedIssue).toMatchObject({
      dim: '音画同步',
      profile: 'QC-AV',
      where: 'E19 / S02 / SH-04 · 00:12',
    })

    const rework = (await act('reworkEpisode', { target: 'E5', note: '音画偏移，退回声音字幕' })).data.state
    expect(rework).toMatchObject({
      currentStep: 'E5',
      qcPassed: false,
      mixPassed: false,
      subtitleApproved: false,
      lipSyncPassed: false,
    })
    expect(failedReport?.archived).toBe(true)

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

  it('locks E2 assets, starts E3 tasks, retries and opens a new take when model changes', async () => {
    const { handleMock, store } = await loadMock()

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

  it('creates a 3-episode batch trial gate without advancing episodes', async () => {
    const { handleMock } = await loadMock()
    await call(handleMock, '/api/v1/projects/SP-26031/summary')
    const result = (await call(handleMock, '/api/v1/projects/SP-26031/batches/4/trial', {
      size: 3,
    })) as { data: Record<string, unknown> }
    expect(result.data).toMatchObject({
      id: 'BT-26031-B4',
      batch: 4,
      size: 3,
      episodes: [19, 20, 21],
      status: '待补齐',
      gate: '2/3 开工项通过',
      deliveryGate: '0/3 集已交付',
    })
    expect((result.data.checks as Array<Record<string, unknown>>).map((check) => check.key)).toEqual([
      'script',
      'assets',
      'model',
      'delivery',
    ])
    expect((result.data.checks as Array<Record<string, unknown>>)[1]).toMatchObject({
      key: 'assets',
      pass: false,
      detail: '0/3',
    })

    const summary = (await call(handleMock, '/api/v1/projects/SP-26031/summary')) as {
      data: { batchTrials: Array<Record<string, unknown>>; episodeStates: Array<Record<string, unknown>> }
    }
    expect(summary.data.batchTrials).toHaveLength(1)
    expect(summary.data.batchTrials[0]).toMatchObject({ id: 'BT-26031-B4' })
    expect(summary.data.episodeStates.find((state) => state.ep === 19)?.currentStep).toBe('E2')
  })

  it('blocks batch package until every episode is delivered, then freezes one package', async () => {
    const { handleMock, store } = await loadMock()
    await call(handleMock, '/api/v1/projects/SP-26031/summary')
    const blocked = (await call(handleMock, '/api/v1/projects/SP-26031/batches/1/package', {
      receiver: '企业内容库',
    })) as { data: Record<string, unknown>; meta?: Record<string, unknown> }
    expect(blocked.data).toMatchObject({
      id: 'BP-26031-B1',
      status: '待补齐',
      episodes: 6,
      delivered: 0,
      missing: ['E01', 'E02', 'E03', 'E04', 'E05', 'E06'],
    })
    expect(blocked.meta).toMatchObject({ created: false, ready: false })
    expect(store.table('deliveries').some((row) => row.id === 'BP-26031-B1')).toBe(false)

    for (const state of store.table('episodeStates').filter((row) => row.project === 'SP-26031' && Number(row.ep) <= 6)) {
      Object.assign(state, { currentStep: 'E7', status: '已交付', delivered: true })
    }
    for (const episode of store.table('episodes').filter((row) => row.project === 'SP-26031' && Number(row.no) <= 6)) {
      episode.status = '已交付'
    }

    const result = (await call(handleMock, '/api/v1/projects/SP-26031/batches/1/package', {
      receiver: '企业内容库',
    })) as { data: Record<string, unknown>; meta?: Record<string, unknown> }
    expect(result.data).toMatchObject({
      id: 'BP-26031-B1',
      kind: '批次包',
      batch: 1,
      episodes: 6,
      files: 6,
      status: '已交付',
      receiver: '企业内容库',
      frozen: true,
    })
    expect(result.meta).toMatchObject({ created: true })

    const again = (await call(handleMock, '/api/v1/projects/SP-26031/batches/1/package', {
      receiver: '企业内容库',
    })) as { data: Record<string, unknown>; meta?: Record<string, unknown> }
    expect(again.data.id).toBe('BP-26031-B1')
    expect(again.meta).toMatchObject({ created: false })
    expect(store.table('deliveries').filter((row) => row.id === 'BP-26031-B1')).toHaveLength(1)
  })
})
