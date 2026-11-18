import { useProjectStore } from '../stores/project'

/**
 * Run a project-scoped request and apply its result only while the originating
 * project context is still active. Project switches abort the signal centrally.
 */
export function useProjectRequest() {
  const projectStore = useProjectStore()

  async function run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    apply: (result: T) => void,
  ): Promise<void> {
    const context = projectStore.createRequestContext()
    try {
      const result = await operation(context.signal)
      if (context.isCurrent()) apply(result)
    } catch (error) {
      if (context.isCurrent()) throw error
      // Ignore stale/aborted work after the project context has changed.
    } finally {
      context.release()
    }
  }

  function registerCleanup(cleanup: () => void) {
    return projectStore.registerCleanup(cleanup)
  }

  return { run, registerCleanup }
}
