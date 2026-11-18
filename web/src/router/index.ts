import { createRouter, createWebHistory } from 'vue-router'
import { ApiError } from '../api'
import { projectsApi } from '../api/projects'
import { useAuthStore } from '../stores/auth'
import LoginView from '../views/auth/index.vue'
import ProjectAccessErrorView from '../views/errors/ProjectAccessErrorView.vue'
import { adminRoutes } from './modules/admin'
import { productionRoutes } from './modules/production'
import { workspaceRoutes } from './modules/workspace'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    {
      path: '/access-error',
      name: 'access-error',
      component: ProjectAccessErrorView,
      meta: { public: true },
    },
    ...workspaceRoutes,
    ...adminRoutes,
    ...productionRoutes,
  ],
})

let pendingProjectAccess: AbortController | null = null

router.beforeEach(async (to) => {
  const session = useAuthStore()

  // A newer navigation invalidates any in-flight authorization check for the
  // previous destination. The API response must never authorize a later route.
  pendingProjectAccess?.abort()
  pendingProjectAccess = null

  if (import.meta.env.DEV && to.name === 'login') return { name: 'home' }
  if (to.meta.public) return session.isAuthenticated ? { name: 'home' } : true
  if (import.meta.env.DEV) return true

  if (!session.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  const projectId = to.params.projectId
  if (typeof projectId !== 'string' || projectId.length === 0) return true

  const controller = new AbortController()
  pendingProjectAccess = controller
  try {
    await projectsApi.read(projectId, { signal: controller.signal })
    if (controller.signal.aborted) return false
    return true
  } catch (error) {
    if (controller.signal.aborted) return false
    if (error instanceof ApiError && error.status === 401) {
      session.clearSession()
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    if (error instanceof ApiError && error.status === 403) {
      return { name: 'access-error', query: { reason: 'forbidden', projectId } }
    }
    if (error instanceof ApiError && error.status === 404) {
      return { name: 'access-error', query: { reason: 'not-found', projectId } }
    }
    return { name: 'access-error', query: { reason: 'unavailable', projectId } }
  } finally {
    if (pendingProjectAccess === controller) pendingProjectAccess = null
  }
})

export default router
