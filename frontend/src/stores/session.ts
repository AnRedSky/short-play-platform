import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '../services/resources'
export const useSessionStore = defineStore('session', () => {
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const user = ref<User | null>(null)
  const permissions = ref<string[]>([])
  const isAuthenticated = ref(false)
  function establishSession(access: string, refresh: string, currentUser: User) {
    accessToken.value = access; refreshToken.value = refresh; user.value = currentUser; isAuthenticated.value = true
  }
  function setPermissions(values: string[]) { permissions.value = values }
  function clearSession() {
    accessToken.value = null; refreshToken.value = null; user.value = null
    permissions.value = []; isAuthenticated.value = false
  }
  return { accessToken, refreshToken, user, permissions, isAuthenticated, establishSession, setPermissions, clearSession }
})
