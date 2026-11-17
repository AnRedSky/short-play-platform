import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import { configureApiTokenProvider } from './services/api'
import { useSessionStore } from './stores/session'
import App from './App.vue'
import './style.css'
const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
configureApiTokenProvider(() => useSessionStore(pinia).accessToken)
app.use(router).mount('#app')
