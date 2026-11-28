import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import { configureApiMock } from './api'
import { ApiError } from './api'
import { handleMock, MockHttpError } from './mock/server'
import './styles/studio/base.css'
import './styles/studio/components.css'
import './styles/studio/studio.css'
import './styles/app.css'
// 结构基线在前（保留业务页的栅格、状态条、素材卡等布局），
// 暗色令牌与配色覆盖在后：全站只有一个颜色来源，布局不受影响。
import './styles/studio/theme-light.css'
import './styles/theme.dark.css'

/**
 * mock 适配器：只替换传输层，不改页面与 api 调用。
 * 当前阶段全部数据来自 mock；接入真实后端时在同一层换成 fetch 即可，页面无需改动。
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
app.use(router).mount('#app')
