import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useProjectStore = defineStore('project', () => {
  const currentProjectId = ref<string | null>(null)

  function setCurrentProject(projectId: string) {
    currentProjectId.value = projectId
  }

  function clearCurrentProject() {
    currentProjectId.value = null
  }

  return { currentProjectId, setCurrentProject, clearCurrentProject }
})
