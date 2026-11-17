import { createApp } from 'vue'
import router from './router'
import pinia from './stores'
import { configureApiMock, configureApiTokenProvider } from './api'
import { demoApiHandler } from './services/demo'
import { useSessionStore } from './stores/session'
import App from './App.vue'
import './styles/global.css'
const app=createApp(App)
app.use(pinia)
configureApiTokenProvider(()=>useSessionStore(pinia).accessToken)
if(import.meta.env.DEV){configureApiMock(demoApiHandler);useSessionStore(pinia).enterPreview({id:'preview-user',email:'preview@shortplay.local',full_name:'产品预览用户',is_active:true},['projects:read','projects:write','users:read','users:write','roles:read','organizations:read','organizations:write'])}
app.use(router).mount('#app')
