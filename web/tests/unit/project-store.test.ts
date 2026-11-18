import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProjectStore } from '../../src/stores/project'

describe('project context store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts without an active project', () => {
    const store = useProjectStore()
    expect(store.currentProjectId).toBeNull()
  })

  it('sets and clears the active project context', () => {
    const store = useProjectStore()
    store.setCurrentProject('project-123')
    expect(store.currentProjectId).toBe('project-123')

    store.clearCurrentProject()
    expect(store.currentProjectId).toBeNull()
  })
})
