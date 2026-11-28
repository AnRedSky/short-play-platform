import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { pluginCatalog, type PluginCatalogItem } from '../mock/plugins'

export interface PluginConfig {
  enabled: boolean
  concurrency: number
  note: string
}

export interface PluginState extends PluginConfig {
  id: string
  installed: boolean
  installedAt: string
}

const STORAGE_KEY = 'sp_plugins_v1'
const MAX_CONCURRENCY = 8

function defaults(): PluginState[] {
  return pluginCatalog.map((item) => ({
    id: item.id,
    installed: item.installedByDefault,
    installedAt: item.installedByDefault ? '2026-11-18 09:20' : '',
    enabled: item.installedByDefault,
    concurrency: 2,
    note: '',
  }))
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 2
  return Math.min(MAX_CONCURRENCY, Math.max(1, Math.round(value)))
}

/** 读盘失败（隐私模式 / 脏数据）一律回到默认值，避免整页打不开。 */
function hydrate(): PluginState[] {
  const base = defaults()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as PluginState[]
    if (!Array.isArray(saved)) return base
    return base.map((item) => {
      const hit = saved.find((row) => row?.id === item.id)
      if (!hit) return item
      return {
        ...item,
        installed: Boolean(hit.installed),
        installedAt: typeof hit.installedAt === 'string' ? hit.installedAt : item.installedAt,
        enabled: Boolean(hit.installed) && Boolean(hit.enabled),
        concurrency: clamp(Number(hit.concurrency)),
        note: typeof hit.note === 'string' ? hit.note : '',
      }
    })
  } catch {
    return base
  }
}

function persist(rows: PluginState[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch {
    /* 写入失败不阻塞交互 */
  }
}

function now(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const usePluginsStore = defineStore('plugins', () => {
  const states = ref<PluginState[]>(hydrate())

  const catalog = computed<PluginCatalogItem[]>(() => pluginCatalog)

  const entries = computed(() => catalog.value.map((item) => ({ ...item, state: stateOf(item.id)! })))
  const installed = computed(() => entries.value.filter((item) => item.state.installed))
  const installedCount = computed(() => installed.value.length)
  const enabledCount = computed(() => entries.value.filter((item) => item.state.installed && item.state.enabled).length)

  function stateOf(id: string) {
    return states.value.find((row) => row.id === id)
  }

  function commit() {
    persist(states.value)
  }

  function install(id: string) {
    const state = stateOf(id)
    if (!state || state.installed) return false
    state.installed = true
    state.installedAt = now()
    state.enabled = true
    commit()
    return true
  }

  function uninstall(id: string) {
    const state = stateOf(id)
    if (!state || !state.installed) return false
    state.installed = false
    state.installedAt = ''
    state.enabled = false
    commit()
    return true
  }

  function setEnabled(id: string, enabled: boolean) {
    const state = stateOf(id)
    if (!state || !state.installed) return false
    state.enabled = enabled
    commit()
    return true
  }

  function saveConfig(id: string, patch: Partial<PluginConfig>) {
    const state = stateOf(id)
    if (!state || !state.installed) return false
    if (typeof patch.enabled === 'boolean') state.enabled = patch.enabled
    if (patch.concurrency !== undefined) state.concurrency = clamp(patch.concurrency)
    if (typeof patch.note === 'string') state.note = patch.note
    commit()
    return true
  }

  function reset() {
    states.value = defaults()
    commit()
  }

  return {
    catalog,
    entries,
    installed,
    installedCount,
    enabledCount,
    stateOf,
    install,
    uninstall,
    setEnabled,
    saveConfig,
    reset,
  }
})
