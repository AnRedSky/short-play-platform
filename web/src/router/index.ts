import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useSessionStore } from '../stores/session'
import routeMeta from '../mock/routes.json'

/**
 * 页面按需加载：56 条路由与原型 routes.json 一一对应。
 * 约定：每个业务页是独立目录，主入口统一为 views/<domain>/<page>/index.vue；
 * 规格驱动的页面共用 views/SpecPage.vue。
 */
const pages = import.meta.glob('../views/**/*.vue')

function view(path: string) {
  const loader = pages[`../views/${path}/index.vue`] ?? pages[`../views/${path}.vue`]
  if (!loader) throw new Error(`缺少页面组件：${path}`)
  return loader as () => Promise<unknown>
}

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/workspace/home' },
  { path: '/no-access', name: 'no-access', component: view('no-access') },

  { path: '/workspace/home', name: 'workspace-home', component: view('workspace/home') },
  { path: '/workspace/assistant', name: 'workspace-assistant', component: view('workspace/assistant') },
  { path: '/notify/inbox', name: 'notify-inbox', component: view('SpecPage') },

  { path: '/projects/list', name: 'projects-list', component: view('projects/list') },
  { path: '/projects/workflow', name: 'projects-workflow', component: view('projects/workflow') },
  { path: '/projects/new', name: 'projects-new', component: view('projects/new') },
  { path: '/projects/detail', name: 'projects-detail', component: view('projects/detail') },
  { path: '/projects/lifecycle', name: 'projects-lifecycle', component: view('projects/lifecycle') },

  { path: '/creation/brief', name: 'creation-brief', component: view('creation/brief') },
  { path: '/creation/plan', name: 'creation-plan', component: view('SpecPage') },
  { path: '/creation/script', name: 'creation-script', component: view('creation/script') },
  { path: '/creation/review', name: 'creation-review', component: view('creation/review') },
  { path: '/creation/breakdown', name: 'creation-breakdown', component: view('SpecPage') },

  { path: '/director/plan', name: 'director-plan', component: view('SpecPage') },
  { path: '/director/cast', name: 'director-cast', component: view('SpecPage') },
  { path: '/director/world', name: 'director-world', component: view('SpecPage') },
  { path: '/director/shots', name: 'director-shots', component: view('director/shots') },

  { path: '/video/production', name: 'video-production', component: view('video/production') },
  { path: '/video/preview', name: 'video-preview', component: view('SpecPage') },

  { path: '/audio/dialogue', name: 'audio-dialogue', component: view('SpecPage') },
  { path: '/audio/voice', name: 'audio-voice', component: view('SpecPage') },
  { path: '/audio/bgm', name: 'audio-bgm', component: view('SpecPage') },
  { path: '/audio/subtitle', name: 'audio-subtitle', component: view('SpecPage') },

  { path: '/post/timeline', name: 'post-timeline', component: view('post/timeline') },
  { path: '/post/episodes', name: 'post-episodes', component: view('post/episodes') },
  { path: '/post/review', name: 'post-review', component: view('post/review') },
  { path: '/post/delivery', name: 'post-delivery', component: view('post/delivery') },
  { path: '/post/versions', name: 'post-versions', component: view('SpecPage') },

  { path: '/quality/reports', name: 'quality-reports', component: view('quality/reports') },
  { path: '/quality/rework', name: 'quality-rework', component: view('SpecPage') },

  { path: '/tasks/list', name: 'tasks-list', component: view('SpecPage') },
  { path: '/tasks/queue', name: 'tasks-queue', component: view('SpecPage') },
  { path: '/tasks/attempt', name: 'tasks-attempt', component: view('SpecPage') },

  { path: '/assets/library', name: 'assets-library', component: view('assets/library') },

  { path: '/models/config', name: 'models-config', component: view('SpecPage') },
  { path: '/models/providers', name: 'models-providers', component: view('SpecPage') },
  { path: '/models/routing', name: 'models-routing', component: view('SpecPage') },

  { path: '/cost/ledger', name: 'cost-ledger', component: view('SpecPage') },
  { path: '/cost/budget', name: 'cost-budget', component: view('SpecPage') },

  { path: '/analytics/enterprise', name: 'analytics-enterprise', component: view('analytics') },
  { path: '/analytics/me', name: 'analytics-me', component: view('analytics') },

  { path: '/compliance/rights', name: 'compliance-rights', component: view('SpecPage') },
  { path: '/compliance/risks', name: 'compliance-risks', component: view('SpecPage') },
  { path: '/compliance/audit', name: 'compliance-audit', component: view('SpecPage') },

  { path: '/ops/overview', name: 'ops-overview', component: view('ops/overview') },
  { path: '/ops/capabilities', name: 'ops-capabilities', component: view('SpecPage') },
  { path: '/ops/queue', name: 'ops-queue', component: view('SpecPage') },
  { path: '/ops/logs', name: 'ops-logs', component: view('SpecPage') },
  { path: '/ops/config', name: 'ops-config', component: view('ops/config') },

  { path: '/orgs/enterprise', name: 'orgs-enterprise', component: view('orgs/enterprise') },
  { path: '/orgs/departments', name: 'orgs-departments', component: view('SpecPage') },
  { path: '/orgs/members', name: 'orgs-members', component: view('SpecPage') },
  { path: '/orgs/member', name: 'orgs-member', component: view('SpecPage') },
  { path: '/orgs/roles', name: 'orgs-roles', component: view('SpecPage') },
  { path: '/orgs/grants', name: 'orgs-grants', component: view('SpecPage') },
  { path: '/orgs/handover', name: 'orgs-handover', component: view('SpecPage') },

  { path: '/:pathMatch(.*)*', name: 'not-found', component: view('not-found') },
]

/** 把原型 routes.json 里的权限要求挂到对应路由：页面可见性与菜单锁标记使用同一份权限口径。 */
const permissionByPath = new Map<string, string | string[]>(
  (routeMeta as Array<{ path: string; permission?: string | string[] }>).map((item) => [`/${item.path}`, item.permission ?? '']),
)
for (const record of routes) {
  const permission = permissionByPath.get(record.path)
  if (permission) record.meta = { ...(record.meta || {}), permission }
}

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const session = useSessionStore()
  if (!session.ready) {
    try {
      await session.login()
    } catch {
      return true
    }
  }
  if (to.name === 'no-access') return true
  const permission = to.meta.permission
  if (!permission) return true
  const list = Array.isArray(permission) ? permission : [permission]
  if (list.some((item) => session.can(item))) return true
  return { name: 'no-access', query: { from: to.fullPath, need: list[0] } }
})

export default router
