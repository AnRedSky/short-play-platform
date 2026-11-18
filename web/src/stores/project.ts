import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ProjectRequestContext {
  signal: AbortSignal
  isCurrent: () => boolean
  release: () => void
}

export const useProjectStore = defineStore('project', () => {
  const currentProjectId = ref<string | null>(null)
  const contextVersion = ref(0)
  const controllers = new Set<AbortController>()
  const cleanups = new Set<() => void>()

  function invalidateProjectContext() {
    contextVersion.value += 1
    for (const controller of controllers) controller.abort()
    controllers.clear()
    for (const cleanup of cleanups) {
      try {
        cleanup()
      } catch {
        // A failing subscriber must not prevent other project-scoped resources from clearing.
      }
    }
    cleanups.clear()
  }

  function setCurrentProject(projectId: string) {
    if (currentProjectId.value === projectId) return
    invalidateProjectContext()
    currentProjectId.value = projectId
  }

  function clearCurrentProject() {
    if (currentProjectId.value === null) return
    invalidateProjectContext()
    currentProjectId.value = null
  }

  function createRequestContext(): ProjectRequestContext {
    const version = contextVersion.value
    const controller = new AbortController()
    controllers.add(controller)
    return {
      signal: controller.signal,
      isCurrent: () => version === contextVersion.value && !controller.signal.aborted,
      release: () => controllers.delete(controller),
    }
  }

  function registerCleanup(cleanup: () => void) {
    cleanups.add(cleanup)
    return () => cleanups.delete(cleanup)
  }

  return {
    currentProjectId,
    contextVersion,
    setCurrentProject,
    clearCurrentProject,
    createRequestContext,
    registerCleanup,
  }
})
