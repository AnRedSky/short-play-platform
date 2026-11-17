import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import { useSessionStore } from './stores/session'
import App from './App.vue'
import './style.css'
const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
// UI preview is deliberately restricted to Vite development mode; production always uses real authentication.
if (import.meta.env.DEV) {
  useSessionStore(pinia).enterPreview(
    { id: 'preview-user', email: 'preview@shortplay.local', full_name: '产品预览用户', is_active: true },
    ['projects:read', 'projects:write', 'users:read', 'users:write', 'roles:read', 'organizations:read', 'generation:read'],
  )
}
app.use(router).mount('#app')
