import type {RouteRecordRaw} from 'vue-router'
import DashboardPage from '../../views/dashboard/index.vue'
import ProjectsPage from '../../views/projects/index.vue'
export const workspaceRoutes:RouteRecordRaw[]=[{path:'/',name:'home',component:DashboardPage},{path:'/projects',name:'projects',component:ProjectsPage}]
