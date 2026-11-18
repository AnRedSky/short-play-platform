<template>
  <section class="page">
    <div class="page-heading"><div><p class="eyebrow">OVERVIEW</p><h1>工作台概览</h1><p class="muted">管理企业项目与短剧生产协作。</p></div><RouterLink class="primary-button" to="/projects">进入项目管理</RouterLink></div>
    <div class="stat-grid"><article class="stat-card"><span>我的账号</span><strong>{{ session.user?.full_name ?? '—' }}</strong><small>{{ session.user?.email }}</small></article><article class="stat-card"><span>当前组织</span><strong>{{ organization?.name ?? '—' }}</strong><small>{{ organization?.slug ?? '组织信息未设置' }}</small></article><article class="stat-card"><span>可用权限</span><strong>{{ session.permissions.length }}</strong><small>由服务端会话返回</small></article></div>
    <div class="content-card"><div class="card-heading"><h2>快速入口</h2><span class="status-pill">M1 已接入</span></div><div class="quick-links"><RouterLink to="/projects">项目管理 <span>查看与创建企业项目 →</span></RouterLink><RouterLink to="/admin/users">用户管理 <span>维护企业用户 →</span></RouterLink><RouterLink to="/admin/roles">角色权限 <span>配置 RBAC 角色 →</span></RouterLink><RouterLink to="/admin/departments">组织部门 <span>查看与维护部门 →</span></RouterLink></div></div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { organizationsApi } from '../../api/organizations'
import type { Organization } from '../../types/api'
import { useAuthStore } from '../../stores/auth'
const session = useAuthStore(); const organization = ref<Organization | null>(null)
onMounted(async () => { try { const result = await organizationsApi.list(); organization.value = result.data[0] ?? null } catch { organization.value = null } })
</script>
