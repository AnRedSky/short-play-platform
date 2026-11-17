import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import { configureApiMock, configureApiTokenProvider } from './services/api'
import { demoApiHandler } from './services/demo'
import { useSessionStore } from './stores/session'
import App from './App.vue'
import './style.css'
const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
configureApiTokenProvider(() => useSessionStore(pinia).accessToken)
// Demo API is enabled only by Vite's development server. Production always uses real HTTP APIs.
if (import.meta.env.DEV) {
  configureApiMock(demoApiHandler)
  useSessionStore(pinia).enterPreview(
    { id: 'preview-user', email: 'preview@shortplay.local', full_name: '产品预览用户', is_active: true },
    ['projects:read', 'projects:write', 'users:read', 'users:write', 'roles:read', 'organizations:read', 'organizations:write'],
  )
}
app.use(router).mount('#app')
