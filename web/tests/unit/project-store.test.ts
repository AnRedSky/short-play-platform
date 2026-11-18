import { beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('aborts in-flight requests and invalidates stale responses on project switch', () => {
    const store = useProjectStore()
    store.setCurrentProject('project-a')
    const request = store.createRequestContext()
    const previousVersion = store.contextVersion

    store.setCurrentProject('project-b')

    expect(request.signal.aborted).toBe(true)
    expect(request.isCurrent()).toBe(false)
    expect(store.contextVersion).toBe(previousVersion + 1)
    request.release()
  })

  it('runs and clears registered project-scoped subscriptions on switch', () => {
    const store = useProjectStore()
    const unsubscribe = vi.fn()
    store.setCurrentProject('project-a')
    store.registerCleanup(unsubscribe)

    store.setCurrentProject('project-b')

    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('does not invalidate requests when the same project is selected again', () => {
    const store = useProjectStore()
    store.setCurrentProject('project-a')
    const request = store.createRequestContext()

    store.setCurrentProject('project-a')

    expect(request.signal.aborted).toBe(false)
    expect(request.isCurrent()).toBe(true)
  })
})
