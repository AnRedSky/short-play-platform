import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '../stores/session'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import ProjectsView from '../views/ProjectsView.vue'
import UsersView from '../views/UsersView.vue'
import RolesView from '../views/RolesView.vue'
import DepartmentsView from '../views/DepartmentsView.vue'
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/', name: 'home', component: HomeView },
    { path: '/projects', name: 'projects', component: ProjectsView },
    { path: '/admin/users', name: 'users', component: UsersView },
    { path: '/admin/roles', name: 'roles', component: RolesView },
    { path: '/admin/departments', name: 'departments', component: DepartmentsView },
  ],
})
router.beforeEach((to) => {
  const session = useSessionStore()
  if (to.meta.public) return session.isAuthenticated ? '/' : true
  if (!session.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
  return true
})
export default router
