<template>
  <div class="app-frame">
    <aside class="sidebar">
      <RouterLink class="brand" to="/">PLAY<span>STUDIO</span></RouterLink>
      <p class="nav-caption">工作空间</p>
      <RouterLink to="/" class="nav-link">概览</RouterLink>
      <RouterLink to="/projects" class="nav-link">项目管理</RouterLink>
      <p class="nav-caption">企业管理</p>
      <RouterLink to="/admin/users" class="nav-link">用户管理</RouterLink>
      <RouterLink to="/admin/roles" class="nav-link">角色与权限</RouterLink>
      <RouterLink to="/admin/departments" class="nav-link">组织与部门</RouterLink>
      <div class="sidebar-foot">企业 AI 短剧生产平台<br><small>前端工作区 · M1</small></div>
    </aside>
    <main class="main-area">
      <header class="topbar"><span>生产管理工作台</span><div v-if="session.user" class="user-chip"><span class="avatar">{{ session.user.full_name.slice(0,1) }}</span>{{ session.user.full_name }}<button class="link-button" @click="logout">退出</button></div></header>
      <RouterView />
    </main>
  </div>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { authApi } from './services/resources'
import { useSessionStore } from './stores/session'
const session = useSessionStore()
const router = useRouter()
async function logout() {
  try { if (session.refreshToken) await authApi.logout(session.refreshToken) } finally { session.clearSession(); await router.push('/login') }
}
</script>
