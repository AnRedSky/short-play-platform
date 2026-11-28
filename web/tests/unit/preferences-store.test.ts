import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { usePreferencesStore } from '../../src/stores/preferences'

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

const NAV_KEY = 'sp_pref_nav_collapsed'
const MOTION_KEY = 'sp_pref_reduce_motion'

const fresh = () => {
  setActivePinia(createPinia())
  return usePreferencesStore()
}

describe('界面偏好', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  it('默认展开导航、保留动效', () => {
    const prefs = fresh()
    expect(prefs.navCollapsed).toBe(false)
    expect(prefs.reduceMotion).toBe(false)
  })

  it('折叠开关立即生效并写入本地存储', async () => {
    const prefs = fresh()
    prefs.toggleNav()
    expect(prefs.navCollapsed).toBe(true)
    await nextTick()
    expect(localStorage.getItem(NAV_KEY)).toBe('1')
  })

  it('刷新后恢复折叠与降动效偏好', () => {
    localStorage.setItem(NAV_KEY, '1')
    localStorage.setItem(MOTION_KEY, '1')
    const prefs = fresh()
    expect(prefs.navCollapsed).toBe(true)
    expect(prefs.reduceMotion).toBe(true)
  })

  it('恢复默认会同时清掉两个开关', async () => {
    const prefs = fresh()
    prefs.toggleNav()
    prefs.setReduceMotion(true)
    await nextTick()
    expect(localStorage.getItem(NAV_KEY)).toBe('1')
    expect(localStorage.getItem(MOTION_KEY)).toBe('1')

    prefs.reset()
    await nextTick()
    expect(prefs.navCollapsed).toBe(false)
    expect(prefs.reduceMotion).toBe(false)
    expect(localStorage.getItem(NAV_KEY)).toBe('0')
    expect(localStorage.getItem(MOTION_KEY)).toBe('0')
  })
})
