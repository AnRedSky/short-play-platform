import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import { configureApiTokenProvider, configureApiMock } from './api'
import { ApiError } from './api'
import { handleMock, MockHttpError } from './mock/server'
import { useAuthStore } from './stores/auth'
import './styles/studio/base.css'
import './styles/studio/components.css'
import './styles/studio/studio.css'
import './styles/app.css'

/**
 * mock 适配器：只替换传输层，不改页面与 api 调用。
 * VITE_DATA_MODE=real 时请求直接走 /api/v1 的真实后端，同一份页面代码无需改动。
 */
configureApiMock(async (path, init) => {
  try {
    return await handleMock(path, init)
  } catch (error) {
    if (error instanceof MockHttpError) {
      throw new ApiError(error.status, { error: { code: error.code, message: error.message } })
    }
    throw error
  }
})

const app = createApp(App)
app.use(pinia)
configureApiTokenProvider(() => useAuthStore(pinia).accessToken)
app.use(router).mount('#app')
