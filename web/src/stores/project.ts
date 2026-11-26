import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Row } from '../mock/db'
import { projectApi } from '../services/projects'

const STORAGE_KEY = 'sp_studio_project'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Row[]>([])
  const currentId = ref<string>(localStorage.getItem(STORAGE_KEY) ?? 'SP-26031')
  const loading = ref(false)

  const current = computed(() => projects.value.find((row) => row.id === currentId.value) ?? projects.value[0])
  const options = computed(() => projects.value.map((row) => ({ value: String(row.id), label: `${row.name} · ${row.status}` })))

  async function load() {
    loading.value = true
    try {
      const result = await projectApi.list({ limit: 100 })
      projects.value = result.rows
      if (!projects.value.some((row) => row.id === currentId.value) && projects.value[0]) {
        select(String(projects.value[0].id))
      }
    } finally {
      loading.value = false
    }
  }

  function select(id: string) {
    currentId.value = id
    localStorage.setItem(STORAGE_KEY, id)
  }

  return { projects, currentId, current, options, loading, load, select }
})
