<template>
  <div class="app-frame">
    <aside class="sidebar">
      <RouterLink class="brand" to="/">PLAY<span>STUDIO</span></RouterLink>
      <p class="nav-caption">工作空间</p>
      <RouterLink to="/" class="nav-link">概览</RouterLink>
      <RouterLink to="/projects" class="nav-link">项目管理</RouterLink>
      <p class="nav-caption">创作生产</p>
      <RouterLink :to="projectPath('stories')" class="nav-link">故事圣经</RouterLink>
      <RouterLink :to="projectPath('episodes')" class="nav-link">剧集与剧本</RouterLink>
      <RouterLink :to="projectPath('assets')" class="nav-link">角色 / 场景 / 道具</RouterLink>
      <RouterLink :to="projectPath('storyboards')" class="nav-link">分镜与镜头</RouterLink>
      <RouterLink :to="projectPath('tasks')" class="nav-link">AI 生成任务</RouterLink>
      <RouterLink :to="projectPath('reviews')" class="nav-link">审核与质量</RouterLink>
      <RouterLink :to="projectPath('editor')" class="nav-link">时间线剪辑</RouterLink>
      <RouterLink :to="projectPath('exports')" class="nav-link">成片导出</RouterLink>
      <p class="nav-caption">企业管理</p>
      <RouterLink to="/admin/users" class="nav-link">用户管理</RouterLink>
      <RouterLink to="/admin/roles" class="nav-link">角色与权限</RouterLink>
      <RouterLink to="/admin/departments" class="nav-link">组织与部门</RouterLink>
      <div class="sidebar-foot">企业 AI 短剧生产平台<br><small>前端 UI 预览工作区</small></div>
    </aside>
    <main class="main-area">
      <header class="topbar">
        <div class="topbar-context"><span>生产管理工作台</span><span v-if="session.isPreview" class="preview-pill">DEMO · 本地预览数据</span></div>
        <div v-if="session.user" class="user-chip"><span class="avatar">{{ session.user.full_name.slice(0,1) }}</span>{{ session.user.full_name }}<button class="link-button" @click="logout">{{ session.isPreview ? '退出预览' : '退出' }}</button></div>
      </header>
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
function projectPath(section: string) { return '/projects/demo-project/' + section }
async function logout() {
  if (session.isPreview) { session.clearSession(); session.enterPreview({ id: 'preview-user', email: 'preview@shortplay.local', full_name: '产品预览用户', is_active: true }, ['projects:read', 'projects:write', 'users:read', 'roles:read', 'organizations:read']); await router.push('/'); return }
  try { if (session.refreshToken) await authApi.logout(session.refreshToken) } finally { session.clearSession(); await router.push('/login') }
}
</script>
