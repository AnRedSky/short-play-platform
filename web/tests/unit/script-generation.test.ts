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

const MODEL = '剧本模型 A · 长篇结构'

describe('script creation contract', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('localStorage', memoryStorage())
  })

  it('generates a pilot draft from the confirmed creative baseline', async () => {
    const { handleMock } = await loadMock()
    const result = (await call(handleMock, '/api/v1/scripts/generate', {
      project: 'SP-26011',
      model: MODEL,
      scope: 'pilot',
      count: 3,
      strength: '标准改编',
      prompt: '写一个关于高三夏天的成长故事，每集结尾留钩子。',
    })) as {
      data: {
        version: string
        status: string
        writtenEpisodes: number
        scenes: number
        lines: number
        episodeDrafts: Array<Record<string, unknown>>
        generation: Record<string, unknown>
      }
    }
    expect(result.data.version).toBe('v2')
    expect(result.data.status).toBe('草稿')
    expect(result.data.writtenEpisodes).toBe(3)
    expect(result.data.scenes).toBe(9)
    expect(result.data.lines).toBe(18)
    expect(result.data.episodeDrafts).toHaveLength(3)
    expect(result.data.episodeDrafts[0]).toMatchObject({
      no: 1,
      title: '开学第一天',
    })
    expect(result.data.episodeDrafts[0].scenes).toHaveLength(3)
    expect(result.data.generation).toMatchObject({
      model: MODEL,
      scope: 'pilot',
      count: 3,
    })
  })

  it('fills the whole series while preserving manual edits', async () => {
    const { handleMock, store } = await loadMock()
    const pilot = (await call(handleMock, '/api/v1/scripts/generate', {
      project: 'SP-26011',
      model: MODEL,
      scope: 'pilot',
      prompt: '先出前三集样章。',
    })) as { data: Record<string, unknown> }
    const script = store.table('scripts').find((row) => row.id === pilot.data.id)!
    const drafts = script.episodeDrafts as Array<Record<string, unknown>>
    drafts[0].title = '人工改过的第一集'
    drafts[0].edited = true

    const full = (await call(handleMock, '/api/v1/scripts/generate', {
      project: 'SP-26011',
      scriptId: script.id,
      model: MODEL,
      scope: 'full',
      prompt: '补齐全剧，保留人工修订。',
    })) as {
      data: { writtenEpisodes: number; episodeDrafts: Array<Record<string, unknown>> }
    }
    expect(full.data.writtenEpisodes).toBe(16)
    expect(full.data.episodeDrafts).toHaveLength(16)
    expect(full.data.episodeDrafts[0].title).toBe('人工改过的第一集')
    expect(full.data.episodeDrafts[1].title).not.toBe('人工改过的第一集')
  })

  it('blocks incomplete script submission and opens review when complete', async () => {
    const { handleMock } = await loadMock()
    await call(handleMock, '/api/v1/scripts/generate', {
      project: 'SP-26011',
      model: MODEL,
      scope: 'pilot',
      prompt: '只出前三集。',
    })
    await expect(call(handleMock, '/api/v1/projects/SP-26011/transitions', {
      action: 'submitScript',
    })).rejects.toMatchObject({ status: 422, code: 'script_incomplete' })

    const script = await call(handleMock, '/api/v1/scripts/generate', {
      project: 'SP-26011',
      model: MODEL,
      scope: 'full',
      prompt: '补齐全剧。',
    }) as { data: Record<string, unknown> }

    const submitted = (await call(handleMock, '/api/v1/projects/SP-26011/transitions', {
      action: 'submitScript',
    })) as { data: { project: Record<string, unknown> } }
    expect(submitted.data.project.status).toBe('待剧本审核')
    expect(submitted.data.project.phase).toBe('剧本创作')

    const summary = (await call(handleMock, '/api/v1/projects/SP-26011/summary')) as {
      data: { scripts: Array<Record<string, unknown>> }
    }
    expect(summary.data.scripts.find((row) => row.id === script.data.id)?.status).toBe('待审核')
  })
})
