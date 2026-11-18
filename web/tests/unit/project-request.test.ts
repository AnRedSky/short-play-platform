import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProjectRequest } from '../../src/composables/useProjectRequest'
import { useProjectStore } from '../../src/stores/project'

describe('project-scoped request lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('does not apply an async response after switching projects', async () => {
    const store = useProjectStore()
    store.setCurrentProject('project-a')
    const scoped = useProjectRequest()
    const apply = vi.fn()
    let resolveRequest!: (value: string) => void
    let signal!: AbortSignal

    const pending = scoped.run(
      requestSignal => {
        signal = requestSignal
        return new Promise<string>(resolve => {
          resolveRequest = resolve
        })
      },
      apply,
    )

    store.setCurrentProject('project-b')
    resolveRequest('stale project A result')
    await pending

    expect(signal.aborted).toBe(true)
    expect(apply).not.toHaveBeenCalled()
  })

  it('applies a response while its project context is current', async () => {
    const store = useProjectStore()
    store.setCurrentProject('project-a')
    const scoped = useProjectRequest()
    const apply = vi.fn()

    await scoped.run(async () => 'project A result', apply)

    expect(apply).toHaveBeenCalledWith('project A result')
  })

  it('registers project-scoped event cleanup', () => {
    const store = useProjectStore()
    store.setCurrentProject('project-a')
    const scoped = useProjectRequest()
    const unsubscribe = vi.fn()

    scoped.registerCleanup(unsubscribe)
    store.setCurrentProject('project-b')

    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
