import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { pluginCatalog } from '../../src/mock/plugins'
import { usePluginsStore } from '../../src/stores/plugins'

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

const LOCAL_KEY = 'sp_plugins_v1'
const fresh = () => {
  setActivePinia(createPinia())
  return usePluginsStore()
}

describe('插件市场状态', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  it('首次进入按目录默认值初始化', () => {
    const store = fresh()
    const expected = pluginCatalog.filter((item) => item.installedByDefault).length
    expect(store.installedCount).toBe(expected)
    expect(store.enabledCount).toBe(expected)
  })

  it('安装后计入已安装并写入本地存储', () => {
    const store = fresh()
    const target = pluginCatalog.find((item) => !item.installedByDefault)!
    expect(store.install(target.id)).toBe(true)
    expect(store.installedCount).toBe(pluginCatalog.filter((item) => item.installedByDefault).length + 1)
    expect(store.stateOf(target.id)?.installedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    expect(localStorage.getItem(LOCAL_KEY)).toContain(target.id)
  })

  it('卸载会清空启用状态与安装时间', () => {
    const store = fresh()
    const target = pluginCatalog.find((item) => item.installedByDefault)!
    expect(store.uninstall(target.id)).toBe(true)
    const state = store.stateOf(target.id)!
    expect(state.installed).toBe(false)
    expect(state.enabled).toBe(false)
    expect(state.installedAt).toBe('')
  })

  it('配置并发被夹在 1–8，备注与启停持久化', () => {
    const store = fresh()
    const target = pluginCatalog.find((item) => item.installedByDefault)!
    store.saveConfig(target.id, { enabled: false, concurrency: 99, note: '小流量试跑' })
    const state = store.stateOf(target.id)!
    expect(state.enabled).toBe(false)
    expect(state.concurrency).toBe(8)
    expect(state.note).toBe('小流量试跑')

    store.saveConfig(target.id, { concurrency: 0 })
    expect(store.stateOf(target.id)?.concurrency).toBe(1)
  })

  it('刷新后从本地存储恢复安装与配置', () => {
    const first = fresh()
    const target = pluginCatalog.find((item) => !item.installedByDefault)!
    first.install(target.id)
    first.saveConfig(target.id, { concurrency: 3, note: '对接投放组' })

    const second = fresh()
    expect(second.stateOf(target.id)?.installed).toBe(true)
    expect(second.stateOf(target.id)?.concurrency).toBe(3)
    expect(second.stateOf(target.id)?.note).toBe('对接投放组')
  })

  it('脏数据回退到默认值，不让页面打不开', () => {
    localStorage.setItem(LOCAL_KEY, '{oops')
    const store = fresh()
    expect(store.installedCount).toBe(pluginCatalog.filter((item) => item.installedByDefault).length)
  })

  it('恢复默认清空自定义安装', () => {
    const store = fresh()
    const target = pluginCatalog.find((item) => !item.installedByDefault)!
    store.install(target.id)
    store.reset()
    expect(store.stateOf(target.id)?.installed).toBe(false)
  })
})
