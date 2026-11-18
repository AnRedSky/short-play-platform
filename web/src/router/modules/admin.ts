import type {RouteRecordRaw} from 'vue-router'
import UsersPage from '../../views/users/index.vue'
import RolesPage from '../../views/roles/index.vue'
import OrganizationsPage from '../../views/organizations/index.vue'
export const adminRoutes:RouteRecordRaw[]=[{path:'/admin/users',name:'users',component:UsersPage},{path:'/admin/roles',name:'roles',component:RolesPage},{path:'/admin/departments',name:'departments',component:OrganizationsPage}]
