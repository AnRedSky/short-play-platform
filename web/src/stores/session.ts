import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { http } from '../api/client'
import { ApiError } from '../api'

interface Identity {
  id: string
  role: string
  userId: string
  name: string
  dept: string
  avatar?: string
  platform?: boolean
}

interface MeResponse {
  identity: Identity
  identity_id: string
  permissions: string[]
  user?: { id: string; full_name: string; email: string }
}

export const useSessionStore = defineStore('session', () => {
  const identity = ref<Identity | null>(null)
  const permissions = ref<string[]>([])
  const identities = ref<Identity[]>([])
  const loading = ref(false)
  const ready = ref(false)

  const name = computed(() => identity.value?.name ?? '未登录')
  const shortName = computed(() => name.value.split(' · ')[0])
  const roleName = computed(() => {
    const map: Record<string, string> = {
      ops: '系统运维', admin: '企业管理员', dept: '部门负责人', owner: '项目负责人', staff: '制作员工', auditor: '审计经营',
    }
    return identity.value ? map[identity.value.role] ?? identity.value.role : '—'
  })

  function can(permission?: string | null): boolean {
    if (!permission) return true
    return permissions.value.includes(permission)
  }

  async function login(identityId?: string) {
    loading.value = true
    try {
      const stored = localStorage.getItem('sp_studio_identity') || 'i-owner'
      const me = await http.post<MeResponse>('/auth/login', { identity_id: identityId || stored })
      apply(me)
      localStorage.setItem('sp_studio_identity', me.identity_id || me.identity?.id || 'i-owner')
    } finally {
      loading.value = false
    }
  }

  function apply(me: MeResponse) {
    identity.value = me.identity
    permissions.value = me.permissions ?? []
    ready.value = true
  }

  async function refresh() {
    const me = await http.get<MeResponse>('/auth/me')
    apply(me)
  }

  async function loadIdentities() {
    const result = await http.list<Identity>('/identities')
    identities.value = result.rows
  }

  async function switchIdentity(identityId: string) {
    const me = await http.post<MeResponse>('/mock/identity', { identity_id: identityId })
    apply(me)
    localStorage.setItem('sp_studio_identity', identityId)
  }

  function isForbidden(error: unknown): boolean {
    return error instanceof ApiError && error.status === 403
  }

  return { identity, permissions, identities, loading, ready, name, shortName, roleName, can, login, refresh, loadIdentities, switchIdentity, isForbidden }
})
