import { createApp } from 'vue'
import router from './router'
import pinia from './stores'
import { configureApiTokenProvider } from './api'
import { useAuthStore } from './stores/auth'
import App from './App.vue'
import './styles/global.css'
const app=createApp(App)
app.use(pinia)
configureApiTokenProvider(()=>useAuthStore(pinia).accessToken)
app.use(router).mount('#app')
