import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '../stores/session'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import ProjectsView from '../views/ProjectsView.vue'
import UsersView from '../views/UsersView.vue'
import RolesView from '../views/RolesView.vue'
import DepartmentsView from '../views/DepartmentsView.vue'
import ProductionView from '../views/ProductionView.vue'
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/', name: 'home', component: HomeView },
    { path: '/projects', name: 'projects', component: ProjectsView },
    { path: '/admin/users', name: 'users', component: UsersView },
    { path: '/admin/roles', name: 'roles', component: RolesView },
    { path: '/admin/departments', name: 'departments', component: DepartmentsView },
    { path: '/projects/:projectId/episodes', name: 'episodes', component: ProductionView, props: { module: 'episodes' } },
    { path: '/projects/:projectId/stories', name: 'stories', component: ProductionView, props: { module: 'stories' } },
    { path: '/projects/:projectId/assets', name: 'assets', component: ProductionView, props: { module: 'assets' } },
    { path: '/projects/:projectId/storyboards', name: 'storyboards', component: ProductionView, props: { module: 'storyboards' } },
    { path: '/projects/:projectId/tasks', name: 'tasks', component: ProductionView, props: { module: 'tasks' } },
    { path: '/projects/:projectId/reviews', name: 'reviews', component: ProductionView, props: { module: 'reviews' } },
    { path: '/projects/:projectId/editor', name: 'editor', component: ProductionView, props: { module: 'editor' } },
    { path: '/projects/:projectId/exports', name: 'exports', component: ProductionView, props: { module: 'exports' } },
  ],
})
router.beforeEach((to) => {
  const session = useSessionStore()
  if (import.meta.env.DEV && to.name === 'login') return { name: 'home' }
  if (to.meta.public) return session.isAuthenticated ? '/' : true
  if (import.meta.env.DEV) return true
  if (!session.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
  return true
})
export default router
