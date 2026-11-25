/**
 * Mock 数据层：以原型 9.7.8 的种子数据为唯一来源，模拟真实数据库。
 * 所有读写都经过 mock server，页面不直接触碰这里，保证后续替换为真实 API 时零改动。
 */
import seedJson from './seed.json'

export type Row = Record<string, any>
export type Rows = Record<string, Row[]>

const STORAGE_KEY = 'sp_studio_mock_v3'

type Persisted = { entities: Rows; identityId: string; rev: number }

const seed = seedJson as unknown as {
  entities: Rows
  dicts: Record<string, any>
  meta: Record<string, any>
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function initialState(): Persisted {
  return { entities: clone(seed.entities), identityId: 'i-owner', rev: 0 }
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState()
    const parsed = JSON.parse(raw) as Persisted
    // 种子新增的集合要补齐，避免旧缓存缺少新实体
    for (const key of Object.keys(seed.entities)) {
      if (!parsed.entities[key]) parsed.entities[key] = clone(seed.entities[key])
    }
    return parsed
  } catch {
    return initialState()
  }
}

const state: Persisted = load()

export const store = {
  get entities(): Rows {
    return state.entities
  },
  get dicts() {
    return seed.dicts
  },
  get meta() {
    return seed.meta
  },
  get identityId(): string {
    return state.identityId
  },
  set identityId(value: string) {
    state.identityId = value
    this.persist()
  },
  table(name: string): Row[] {
    if (!state.entities[name]) state.entities[name] = []
    return state.entities[name]
  },
  persist() {
    state.rev += 1
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // 配额超限时降级为内存态，不阻断业务操作
    }
  },
  reset() {
    state.entities = clone(seed.entities)
    state.identityId = 'i-owner'
    this.persist()
  },
  clone,
}

export function nextId(prefix: string, table: string, width = 4): string {
  const rows = store.table(table)
  const max = rows.reduce((acc, row) => {
    const digits = String(row.id ?? '').replace(/\D/g, '')
    return digits ? Math.max(acc, Number(digits.slice(-width))) : acc
  }, 0)
  return `${prefix}-${String(max + 1).padStart(width, '0')}`
}

export function now(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function today(): string {
  return now().slice(0, 10)
}
