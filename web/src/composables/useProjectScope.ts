import { computed, watch } from 'vue'
import { useProjectStore } from '../stores/project'

/** 项目范围统一入口：页面只读 projectId/projectName，并在项目切换时统一重载。 */
export function useProjectScope(onChange?: () => void) {
  const project = useProjectStore()
  const projectId = computed(() => project.currentId)
  const projectName = computed(() => project.current?.name ?? '')
  if (onChange) watch(() => project.currentId, onChange)
  return { project, projectId, projectName }
}
