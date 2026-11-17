<template>
  <section class="page"><div class="page-heading"><div><p class="eyebrow">ACCESS CONTROL</p><h1>角色与权限</h1><p class="muted">查看当前组织的 RBAC 角色和权限代码。</p></div></div><p v-if="error" class="error-text">{{ error }}</p><div class="content-card"><div class="card-heading"><h2>角色列表</h2><button class="secondary-button small" @click="load">刷新</button></div><div v-if="loading" class="empty-state">正在加载…</div><div v-else-if="!roles.length" class="empty-state">当前组织暂无角色。</div><div v-else class="role-grid"><article v-for="role in roles" :key="role.id" class="role-card"><div class="role-head"><strong>{{ role.name }}</strong><span class="status-pill">{{ role.code }}</span></div><p class="muted">{{ role.description || '暂无描述' }}</p><div class="permission-list"><span v-for="permission in (role.permissions ?? [])" :key="permission">{{ permission }}</span></div></article></div></div></section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { rolesApi, type Role } from '../services/resources'
const roles = ref<Role[]>([]); const loading = ref(false); const error = ref('')
async function load() { loading.value = true; error.value = ''; try { roles.value = (await rolesApi.list()).data } catch (e) { error.value = e instanceof Error ? e.message : '角色加载失败' } finally { loading.value = false } }
onMounted(load)
</script>
