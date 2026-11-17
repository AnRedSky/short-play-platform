<template>
  <main class="login-page">
    <form class="login-card" @submit.prevent="submit">
      <p class="eyebrow">SHORT PLAY PLATFORM</p><h1>欢迎回来</h1><p class="muted">登录企业短剧生产工作台</p>
      <label>企业邮箱<input v-model.trim="email" type="email" autocomplete="username" required placeholder="name@company.com"></label>
      <label>登录密码<input v-model="password" type="password" autocomplete="current-password" required minlength="1" placeholder="请输入密码"></label>
      <p v-if="error" class="error-text">{{ error }}</p>
      <button class="primary-button full" :disabled="loading">{{ loading ? '正在登录…' : '登录工作台' }}</button>
      <p class="footnote">仅供已创建的企业账号使用。首次管理员初始化由部署流程完成。</p>
    </form>
  </main>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authApi } from '../services/resources'
import { useSessionStore } from '../stores/session'
const email = ref(''); const password = ref(''); const loading = ref(false); const error = ref('')
const session = useSessionStore(); const route = useRoute(); const router = useRouter()
async function submit() {
  loading.value = true; error.value = ''
  try {
    const result = await authApi.login(email.value, password.value)
    session.establishSession(result.data.access_token, result.data.refresh_token, result.data.user)
    const me = await authApi.me(); session.setPermissions(me.data.permissions)
    await router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
  } catch (e) { error.value = e instanceof Error ? e.message : '登录失败，请稍后重试' }
  finally { loading.value = false }
}
</script>
