import { getCurrentScope, onScopeDispose } from 'vue'
import { useProjectStore, type ProjectRequestContext } from '../stores/project'

/**
 * Run a project-scoped request and apply its result only while the originating
 * project context is still active. Project switches and component disposal abort work.
 */
export function useProjectRequest() {
  const projectStore = useProjectStore()
  const activeRequests = new Set<ProjectRequestContext>()
  const localCleanups = new Set<() => void>()

  if (getCurrentScope()) {
    onScopeDispose(() => {
      for (const request of activeRequests) request.abort()
      for (const cleanup of [...localCleanups]) cleanup()
    })
  }

  async function run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    apply: (result: T) => void,
  ): Promise<void> {
    const context = projectStore.createRequestContext()
    activeRequests.add(context)
    try {
      const result = await operation(context.signal)
      if (context.isCurrent()) apply(result)
    } catch (error) {
      if (context.isCurrent()) throw error
      // Ignore stale/aborted work after the project context has changed.
    } finally {
      activeRequests.delete(context)
      context.release()
    }
  }

  function registerCleanup(cleanup: () => void) {
    let active = true
    const dispose = () => {
      if (!active) return
      active = false
      localCleanups.delete(dispose)
      unregisterProjectCleanup()
      cleanup()
    }
    const unregisterProjectCleanup = projectStore.registerCleanup(dispose)
    localCleanups.add(dispose)
    return dispose
  }

  return { run, registerCleanup }
}
