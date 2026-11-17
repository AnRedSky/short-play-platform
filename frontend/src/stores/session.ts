import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSessionStore = defineStore('session', () => {
  const accessToken = ref<string | null>(null)
  const isAuthenticated = ref(false)
  function clearSession() {
    accessToken.value = null
    isAuthenticated.value = false
  }
  return { accessToken, isAuthenticated, clearSession }
})
