import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProjectStore } from '../../src/stores/project'

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

describe('project context store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    setActivePinia(createPinia())
  })

  it('starts from the default project when storage is empty', () => {
    const store = useProjectStore()
    expect(store.currentId).toBe('SP-26031')
  })

  it('selects a project and persists the choice', () => {
    const store = useProjectStore()
    store.select('SP-26028')
    expect(store.currentId).toBe('SP-26028')
    expect(localStorage.getItem('sp_studio_project')).toBe('SP-26028')
  })

  it('restores the persisted project on the next store instance', () => {
    localStorage.setItem('sp_studio_project', 'SP-26019')
    setActivePinia(createPinia())
    expect(useProjectStore().currentId).toBe('SP-26019')
  })
})
