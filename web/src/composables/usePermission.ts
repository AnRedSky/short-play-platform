import { useSessionStore } from '../stores/session'

/** 权限判断统一入口：页面只问 can/canAny，不再各自拼 identity.permissions。 */
export function usePermission(): { can: (permission?: string | null) => boolean; canAny: (permissions: string[]) => boolean } {
  const session = useSessionStore()
  const can = (permission?: string | null) => session.can(permission)
  const canAny = (permissions: string[]) => permissions.some((item) => session.can(item))
  return { can, canAny }
}
