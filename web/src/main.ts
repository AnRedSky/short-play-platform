import { createApp } from 'vue'
import router from './router'
import pinia from './stores'
import { configureApiMock, configureApiTokenProvider } from './api'
import { demoApiHandler } from './api/mock'
import { useAuthStore } from './stores/auth'
import App from './App.vue'
import './styles/global.css'
const app=createApp(App)
app.use(pinia)
configureApiTokenProvider(()=>useAuthStore(pinia).accessToken)
if(import.meta.env.DEV){configureApiMock(demoApiHandler);useAuthStore(pinia).enterPreview({id:'preview-user',email:'preview@shortplay.local',full_name:'产品预览用户',is_active:true},['projects:read','projects:write','users:read','users:write','roles:read','organizations:read','organizations:write'])}
app.use(router).mount('#app')
