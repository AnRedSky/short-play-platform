import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoginView from '../views/auth/index.vue'
import { adminRoutes } from './modules/admin'
import { productionRoutes } from './modules/production'
import { workspaceRoutes } from './modules/workspace'
const router=createRouter({history:createWebHistory(),routes:[{path:'/login',name:'login',component:LoginView,meta:{public:true}},...workspaceRoutes,...adminRoutes,...productionRoutes]})
router.beforeEach(to=>{const session=useAuthStore();if(import.meta.env.DEV&&to.name==='login')return{name:'home'};if(to.meta.public)return session.isAuthenticated?'/':true;if(import.meta.env.DEV)return true;if(!session.isAuthenticated)return{name:'login',query:{redirect:to.fullPath}};return true})
export default router
